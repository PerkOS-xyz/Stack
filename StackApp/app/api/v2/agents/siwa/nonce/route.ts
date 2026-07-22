import { NextRequest, NextResponse } from "next/server";
import { createSIWANonce } from "@buildersgarden/siwa/siwa";
import { isAddress } from "viem";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getSiwaDomain, getSiwaNonceTtlMs, getSiwaVerifyUri } from "@/lib/siwa/config";
import { resolveSiwaNetwork } from "@/lib/siwa/network";
import { getSiwaNonceStore } from "@/lib/siwa/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  network: z.string().min(1),
  agentId: z.union([z.number().int().nonnegative(), z.string().regex(/^(0|[1-9]\d*)$/)]),
  address: z.string(),
  challengeResponse: z.string().optional(),
}).strict();

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`siwa-nonce:${getClientIp(request)}`, 20, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !isAddress(parsed.data?.address || "")) {
      return NextResponse.json({ error: "Invalid SIWA nonce request" }, { status: 400, headers: corsHeaders });
    }
    const agentId = Number(parsed.data.agentId);
    if (!Number.isSafeInteger(agentId)) {
      return NextResponse.json({ error: "agentId exceeds the SIWA SDK safe integer range" }, { status: 400, headers: corsHeaders });
    }

    const resolved = resolveSiwaNetwork(parsed.data.network);
    const result = await createSIWANonce({
      address: parsed.data.address,
      agentId,
      agentRegistry: resolved.agentRegistry,
      challengeResponse: parsed.data.challengeResponse,
    }, resolved.client, {
      expirationTTL: getSiwaNonceTtlMs(),
      nonceStore: getSiwaNonceStore(),
    });

    return NextResponse.json({
      ...result,
      domain: getSiwaDomain(request),
      uri: getSiwaVerifyUri(request),
      chainId: resolved.chainId,
      agentRegistry: resolved.agentRegistry,
    }, { status: result.status === "nonce_issued" ? 200 : 403, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to issue SIWA nonce" },
      { status: 400, headers: corsHeaders }
    );
  }
}
