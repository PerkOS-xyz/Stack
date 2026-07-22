import { createHash, randomBytes } from "node:crypto";
import { SignJWT, importJWK, type JWK } from "jose";
import { verifier, type X401Payload } from "@proof.com/x401-node";
import {
  getX401ChallengeTtlSeconds,
  getX401ClientId,
  getX401Did,
  getX401Policy,
  getX401PublicOrigin,
  getX401SigningJwk,
  getX401SigningKeyId,
} from "./config.ts";
import { getX401ChallengeStore } from "./store.ts";
import type { X401ChallengeState, X401ChallengeStore, X401Policy } from "./types.ts";

export interface IssuedX401Challenge {
  payload: X401Payload;
  encoded: string;
  state: X401ChallengeState;
}

export function hashX401Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url");
}

async function signingKey() {
  return importJWK(getX401SigningJwk() as JWK, "ES256");
}

export async function getX401PublicJwk(): Promise<JWK> {
  const { d: _privateScalar, ...publicJwk } = getX401SigningJwk() as JWK;
  return {
    ...publicJwk,
    kid: getX401SigningKeyId(),
    alg: "ES256",
    use: "sig",
  };
}

export async function getX401DidDocument(request?: Request) {
  const did = getX401Did(request);
  const keyId = `${did}#${getX401SigningKeyId()}`;
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: did,
    verificationMethod: [{
      id: keyId,
      type: "JsonWebKey2020",
      controller: did,
      publicKeyJwk: await getX401PublicJwk(),
    }],
    authentication: [keyId],
    assertionMethod: [keyId],
  };
}

export async function issueX401Challenge(input: {
  resource: string;
  method: string;
  request?: Request;
  policy?: X401Policy;
  store?: X401ChallengeStore;
}): Promise<IssuedX401Challenge> {
  const policy = input.policy || getX401Policy();
  const store = input.store || getX401ChallengeStore();
  const origin = getX401PublicOrigin(input.request);
  const clientId = getX401ClientId(input.request);
  const ttlSeconds = getX401ChallengeTtlSeconds();
  const now = Math.floor(Date.now() / 1_000);
  const method = input.method.toUpperCase();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nonce = randomBytes(32).toString("base64url");
    const requestJwt = await new SignJWT({
      client_id: clientId,
      response_type: "vp_token",
      response_mode: "dc_api",
      nonce,
      dcql_query: policy.dcqlQuery,
      expected_origins: [origin],
      client_metadata: {
        vp_formats_supported: {
          "dc+sd-jwt": {
            "sd-jwt_alg_values": ["ES256"],
            "kb-jwt_alg_values": ["ES256"],
          },
        },
      },
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: `${getX401Did(input.request)}#${getX401SigningKeyId()}`,
        typ: "oauth-authz-req+jwt",
        client_id: clientId,
      })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .sign(await signingKey());

    const state: X401ChallengeState = {
      nonce,
      requestId: policy.requestId,
      resource: input.resource,
      method,
      satisfiedRequirements: policy.satisfiedRequirements,
      queryHash: hashX401Json(policy.dcqlQuery),
      issuedAt: now * 1_000,
      expiresAt: (now + ttlSeconds) * 1_000,
    };
    if (!(await store.issue(state))) continue;

    const payload = verifier.buildPayload({
      credentialRequirements: {
        digital: {
          requests: [{
            protocol: "openid4vp-v1-signed",
            data: { request: requestJwt },
          }],
        },
      },
      oauth: {
        token_endpoint: `${origin}/api/v2/x401/token`,
        resource: input.resource,
      },
      requestId: policy.requestId,
      satisfiedRequirements: policy.satisfiedRequirements,
    });
    return { payload, encoded: verifier.encodePayload(payload), state };
  }
  throw new Error("Could not allocate a unique x401 nonce");
}
