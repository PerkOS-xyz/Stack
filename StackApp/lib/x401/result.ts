import type { CredentialResult, ResultArtifact } from "@proof.com/x401-node";
import { verifier } from "@proof.com/x401-node";
import { getX401CredentialVerifier } from "./credentialVerifier.ts";
import { getX401PublicOrigin, getX401ResultOrigins } from "./config.ts";
import { getX401ChallengeStore } from "./store.ts";
import type {
  X401ChallengeStore,
  X401CredentialVerifier,
  X401VerifiedAccess,
} from "./types.ts";

export const X401_MAX_HEADER_BYTES = 64 * 1_024;
export const X401_MAX_REFERENCED_RESULT_BYTES = 256 * 1_024;

export function decodeX401ResultArtifact(headerValue: string): ResultArtifact {
  if (Buffer.byteLength(headerValue, "utf8") > X401_MAX_HEADER_BYTES) {
    throw new Error("PROOF-RESPONSE exceeds the 64 KiB limit");
  }
  if (headerValue.includes(",")) throw new Error("PROOF-RESPONSE must contain exactly one value");
  return verifier.decodeResultArtifact(headerValue);
}

function isCredentialResult(value: unknown): value is CredentialResult {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).protocol === "string" &&
    (value as Record<string, unknown>).data !== undefined
  );
}

async function fetchReferencedResult(artifact: ResultArtifact, request?: Request): Promise<CredentialResult> {
  const rawUri = artifact.credential_result_uri;
  if (!rawUri) throw new Error("Missing credential_result_uri");
  if (artifact.expires_at) {
    const expiresAt = Date.parse(artifact.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) throw new Error("Credential result reference is expired");
  }
  const uri = new URL(rawUri);
  if (uri.protocol !== "https:") throw new Error("Credential result reference must use HTTPS");
  if (!getX401ResultOrigins(request).includes(uri.origin)) {
    throw new Error("Credential result origin is not allowlisted");
  }
  const response = await fetch(uri, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Credential result reference returned HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > X401_MAX_REFERENCED_RESULT_BYTES) throw new Error("Referenced credential result is too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > X401_MAX_REFERENCED_RESULT_BYTES) throw new Error("Referenced credential result is too large");
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isCredentialResult(value)) throw new Error("Referenced credential result has an invalid shape");
  return value;
}

export async function verifyX401Artifact(input: {
  artifact: ResultArtifact;
  expectedResource?: string;
  expectedMethod?: string;
  request?: Request;
  verifier?: X401CredentialVerifier;
  store?: X401ChallengeStore;
}): Promise<X401VerifiedAccess> {
  const credentialResult = input.artifact.credential_result || await fetchReferencedResult(input.artifact, input.request);
  const verification = await (input.verifier || getX401CredentialVerifier()).verify(credentialResult, {
    verifierAudience: getX401PublicOrigin(input.request),
    requestId: input.artifact.request_id,
  });
  if (!verification.valid) throw new Error(verification.error || "Credential result verification failed");
  if (!verification.nonce) throw new Error("Credential verifier did not return the OpenID4VP nonce");
  if (!verification.subject) throw new Error("Credential verifier did not return a subject binding");

  const challenge = await (input.store || getX401ChallengeStore()).consume(verification.nonce);
  if (!challenge) throw new Error("x401 nonce is expired, unknown, or already consumed");
  if (input.artifact.request_id && input.artifact.request_id !== challenge.requestId) {
    throw new Error("x401 request_id does not match the issued challenge");
  }
  if (input.expectedResource && input.expectedResource !== challenge.resource) {
    throw new Error("x401 proof is scoped to a different resource");
  }
  if (input.expectedMethod && input.expectedMethod.toUpperCase() !== challenge.method) {
    throw new Error("x401 proof is scoped to a different HTTP method");
  }
  return {
    subject: verification.subject,
    issuer: verification.issuer,
    credentialType: verification.credentialType,
    challenge,
  };
}
