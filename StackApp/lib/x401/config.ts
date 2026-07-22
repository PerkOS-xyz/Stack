import { DCQL_QUERY_BASIC } from "@proof.com/proof-vc-common";
import type { JsonObject } from "@proof.com/x401-node";
import type { X401Policy } from "./types.ts";

const DEFAULT_REQUEST_ID = "perkos-proof-identity-basic-v1";
const DEFAULT_REQUIREMENT = "urn:perkos:x401:satisfaction:proof-identity-basic:v1";

function integerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function jsonObjectEnv(name: string): JsonObject | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return parsed as JsonObject;
}

export function getX401PublicOrigin(request?: Request): string {
  const configured = process.env.X401_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  const origin = configured || (request ? new URL(request.url).origin : "https://stack.perkos.xyz");
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("X401_PUBLIC_ORIGIN must use HTTPS outside localhost");
  }
  return parsed.origin;
}

export function getX401Did(request?: Request): string {
  const hostname = new URL(getX401PublicOrigin(request)).hostname;
  return process.env.X401_VERIFIER_DID || `did:web:${hostname}`;
}

export function getX401ClientId(request?: Request): string {
  return `decentralized_identifier:${getX401Did(request)}`;
}

export function getX401Policy(): X401Policy {
  const dcqlQuery = jsonObjectEnv("X401_DCQL_QUERY_JSON") || (DCQL_QUERY_BASIC as unknown as JsonObject);
  const satisfiedRequirements = (process.env.X401_SATISFIED_REQUIREMENTS || DEFAULT_REQUIREMENT)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (satisfiedRequirements.length === 0) throw new Error("X401_SATISFIED_REQUIREMENTS cannot be empty");
  return {
    requestId: process.env.X401_REQUEST_ID || DEFAULT_REQUEST_ID,
    satisfiedRequirements,
    dcqlQuery,
  };
}

export function getX401ChallengeTtlSeconds(): number {
  return integerEnv("X401_CHALLENGE_TTL_SECONDS", 300, 30, 1_800);
}

export function getX401TokenTtlSeconds(): number {
  return integerEnv("X401_TOKEN_TTL_SECONDS", 300, 30, 3_600);
}

export function getX401SigningJwk(): JsonWebKey {
  const raw = process.env.X401_SIGNING_PRIVATE_JWK;
  if (!raw) throw new Error("X401_SIGNING_PRIVATE_JWK is not configured");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("X401_SIGNING_PRIVATE_JWK must be a private EC JWK");
  }
  const jwk = parsed as JsonWebKey;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
    throw new Error("X401_SIGNING_PRIVATE_JWK must be an EC P-256 private JWK");
  }
  return jwk;
}

export function getX401SigningKeyId(): string {
  return process.env.X401_SIGNING_KEY_ID || "x401-es256-1";
}

export function getX401AllowedResourcePrefixes(request?: Request): string[] {
  const configured = process.env.X401_ALLOWED_RESOURCE_PREFIXES;
  const values = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [getX401PublicOrigin(request)];
  return values.map((value) => new URL(value).toString());
}

export function assertX401ResourceAllowed(resource: string, request?: Request): URL {
  const parsed = new URL(resource);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("x401 resource must use HTTPS outside localhost");
  }
  const allowed = getX401AllowedResourcePrefixes(request).some((prefix) => {
    const candidate = new URL(prefix);
    return parsed.origin === candidate.origin && parsed.pathname.startsWith(candidate.pathname);
  });
  if (!allowed) {
    throw new Error("x401 resource is not allowlisted");
  }
  parsed.hash = "";
  return parsed;
}

export function getX401ResultOrigins(request?: Request): string[] {
  const configured = process.env.X401_RESULT_ORIGINS;
  return (configured ? configured.split(",") : [getX401PublicOrigin(request)])
    .map((value) => new URL(value.trim()).origin);
}

export function isX401Configured(): boolean {
  return Boolean(process.env.X401_SIGNING_PRIVATE_JWK);
}
