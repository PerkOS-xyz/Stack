const assert = require("node:assert/strict");
const test = require("node:test");

const ISSUER = "https://oauth.perkos.xyz";
const RESOURCE = "https://stack.perkos.xyz";

async function mint(claims, { issuer = ISSUER, audience = RESOURCE, key, kid, expiresIn = 900 } = {}) {
  const { SignJWT } = await import("jose");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(key);
}

async function issuerKeys() {
  const { generateKeyPair, exportJWK, createLocalJWKSet } = await import("jose");
  const pair = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(pair.publicKey);
  const kid = "test-key";
  return { privateKey: pair.privateKey, jwks: createLocalJWKSet({ keys: [{ ...jwk, alg: "ES256", use: "sig", kid }] }), kid };
}

test("scope mapping: stack:* scopes become the API-key scopes routes check; unknown scopes are dropped", async () => {
  const { mapOAuthScopes } = await import("../lib/agents/oauth.ts");
  assert.deepEqual(mapOAuthScopes("stack:read"), ["read"]);
  assert.deepEqual(mapOAuthScopes("stack:read stack:write"), ["read", "write"]);
  assert.deepEqual(mapOAuthScopes("board:write admin"), []); // app scopes and privilege names never map here
  assert.deepEqual(mapOAuthScopes(undefined), []);
});

test("sign-in message is bound to wallet, nonce and time", async () => {
  const { buildSignInMessage, looksLikeJwt } = await import("../lib/agents/oauth.ts");
  const m = buildSignInMessage("0xABC0000000000000000000000000000000000001", "n0nce", "2026-09-09T18:00:00.000Z");
  assert.equal(m, "PerkOS Stack wants to sign you in.\n\nWallet: 0xABC0000000000000000000000000000000000001\nNonce: n0nce\nIssued: 2026-09-09T18:00:00.000Z");
  assert.equal(looksLikeJwt("sk_perkos_abc"), false);
  assert.equal(looksLikeJwt("aaa.bbb.ccc"), true);
});

test("protected resource metadata names the issuer and the stack scopes", async () => {
  const { protectedResourceMetadata, bearerChallenge } = await import("../lib/agents/oauth.ts");
  const prm = protectedResourceMetadata();
  assert.equal(prm.resource, RESOURCE);
  assert.deepEqual(prm.authorization_servers, [ISSUER]);
  assert.deepEqual(prm.scopes_supported, ["stack:read", "stack:write"]);
  assert.deepEqual(prm.bearer_methods_supported, ["header"]);
  assert.equal(bearerChallenge(), `Bearer resource_metadata="${RESOURCE}/.well-known/oauth-protected-resource"`);
});

test("verifies a token the issuer minted for this resource and maps its claims", async () => {
  const { verifyAccessToken } = await import("../lib/agents/oauth.ts");
  const { privateKey, jwks, kid } = await issuerKeys();
  const wallet = "0x00000000000000000000000000000000000000aa";
  const token = await mint({ scope: "stack:read stack:write", role: "agent", agent_id: "agent_1" }, { key: privateKey, kid });
  // subject is set separately: the issuer lowercases it
  const { SignJWT } = await import("jose");
  const now = Math.floor(Date.now() / 1000);
  const withSub = await new SignJWT({ scope: "stack:read stack:write", role: "agent", agent_id: "agent_1" })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setIssuer(ISSUER).setAudience(RESOURCE).setSubject(wallet).setIssuedAt(now).setExpirationTime(now + 900).sign(privateKey);
  const v = await verifyAccessToken(withSub, { jwks });
  assert.ok(v, "token should verify");
  assert.equal(v.walletAddress, wallet);
  assert.equal(v.agentId, "agent_1");
  assert.deepEqual(v.scopes, ["read", "write"]);
  assert.ok(v.expiresAt > now);
  // no subject → not a wallet token → rejected
  assert.equal(await verifyAccessToken(token, { jwks }), null);
});

test("rejects tokens for another audience, another issuer, an expired one, or an unknown key", async () => {
  const { verifyAccessToken } = await import("../lib/agents/oauth.ts");
  const { privateKey, jwks, kid } = await issuerKeys();
  const { SignJWT } = await import("jose");
  const wallet = "0x00000000000000000000000000000000000000bb";
  const now = Math.floor(Date.now() / 1000);
  const build = (aud, iss, exp) =>
    new SignJWT({ scope: "stack:read" }).setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
      .setIssuer(iss).setAudience(aud).setSubject(wallet).setIssuedAt(now).setExpirationTime(exp).sign(privateKey);
  assert.equal(await verifyAccessToken(await build("https://perkos.xyz", ISSUER, now + 900), { jwks }), null, "app token must not open Stack");
  assert.equal(await verifyAccessToken(await build(RESOURCE, "https://evil.example", now + 900), { jwks }), null);
  assert.equal(await verifyAccessToken(await build(RESOURCE, ISSUER, now - 10), { jwks }), null);
  const other = await issuerKeys();
  assert.equal(await verifyAccessToken(await build(RESOURCE, ISSUER, now + 900), { jwks: other.jwks }), null, "signature from an unknown key");
  assert.equal(await verifyAccessToken("not.a.jwt", { jwks }), null);
});
