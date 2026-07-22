const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const test = require("node:test");

function configureX401() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  process.env.X401_SIGNING_PRIVATE_JWK = JSON.stringify(privateKey.export({ format: "jwk" }));
  process.env.X401_SIGNING_KEY_ID = "test-key";
  process.env.X401_PUBLIC_ORIGIN = "https://stack.test";
  process.env.X401_VERIFIER_DID = "did:web:stack.test";
  process.env.X401_STORE = "memory";
  process.env.X401_ALLOWED_RESOURCE_PREFIXES = "https://stack.test";
  process.env.X401_RESULT_ORIGINS = "https://stack.test";
}

const POLICY = {
  requestId: "test-authority-v1",
  satisfiedRequirements: ["urn:test:authority:v1"],
  dcqlQuery: {
    credentials: [{
      id: "authority",
      format: "dc+sd-jwt",
      meta: { vct_values: ["https://credentials.example/AuthorityCredentialV1"] },
    }],
  },
};

test("x401 Draft 0.2.0 emits an official payload with a verifiable signed OpenID4VP request", async () => {
  configureX401();
  const { agent } = await import("@proof.com/x401-node");
  const { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } = await import("jose");
  const { createMemoryX401ChallengeStore } = await import("../lib/x401/store.ts");
  const { getX401PublicJwk, issueX401Challenge } = await import("../lib/x401/request.ts");
  const store = createMemoryX401ChallengeStore();
  const issued = await issueX401Challenge({
    resource: "https://stack.test/api/v2/x401/protected",
    method: "POST",
    policy: POLICY,
    store,
  });
  const payload = agent.decodePayload(issued.encoded);
  assert.equal(payload.scheme, "x401");
  assert.equal(payload.version, "0.2.0");
  assert.equal(payload.request_id, POLICY.requestId);
  assert.equal(payload.oauth.token_endpoint, "https://stack.test/api/v2/x401/token");
  const entry = payload.credential_requirements.digital.requests[0];
  assert.equal(entry.protocol, "openid4vp-v1-signed");
  const requestJwt = entry.data.request;
  assert.equal(typeof requestJwt, "string");
  const header = decodeProtectedHeader(requestJwt);
  assert.equal(header.alg, "ES256");
  assert.equal(header.client_id, "decentralized_identifier:did:web:stack.test");
  const claims = decodeJwt(requestJwt);
  assert.equal(claims.nonce, issued.state.nonce);
  assert.equal(claims.response_mode, "dc_api");
  assert.deepEqual(claims.expected_origins, ["https://stack.test"]);
  await jwtVerify(requestJwt, await importJWK(await getX401PublicJwk(), "ES256"), {
    algorithms: ["ES256"],
  });
});

test("x401 validates a Result Artifact once and rejects nonce replay", async () => {
  configureX401();
  const { agent } = await import("@proof.com/x401-node");
  const { createMemoryX401ChallengeStore } = await import("../lib/x401/store.ts");
  const { issueX401Challenge } = await import("../lib/x401/request.ts");
  const { verifyX401Artifact } = await import("../lib/x401/result.ts");
  const store = createMemoryX401ChallengeStore();
  const issued = await issueX401Challenge({
    resource: "https://stack.test/api/v2/x401/protected",
    method: "GET",
    policy: POLICY,
    store,
  });
  const artifact = agent.buildResultArtifact({
    requestId: POLICY.requestId,
    credentialResult: { protocol: "openid4vp-v1-signed", data: { vp_token: "test-token" } },
  });
  const credentialVerifier = {
    verify: async () => ({ valid: true, nonce: issued.state.nonce, subject: "did:example:holder" }),
  };
  const access = await verifyX401Artifact({
    artifact,
    expectedResource: issued.state.resource,
    expectedMethod: "GET",
    verifier: credentialVerifier,
    store,
  });
  assert.equal(access.subject, "did:example:holder");
  await assert.rejects(
    verifyX401Artifact({ artifact, verifier: credentialVerifier, store }),
    /expired, unknown, or already consumed/,
  );
});

test("x401 verification tokens are short-lived and bound to resource plus method", async () => {
  configureX401();
  const { issueX401VerificationToken, verifyX401VerificationToken } = await import("../lib/x401/token.ts");
  const access = {
    subject: "did:example:holder",
    issuer: "https://issuer.example",
    credentialType: "AuthorityCredentialV1",
    challenge: {
      nonce: "nonce",
      requestId: POLICY.requestId,
      resource: "https://stack.test/api/v2/x401/protected",
      method: "POST",
      satisfiedRequirements: POLICY.satisfiedRequirements,
      queryHash: "query-hash",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 300_000,
    },
  };
  const issued = await issueX401VerificationToken(access);
  const claims = await verifyX401VerificationToken({
    token: issued.token,
    resource: access.challenge.resource,
    method: "POST",
  });
  assert.equal(claims.sub, access.subject);
  assert.deepEqual(claims.x401_satisfied_requirements, POLICY.satisfiedRequirements);
  await assert.rejects(
    verifyX401VerificationToken({ token: issued.token, resource: access.challenge.resource, method: "GET" }),
    /scope does not match/,
  );
  await assert.rejects(
    verifyX401VerificationToken({ token: issued.token, resource: "https://stack.test/other", method: "POST" }),
  );
});

test("x401 rejects oversized, combined and expired by-reference proof responses", async () => {
  configureX401();
  const { agent } = await import("@proof.com/x401-node");
  const { decodeX401ResultArtifact, verifyX401Artifact } = await import("../lib/x401/result.ts");
  assert.throws(() => decodeX401ResultArtifact("a".repeat(65 * 1_024)), /64 KiB/);
  assert.throws(() => decodeX401ResultArtifact("abc,def"), /exactly one value/);
  const artifact = agent.buildResultArtifactReference({
    credentialResultUri: "https://stack.test/results/one",
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  await assert.rejects(verifyX401Artifact({ artifact }), /expired/);
});

test("public CORS metadata exposes and accepts the x401 protocol headers", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const source = await readFile(join(__dirname, "../lib/utils/cors.ts"), "utf8");
  assert.match(source, /Access-Control-Allow-Headers[^\n]+PROOF-RESPONSE/);
  assert.match(source, /Access-Control-Expose-Headers[^\n]+PROOF-REQUEST/);
  assert.match(source, /Access-Control-Expose-Headers[^\n]+PROOF-RESULT/);
});

test("x401 resource allowlisting compares parsed origins instead of unsafe string prefixes", async () => {
  configureX401();
  const { assertX401ResourceAllowed } = await import("../lib/x401/config.ts");
  assert.equal(
    assertX401ResourceAllowed("https://stack.test/api/v2/x401/protected").origin,
    "https://stack.test",
  );
  assert.throws(
    () => assertX401ResourceAllowed("https://stack.test.evil.example/steal"),
    /not allowlisted/,
  );
});
