import { randomUUID } from "node:crypto";
import { SignJWT, importJWK, jwtVerify, type JWK, type JWTPayload } from "jose";
import { getX401PublicJwk } from "./request.ts";
import {
  getX401PublicOrigin,
  getX401SigningJwk,
  getX401SigningKeyId,
  getX401TokenTtlSeconds,
} from "./config.ts";
import type { X401VerifiedAccess } from "./types.ts";

interface X401TokenClaims extends JWTPayload {
  method: string;
  resource: string;
  scope: string;
  x401_request_id: string;
  x401_satisfied_requirements: string[];
  x401_query_hash: string;
  credential_issuer?: string;
  credential_type?: string;
}

export async function issueX401VerificationToken(access: X401VerifiedAccess, request?: Request) {
  const origin = getX401PublicOrigin(request);
  const ttlSeconds = getX401TokenTtlSeconds();
  const now = Math.floor(Date.now() / 1_000);
  const claims: Omit<X401TokenClaims, keyof JWTPayload> & Record<string, unknown> = {
    method: access.challenge.method,
    resource: access.challenge.resource,
    scope: "x401:proof",
    x401_request_id: access.challenge.requestId,
    x401_satisfied_requirements: access.challenge.satisfiedRequirements,
    x401_query_hash: access.challenge.queryHash,
    ...(access.issuer ? { credential_issuer: access.issuer } : {}),
    ...(access.credentialType ? { credential_type: access.credentialType } : {}),
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: getX401SigningKeyId(), typ: "at+jwt" })
    .setIssuer(origin)
    .setSubject(access.subject)
    .setAudience(access.challenge.resource)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setJti(randomUUID())
    .sign(await importJWK(getX401SigningJwk() as JWK, "ES256"));
  return { token, ttlSeconds, expiresAt: new Date((now + ttlSeconds) * 1_000).toISOString() };
}

export async function verifyX401VerificationToken(input: {
  token: string;
  resource: string;
  method: string;
  request?: Request;
}) {
  const publicKey = await importJWK(await getX401PublicJwk(), "ES256");
  const { payload } = await jwtVerify(input.token, publicKey, {
    issuer: getX401PublicOrigin(input.request),
    audience: input.resource,
    algorithms: ["ES256"],
    typ: "at+jwt",
  });
  const claims = payload as X401TokenClaims;
  if (claims.resource !== input.resource || claims.method !== input.method.toUpperCase()) {
    throw new Error("x401 verification token scope does not match this request");
  }
  if (!Array.isArray(claims.x401_satisfied_requirements) || !claims.x401_request_id) {
    throw new Error("x401 verification token is missing proof-satisfaction claims");
  }
  return claims;
}
