/**
 * GET /api/v1?chainId=&agentId=  — ERC-8004 agent report, $0.01 over x402.
 *
 * Without a payment: 402 with the requirements (PAYMENT-REQUIRED header for
 * x402 v2, body for v1) and the catalog of everything the paid API sells.
 * With a payment: verify, build, settle, answer with PAYMENT-RESPONSE.
 */
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders } from "@/lib/utils/cors";
import { PRODUCTS } from "@/lib/agents/paidApi";
import { gate, passthroughHeaders } from "@/lib/agents/paidApiGate";
import { agentReport } from "@/lib/agents/paidProducts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, "Access-Control-Allow-Headers": `${corsHeaders["Access-Control-Allow-Headers"]}, X-PAYMENT, PAYMENT-SIGNATURE` },
  });
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`paid-api:${getClientIp(req)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  const product = PRODUCTS["agent-report"];
  const chainId = Number(req.nextUrl.searchParams.get("chainId"));
  const agentId = (req.nextUrl.searchParams.get("agentId") || "").trim();
  const inputsOk = Number.isInteger(chainId) && chainId > 0 && /^\d+$/.test(agentId);

  const g = await gate(req, product, inputsOk);
  if (!g.paid) return g.response;

  let report;
  try {
    report = await agentReport(req.nextUrl.origin, chainId, agentId, passthroughHeaders(req));
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
  return NextResponse.json({ ...report, payment: { payer: g.payer, network: g.network, transaction: settled.transaction } }, { status: 200, headers: settled.headers });
}
