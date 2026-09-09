/**
 * GET /api/v2/agents/oauth/nonce?address=0x…
 *
 * Step one of signing in through PerkOS OAuth with resource=stack.perkos.xyz:
 * a single-use challenge this wallet signs. The nonce is minted here, not at
 * the issuer, so there is exactly one store that decides whether it was spent.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isAddress } from "viem";
import { getAdminFirestoreDb } from "@/lib/db/firebase";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { buildSignInMessage, NONCE_COLLECTION, NONCE_TTL_MS } from "@/lib/agents/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`oauth-nonce:${getClientIp(request)}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  const address = request.nextUrl.searchParams.get("address") || "";
  if (!isAddress(address, { strict: false })) {
    return NextResponse.json({ error: "address query parameter must be an EVM address" }, { status: 400, headers: corsHeaders });
  }

  const nonce = randomBytes(24).toString("base64url");
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const message = buildSignInMessage(address, nonce, issuedAt);
  await getAdminFirestoreDb().collection(NONCE_COLLECTION).doc(nonce).set({
    address: address.toLowerCase(),
    message,
    createdAt: now,
    expiresAt: now + NONCE_TTL_MS,
  });

  return NextResponse.json(
    { nonce, message, expiresAt: new Date(now + NONCE_TTL_MS).toISOString() },
    { status: 200, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}
