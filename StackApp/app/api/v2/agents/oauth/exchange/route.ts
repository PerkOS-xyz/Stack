/**
 * POST /api/v2/agents/oauth/exchange  { address, nonce, signature }
 *
 * Called by PerkOS OAuth (oauth.perkos.xyz) while minting a token with
 * resource=stack.perkos.xyz. Stack verifies the signature over the nonce it
 * issued, spends the nonce, and answers the one question the issuer cannot:
 * is this wallet a registered agent here, and which scopes may it hold.
 *
 * Anyone may call it, but a valid signature over an unspent nonce is the price
 * of an answer, so it cannot be used to probe whether an address is registered.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { z } from "zod";
import { getAdminFirestoreDb } from "@/lib/db/firebase";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getAgentByWallet } from "@/lib/services/AgentService";
import { NONCE_COLLECTION, STACK_OAUTH_SCOPES } from "@/lib/agents/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string().refine((v) => isAddress(v, { strict: false }), "address must be an EVM address"),
  nonce: z.string().min(16).max(128),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "signature must be hex"),
});

const oauthError = (status: number, error: string, description: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, error_description: description, ...extra }, { status, headers: { ...corsHeaders, "Cache-Control": "no-store" } });

export async function OPTIONS() {
  return corsOptions();
}

/** Spends the nonce; returns the message it was issued with, or null if unknown, expired or already used. */
async function consumeNonce(nonce: string, address: string): Promise<string | null> {
  const db = getAdminFirestoreDb();
  const ref = db.collection(NONCE_COLLECTION).doc(nonce);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    const data = snap.data() || {};
    if (Number(data.expiresAt || 0) < Date.now()) return null;
    if (String(data.address || "") !== address) return null;
    return typeof data.message === "string" ? data.message : null;
  });
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`oauth-exchange:${getClientIp(request)}`, 30, 60_000).allowed) {
    return oauthError(429, "temporarily_unavailable", "Rate limit exceeded");
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return oauthError(400, "invalid_request", parsed.error.issues.map((i) => i.message).join("; "));
  }
  const address = parsed.data.address.toLowerCase();

  const message = await consumeNonce(parsed.data.nonce, address);
  if (!message) return oauthError(400, "invalid_grant", "The nonce is unknown, expired, already used, or was issued to another address.");

  let valid = false;
  try {
    valid = await verifyMessage({ address: parsed.data.address as `0x${string}`, message, signature: parsed.data.signature as `0x${string}` });
  } catch {
    valid = false;
  }
  if (!valid) return oauthError(400, "invalid_grant", "The signature does not match the message this nonce was issued with.");

  const agent = await getAgentByWallet(address);
  if (!agent) {
    return oauthError(403, "access_denied", "This wallet is not registered as a Stack agent.", {
      register: `${request.nextUrl.origin}/api/v2/agents/register`,
      documentation: `${request.nextUrl.origin}/auth.md`,
    });
  }
  if (agent.status !== "active") {
    return oauthError(403, "access_denied", `This agent is ${agent.status}.`);
  }

  return NextResponse.json(
    { subject: address, agent_id: agent.id, name: agent.name, role: "agent", scopes: [...STACK_OAUTH_SCOPES] },
    { status: 200, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}
