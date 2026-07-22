import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import {
  type SupportedNetwork,
  getErc8004Registries,
  getPaymentToken,
  getRpcUrl,
} from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import {
  ZERO_ADDRESS,
  getNetworkCapability,
  isAgentReadyNetwork,
  isX402PaymentNetwork,
} from "@/lib/utils/network-capabilities";
import {
  AGENT_PAYMENT_BINDING_SCHEMA,
  buildAgentPaymentBindingTypedData,
} from "@/lib/erc8004/paymentBinding";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const uintString = z.union([z.string().regex(/^(0|[1-9]\d*)$/), z.number().int().nonnegative()]);

const bindingSchema = z.object({
  schema: z.literal(AGENT_PAYMENT_BINDING_SCHEMA),
  identityNetwork: z.string(),
  paymentNetwork: z.string(),
  identityChainId: z.number().int().positive(),
  identityRegistry: address,
  agentId: uintString,
  paymentChainId: z.number().int().positive(),
  payTo: address,
  asset: address,
  issuedAt: z.number().int().positive(),
  validUntil: z.number().int().positive(),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  signer: address,
  signature: z.string().max(8_194).regex(/^0x(?:[a-fA-F0-9]{2})+$/),
}).strict();

const IDENTITY_ABI = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "getAgentWallet", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`agent-payment-binding:${getClientIp(request)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  try {
    const parsed = bindingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { verified: false, error: "Invalid payment binding", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }
    const binding = parsed.data;
    if (!isAgentReadyNetwork(binding.identityNetwork)) {
      return NextResponse.json(
        { verified: false, error: "Identity network is not agent-ready" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!isX402PaymentNetwork(binding.paymentNetwork)) {
      return NextResponse.json(
        { verified: false, error: "Payment network is not x402-ready" },
        { status: 400, headers: corsHeaders }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (binding.issuedAt > now + 300) {
      return NextResponse.json(
        { verified: false, error: "issuedAt cannot be more than five minutes in the future" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (
      binding.validUntil <= now ||
      binding.validUntil <= binding.issuedAt ||
      binding.validUntil - binding.issuedAt > 366 * 24 * 60 * 60
    ) {
      return NextResponse.json(
        { verified: false, error: "validUntil must be in the future and no more than 366 days after issuedAt" },
        { status: 400, headers: corsHeaders }
      );
    }

    const identityNetwork = binding.identityNetwork as SupportedNetwork;
    const paymentNetwork = binding.paymentNetwork as SupportedNetwork;
    const identityChain = getChainByNetwork(identityNetwork);
    const paymentCapability = getNetworkCapability(paymentNetwork);
    const registry = getErc8004Registries(identityNetwork).identity;
    const configuredAsset = getPaymentToken(paymentNetwork);
    if (!identityChain || !registry || !paymentCapability || !configuredAsset || configuredAsset === ZERO_ADDRESS) {
      return NextResponse.json(
        { verified: false, error: "Network capability is not fully configured" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (
      binding.identityChainId !== identityChain.id ||
      binding.identityRegistry.toLowerCase() !== registry.toLowerCase() ||
      binding.paymentChainId !== paymentCapability.chainId
    ) {
      return NextResponse.json(
        { verified: false, error: "Binding chain or registry does not match Stack's canonical configuration" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (configuredAsset.toLowerCase() !== binding.asset.toLowerCase()) {
      return NextResponse.json(
        { verified: false, error: "Binding asset does not match Stack's configured payment asset" },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = createPublicClient({
      chain: identityChain,
      transport: http(getRpcUrl(identityNetwork)),
    });
    const agentId = BigInt(binding.agentId);
    let owner: Address;
    try {
      owner = await client.readContract({
        address: registry as Address,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [agentId],
      });
    } catch {
      return NextResponse.json(
        { verified: false, error: "ERC-8004 agent not found" },
        { status: 404, headers: corsHeaders }
      );
    }
    let agentWallet: Address | null = null;
    try {
      const wallet = await client.readContract({
        address: registry as Address,
        abi: IDENTITY_ABI,
        functionName: "getAgentWallet",
        args: [agentId],
      });
      if (wallet.toLowerCase() !== ZERO_ADDRESS) agentWallet = wallet;
    } catch { /* optional */ }

    const signer = binding.signer.toLowerCase();
    const controlType = owner.toLowerCase() === signer
      ? "owner"
      : agentWallet?.toLowerCase() === signer
        ? "agentWallet"
        : "none";
    if (controlType === "none") {
      return NextResponse.json(
        { verified: false, signatureValid: false, controlType, owner, agentWallet, error: "Signer does not control the ERC-8004 identity" },
        { status: 403, headers: corsHeaders }
      );
    }

    const typedData = buildAgentPaymentBindingTypedData({
      identityChainId: identityChain.id,
      identityRegistry: registry as Address,
      agentId,
      paymentChainId: paymentCapability.chainId,
      payTo: binding.payTo as Address,
      asset: binding.asset as Address,
      issuedAt: binding.issuedAt,
      validUntil: binding.validUntil,
      nonce: binding.nonce as Hex,
    });
    const signatureValid = await client.verifyTypedData({
      address: binding.signer as Address,
      ...typedData,
      signature: binding.signature as Hex,
    }).catch(() => false);

    return NextResponse.json({
      verified: signatureValid,
      signatureValid,
      controlType,
      owner,
      agentWallet,
      identity: {
        network: identityNetwork,
        chainId: identityChain.id,
        registry,
        agentId: agentId.toString(),
      },
      payment: {
        network: paymentNetwork,
        chainId: paymentCapability.chainId,
        payTo: binding.payTo,
        asset: configuredAsset,
        symbol: paymentCapability.symbol,
      },
      validUntil: binding.validUntil,
    }, { status: signatureValid ? 200 : 401, headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }
}
