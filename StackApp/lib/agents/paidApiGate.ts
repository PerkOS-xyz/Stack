/**
 * The 402 gate for Stack's paid API, on the server side of lib/agents/paidApi.ts.
 *
 * Order of operations matters for money: (1) refuse malformed input before
 * anything, (2) verify the payment, (3) let the route build the product,
 * (4) settle, (5) answer. A product that cannot be built is never charged
 * for, and a payment that does not verify never reaches settlement.
 */
import { NextRequest, NextResponse } from "next/server";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { getChainIdFromNetwork } from "@/lib/utils/chains";
import { getEIP712Version, getTokenName } from "@/lib/utils/x402-payment";
import { corsHeaders } from "@/lib/utils/cors";
import { X402Service } from "@/lib/services/X402Service";
import type { X402SettleRequest, X402VerifyRequest } from "@/lib/types/x402";
import {
  decodePaymentHeader,
  encodePaymentRequired,
  encodePaymentResponse,
  matchPayment,
  offersV1,
  offersV2,
  paymentRequiredBody,
  readPaymentHeader,
  V2_REQUIRED_HEADER,
  V2_RESPONSE_HEADER,
  type OfferNetwork,
  type PaidProduct,
} from "./paidApi";

/** Networks a paid call can be settled on. Mainnet first; the testnet is for integration runs. */
const OFFER_NETWORK_KEYS = (process.env.PAID_API_NETWORKS || "base,base-sepolia").split(",").map((s) => s.trim()).filter(Boolean);

export function offerNetworks(): OfferNetwork[] {
  const out: OfferNetwork[] = [];
  for (const key of OFFER_NETWORK_KEYS) {
    const chainId = getChainIdFromNetwork(key);
    const asset = config.paymentTokens[key as SupportedNetwork];
    if (!chainId || !asset) continue;
    out.push({
      key,
      caip2: `eip155:${chainId}`,
      asset,
      tokenName: getTokenName(chainId),
      tokenVersion: getEIP712Version(chainId),
      decimals: 6,
      testnet: /sepolia|fuji|amoy|testnet/.test(key),
    });
  }
  return out;
}

/** Who receives the money: the facilitator's payment receiver (the PerkOS treasury). */
export function payTo(): string {
  return process.env.PAID_API_PAY_TO || config.paymentReceiver;
}

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

function paymentRequired(product: PaidProduct, resourceUrl: string, reason?: string, status = 402): NextResponse {
  const nets = offerNetworks();
  const v2 = offersV2(product, resourceUrl, payTo(), nets);
  const v1 = offersV1(product, resourceUrl, payTo(), nets);
  return NextResponse.json(paymentRequiredBody(product, v1, reason), {
    status,
    headers: {
      ...JSON_HEADERS,
      [V2_REQUIRED_HEADER]: encodePaymentRequired(product, resourceUrl, v2),
      "Access-Control-Expose-Headers": `${V2_REQUIRED_HEADER}, ${V2_RESPONSE_HEADER}`,
    },
  });
}

export type Gate =
  | { paid: false; response: NextResponse }
  | {
      paid: true;
      payer: string;
      network: string;
      /** Settles the verified payment; call only once the product is built. */
      settle: () => Promise<{ ok: boolean; transaction: string | null; headers: Record<string, string>; errorReason?: string }>;
      /** 402 again, for a product that could not be built after verification (nothing was charged). */
      refuse: (reason: string, status?: number) => NextResponse;
    };

/**
 * Gate a paid route. `inputsOk` is checked before any payment is read, so an
 * agent with a valid payment but a bad request is told about the request and
 * is not charged.
 */
export async function gate(req: NextRequest, product: PaidProduct, inputsOk: boolean): Promise<Gate> {
  const url = new URL(req.url);
  const resourceUrl = `${url.origin}${url.pathname}${url.search}`;
  const header = readPaymentHeader((n) => req.headers.get(n));

  if (!header) {
    const hint = inputsOk ? undefined : `Payment required. Inputs: ${product.inputs.join(", ")}.`;
    return { paid: false, response: paymentRequired(product, resourceUrl, hint) };
  }
  if (!inputsOk) {
    return {
      paid: false,
      response: NextResponse.json({ error: "invalid_request", error_description: `Required inputs: ${product.inputs.join(", ")}. Nothing was charged.` }, { status: 400, headers: JSON_HEADERS }),
    };
  }

  const decoded = decodePaymentHeader(header);
  if (!decoded) return { paid: false, response: paymentRequired(product, resourceUrl, "The payment header is not valid base64 JSON.") };

  const nets = offerNetworks();
  const matched = matchPayment(decoded, offersV2(product, resourceUrl, payTo(), nets), offersV1(product, resourceUrl, payTo(), nets), nets);
  if ("error" in matched) return { paid: false, response: paymentRequired(product, resourceUrl, matched.error) };

  const x402 = new X402Service();
  const request = { x402Version: matched.x402Version, paymentPayload: matched.paymentPayload, paymentRequirements: matched.paymentRequirements } as unknown as X402VerifyRequest;
  let verified;
  try {
    verified = await x402.verify(request);
  } catch (e) {
    return { paid: false, response: paymentRequired(product, resourceUrl, `Verification failed: ${(e as Error).message}`) };
  }
  if (!verified.isValid) return { paid: false, response: paymentRequired(product, resourceUrl, verified.invalidReason || "Payment did not verify.") };

  const vendorDomain = url.hostname.toLowerCase();
  return {
    paid: true,
    payer: verified.payer || "",
    network: matched.network,
    settle: async () => {
      const result = await x402.settle(request as unknown as X402SettleRequest, vendorDomain);
      return {
        ok: result.success,
        transaction: result.transaction || null,
        errorReason: result.errorReason || undefined,
        headers: {
          ...JSON_HEADERS,
          [V2_RESPONSE_HEADER]: encodePaymentResponse({ success: result.success, transaction: result.transaction, network: result.network || matched.network, payer: result.payer, errorReason: result.errorReason }),
          "Access-Control-Expose-Headers": `${V2_REQUIRED_HEADER}, ${V2_RESPONSE_HEADER}`,
          ...(result.transaction ? { "X-x402-Transaction": result.transaction } : {}),
        },
      };
    },
    refuse: (reason, status = 502) => NextResponse.json({ error: "product_unavailable", error_description: `${reason} Nothing was charged.` }, { status, headers: JSON_HEADERS }),
  };
}

/** Same-origin headers to carry into internal calls (Vercel preview bypass). */
export function passthroughHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  const bypass = req.headers.get("x-vercel-protection-bypass");
  if (bypass) out["x-vercel-protection-bypass"] = bypass;
  return out;
}
