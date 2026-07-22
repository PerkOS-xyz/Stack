import { NextRequest, NextResponse } from "next/server";
import { parseSIWAMessage, verifySIWA } from "@buildersgarden/siwa/siwa";
import { createReceipt } from "@buildersgarden/siwa/receipt";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import {
  getSiwaDomain,
  getSiwaReceiptSecret,
  getSiwaReceiptTtlMs,
  getSiwaVerifyUri,
} from "@/lib/siwa/config";
import { resolveSiwaNetwork } from "@/lib/siwa/network";
import { getSiwaNonceStore } from "@/lib/siwa/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  network: z.string().min(1),
  message: z.string().min(1).max(16_384),
  signature: z.string().regex(/^0x(?:[a-fA-F0-9]{2})+$/).max(8_194),
}).strict();

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`siwa-verify:${getClientIp(request)}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid SIWA verification request" }, { status: 400, headers: corsHeaders });
    }
    const fields = parseSIWAMessage(parsed.data.message);
    const resolved = resolveSiwaNetwork(parsed.data.network);
    if (
      fields.chainId !== resolved.chainId ||
      fields.agentRegistry.toLowerCase() !== resolved.agentRegistry.toLowerCase() ||
      fields.uri !== getSiwaVerifyUri(request)
    ) {
      return NextResponse.json(
        { valid: false, error: "SIWA message chain, registry, or URI is not canonical" },
        { status: 401, headers: { ...corsHeaders, "Cache-Control": "no-store" } }
      );
    }

    const result = await verifySIWA(
      parsed.data.message,
      parsed.data.signature,
      getSiwaDomain(request),
      { nonceStore: getSiwaNonceStore() },
      resolved.client,
    );
    if (!result.valid) {
      return NextResponse.json(result, { status: 401, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }

    const receipt = createReceipt({
      address: result.address,
      agentId: result.agentId,
      agentRegistry: result.agentRegistry,
      chainId: result.chainId,
      verified: result.verified,
      signerType: result.signerType,
    }, { secret: getSiwaReceiptSecret(), ttl: getSiwaReceiptTtlMs() });

    return NextResponse.json({
      valid: true,
      agent: {
        address: result.address,
        agentId: result.agentId,
        agentRegistry: result.agentRegistry,
        chainId: result.chainId,
        signerType: result.signerType,
      },
      ...receipt,
    }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "SIWA verification failed" },
      { status: 400, headers: { ...corsHeaders, "Cache-Control": "no-store" } }
    );
  }
}
