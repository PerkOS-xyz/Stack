/**
 * OAuth for Stack, as a resource server.
 *
 * The authorization server is PerkOS OAuth (oauth.perkos.xyz), a façade over
 * wallet signatures. Stack never mints tokens: it issues the message a wallet
 * signs, tells the issuer whether that wallet is a registered agent, and
 * verifies the ES256 tokens the issuer minted for this resource. Access
 * decisions stay here, where the agent records are.
 *
 * Pure helpers (no Next imports) so the routes stay thin and tests can run
 * them with a local key.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const trim = (v: string) => v.replace(/\/+$/, "");

export const OAUTH_ISSUER = trim(process.env.PERKOS_OAUTH_ISSUER ?? "https://oauth.perkos.xyz");
export const OAUTH_RESOURCE = trim(process.env.OAUTH_RESOURCE ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://stack.perkos.xyz");

/** Scopes the issuer may put in a Stack token, and what they unlock here. */
export const STACK_OAUTH_SCOPES = ["stack:read", "stack:write"] as const;
export type StackOAuthScope = (typeof STACK_OAUTH_SCOPES)[number];

const SCOPE_MAP: Record<StackOAuthScope, "read" | "write"> = {
  "stack:read": "read",
  "stack:write": "write",
};

/** Maps a token's `scope` claim onto the API-key scopes the routes check. */
export function mapOAuthScopes(scope: string | undefined): ("read" | "write")[] {
  const out = new Set<"read" | "write">();
  for (const s of (scope ?? "").split(/\s+/)) {
    const mapped = SCOPE_MAP[s as StackOAuthScope];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

export const NONCE_TTL_MS = 5 * 60 * 1000;
/** Firestore collection of unspent sign-in nonces (doc id = nonce). */
export const NONCE_COLLECTION = "perkos_oauth_nonces";

/** The message a wallet signs to sign in. Same shape as perkos.xyz, naming Stack. */
export function buildSignInMessage(address: string, nonce: string, issuedAt: string): string {
  return ["PerkOS Stack wants to sign you in.", "", `Wallet: ${address}`, `Nonce: ${nonce}`, `Issued: ${issuedAt}`].join("\n");
}

/** RFC 9728 protected resource metadata for this origin. */
export function protectedResourceMetadata() {
  return {
    resource: OAUTH_RESOURCE,
    authorization_servers: [OAUTH_ISSUER],
    scopes_supported: [...STACK_OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_documentation: `${OAUTH_RESOURCE}/auth.md`,
  };
}

/** The WWW-Authenticate challenge on 401s, pointing at the resource metadata. */
export function bearerChallenge(): string {
  return `Bearer resource_metadata="${OAUTH_RESOURCE}/.well-known/oauth-protected-resource"`;
}

export interface VerifiedAccessToken {
  walletAddress: string;
  agentId: string | null;
  scope: string;
  scopes: ("read" | "write")[];
  tokenId: string;
  expiresAt: number;
}

let remoteJwks: JWTVerifyGetKey | null = null;
function issuerJwks(): JWTVerifyGetKey {
  if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(`${OAUTH_ISSUER}/jwks.json`));
  return remoteJwks;
}

/** Looks like a JWT (three base64url segments), as opposed to an sk_perkos_ key. */
export function looksLikeJwt(token: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

/**
 * Verifies an access token minted by the issuer for this resource.
 * Signature against the issuer's JWKS, `iss` and `aud` exact, `exp` enforced
 * by jose. Returns null on any failure; callers turn that into a 401.
 */
export async function verifyAccessToken(
  token: string,
  options: { jwks?: JWTVerifyGetKey; issuer?: string; audience?: string } = {},
): Promise<VerifiedAccessToken | null> {
  try {
    const { payload } = await jwtVerify(token, options.jwks ?? issuerJwks(), {
      issuer: options.issuer ?? OAUTH_ISSUER,
      audience: options.audience ?? OAUTH_RESOURCE,
      algorithms: ["ES256"],
    });
    const sub = String(payload.sub ?? "");
    if (!/^0x[a-f0-9]{40}$/.test(sub)) return null;
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    return {
      walletAddress: sub,
      agentId: typeof payload.agent_id === "string" ? payload.agent_id : null,
      scope,
      scopes: mapOAuthScopes(scope),
      tokenId: typeof payload.jti === "string" ? payload.jti : `${sub}.${payload.iat ?? ""}`,
      expiresAt: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}
