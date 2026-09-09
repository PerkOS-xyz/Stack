/**
 * One handler for every paid product: two rails, one resource.
 *
 * - x402 (stablecoin): PAYMENT-SIGNATURE / X-PAYMENT → verify, build, settle,
 *   deliver (lib/agents/paidApiGate.ts).
 * - MPP (card): Authorization: Payment … → Stripe charges, then build, deliver
 *   (lib/agents/mpp.ts). The card is charged before the product is built,
 *   which is how the MPP middleware works; inputs are validated before either
 *   rail runs, so a bad request is refused uncharged.
 * - Nothing: one 402 that speaks to both kinds of caller. MPP's challenge in
 *   WWW-Authenticate, x402's offers in PAYMENT-REQUIRED and the body.
 */
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders } from "@/lib/utils/cors";
import { readPaymentHeader, type PaidProduct } from "./paidApi";
import { gate as x402Gate } from "./paidApiGate";
import { mppGate, offeringCard } from "./mpp";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

export function paidOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, X-PAYMENT, PAYMENT-SIGNATURE, Authorization`,
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, WWW-Authenticate, Payment-Receipt, X-x402-Transaction",
    },
  });
}

/** Copies MPP's challenge (WWW-Authenticate + problem fields) onto the x402 402. */
async function mergeChallenges(x402Response: NextResponse, mppChallenge: Response): Promise<NextResponse> {
  const problem = (await mppChallenge.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const body = (await x402Response.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const headers = new Headers(x402Response.headers);
  const authenticate = mppChallenge.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  const expose = headers.get("Access-Control-Expose-Headers") || "";
  headers.set("Access-Control-Expose-Headers", `${expose}${expose ? ", " : ""}WWW-Authenticate, Payment-Receipt`);
  return NextResponse.json(
    { ...body, ...(problem.challengeId ? { challengeId: problem.challengeId } : {}), ...(problem.hint ? { hint: problem.hint } : {}) },
    { status: 402, headers },
  );
}

/**
 * Handle a paid GET. `inputsOk` gates both rails; `build` produces the product.
 */
export async function handlePaidGet(req: NextRequest, product: PaidProduct, inputsOk: boolean, build: () => Promise<unknown>): Promise<Response> {
  if (!rateLimit(`paid-api:${getClientIp(req)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  const x402Header = readPaymentHeader((n) => req.headers.get(n));

  // ---- card rail (or the merged challenge when nothing was presented) ----
  if (!x402Header) {
    const card = offeringCard(req);
    if (card && !inputsOk) {
      return NextResponse.json({ error: "invalid_request", error_description: `Required inputs: ${product.inputs.join(", ")}. Nothing was charged.` }, { status: 400, headers: JSON_HEADERS });
    }
    const mpp = await mppGate(product);
    if (mpp) {
      let built: unknown = null;
      let buildError: string | null = null;
      const wrapped = mpp(async () => {
        try {
          built = await build();
          return NextResponse.json({ ...(built as object), payment: { method: "mpp", rail: "card" } }, { status: 200, headers: JSON_HEADERS });
        } catch (e) {
          buildError = (e as Error).message;
          return NextResponse.json({ error: "product_unavailable", error_description: `${buildError}. The card charge went through; contact contact@perkos.xyz with the Payment-Receipt for a refund.` }, { status: 502, headers: JSON_HEADERS });
        }
      });
      const res = await wrapped(req);
      if (res.status === 402 && !card) {
        // Unpaid, and MPP is on: hand back one 402 for both rails.
        const x402 = (await x402Gate(req, product, inputsOk)) as { paid: false; response: NextResponse };
        return mergeChallenges(x402.response, res);
      }
      return res;
    }
    // MPP off: fall through to the x402 402.
  }

  // ---- stablecoin rail ----
  const g = await x402Gate(req, product, inputsOk);
  if (!g.paid) return g.response;

  let built: unknown;
  try {
    built = await build();
  } catch (e) {
    return g.refuse((e as Error).message);
  }
  const settled = await g.settle();
  if (!settled.ok) {
    return NextResponse.json(
      { error: "settlement_failed", error_description: settled.errorReason || "The payment could not be settled. Nothing was delivered." },
      { status: 402, headers: settled.headers },
    );
  }
  return NextResponse.json({ ...(built as object), payment: { method: "x402", payer: g.payer, network: g.network, transaction: settled.transaction } }, { status: 200, headers: settled.headers });
}
