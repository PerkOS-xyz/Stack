/**
 * GET /api/v1/wallets/{address}/trust — x402 payer trust profile, $0.01.
 * Payable over x402 (USDC) or MPP (card). See lib/agents/paidRoute.ts.
 */
import { NextRequest } from "next/server";
import { isAddress } from "viem";
import { PRODUCTS } from "@/lib/agents/paidApi";
import { passthroughHeaders } from "@/lib/agents/paidApiGate";
import { handlePaidGet, paidOptions } from "@/lib/agents/paidRoute";
import { payerTrust } from "@/lib/agents/paidProducts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return paidOptions();
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const { address } = await ctx.params;
  const inputsOk = isAddress(address, { strict: false });
  return handlePaidGet(req, PRODUCTS["payer-trust"], inputsOk, () => payerTrust(req.nextUrl.origin, address, passthroughHeaders(req)));
}
