/**
 * x401 — HTTP Proof Requirement Protocol (Proof, spec v0.2.0).
 * The identity/authorization complement to x402 ("x402 = how it pays; x401 =
 * who authorized"). Header-based, OID4VP/Verifiable-Credentials.
 *
 * Wire format (v0.2.0):
 *   - server challenge : `PROOF-REQUEST: <base64url-json>` (carries a DCQL query)
 *   - client proof     : `PROOF-RESPONSE: <base64url-json>` (a Verifiable Presentation)
 *   - failure signal   : `PROOF-RESULT: <base64url-json>` (error object)
 * HTTP status codes are decorative (401 common, not mandatory; 402 reserved for x402).
 *
 * SCOPE: this module builds spec-shaped challenges and parses responses. Full
 * OID4VP Verifiable-Presentation verification (issuer signatures + claim
 * predicates + an issuer trust registry) is a documented follow-up.
 *
 * Ref: https://x401.proof.com/spec/latest
 */

export const X401_HEADERS = {
  request: "PROOF-REQUEST",
  response: "PROOF-RESPONSE",
  result: "PROOF-RESULT",
} as const;

export const X401_VERSION = "0.2.0";

export interface X401ClaimRequirement {
  /** DCQL credential id */
  id: string;
  /** e.g. "jwt_vc_json" | "sd-jwt" | "mso_mdoc" */
  format?: string;
  /** DCQL meta.type_values */
  type_values?: string[][];
  /** DCQL claims predicates */
  claims?: unknown[];
}

function b64urlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function b64urlDecode<T = unknown>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

/**
 * Build the `PROOF-REQUEST` header value (base64url JSON) carrying a DCQL query
 * for the required credentials.
 */
export function buildProofRequest(requirements: X401ClaimRequirement[], nonce: string): string {
  const dcql_query = {
    credentials: requirements.map((r) => ({
      id: r.id,
      format: r.format ?? "jwt_vc_json",
      meta: { type_values: r.type_values ?? [] },
      ...(r.claims ? { claims: r.claims } : {}),
    })),
  };
  return b64urlEncode({
    protocol: "x401",
    version: X401_VERSION,
    nonce,
    // For signed requests `data` is a JWT; the plain object form is used here
    // (signed-JWT issuance is a follow-up).
    credential_requirements: { digital: { requests: [{ data: { dcql_query } }] } },
  });
}

/** Parse a `PROOF-RESPONSE` header value into its JSON object (shape only). */
export function parseProofResponse<T = unknown>(headerValue: string): T {
  return b64urlDecode<T>(headerValue);
}

/** Build a `PROOF-RESULT` header value (base64url JSON error object). */
export function buildProofResult(code: string, description: string): string {
  return b64urlEncode({ protocol: "x401", version: X401_VERSION, error: { code, description } });
}
