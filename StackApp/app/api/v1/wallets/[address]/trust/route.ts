/**
 * GET /api/v1/wallets/{address}/trust — x402 payer trust profile, $0.01 over x402.
 * Same handshake as /api/v1 (see lib/agents/paidApiGate.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders } from "@/lib/utils/cors";
import { PRODUCTS } from "@/lib/agents/paidApi";
import { gate, passthroughHeaders } from "@/lib/agents/paidApiGate";
import { payerTrust } from "@/lib/agents/paidProducts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, X-PAYMENT, PAYMENT-SIGNATURE` },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  if (!rateLimit(`paid-api:${getClientIp(req)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  const { address } = await ctx.params;
  const product = PRODUCTS["payer-trust"];
  const inputsOk = isAddress(address, { strict: false });

  const g = await gate(req, product, inputsOk);
  if (!g.paid) return g.response;

  let profile;
  try {
    profile = await payerTrust(req.nextUrl.origin, address, passthroughHeaders(req));
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
  return NextResponse.json({ ...profile, payment: { payer: g.payer, network: g.network, transaction: settled.transaction } }, { status: 200, headers: settled.headers });
}
