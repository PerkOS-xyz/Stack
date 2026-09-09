/**
 * GET /api/v1?chainId=&agentId=  — ERC-8004 agent report, $0.01.
 * Payable over x402 (USDC) or MPP (card). See lib/agents/paidRoute.ts.
 */
import { NextRequest } from "next/server";
import { PRODUCTS } from "@/lib/agents/paidApi";
import { passthroughHeaders } from "@/lib/agents/paidApiGate";
import { handlePaidGet, paidOptions } from "@/lib/agents/paidRoute";
import { agentReport } from "@/lib/agents/paidProducts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return paidOptions();
}

export async function GET(req: NextRequest) {
  const chainId = Number(req.nextUrl.searchParams.get("chainId"));
  const agentId = (req.nextUrl.searchParams.get("agentId") || "").trim();
  const inputsOk = Number.isInteger(chainId) && chainId > 0 && /^\d+$/.test(agentId);
  return handlePaidGet(req, PRODUCTS["agent-report"], inputsOk, () => agentReport(req.nextUrl.origin, chainId, agentId, passthroughHeaders(req)));
}
