import { createHash } from "node:crypto";
import { createVerifier } from "@proof.com/proof-vc-server";
import type { CredentialResult } from "@proof.com/x401-node";
import { z } from "zod";
import type { X401CredentialVerifier, X401VerificationFacts } from "./types.ts";

const remoteResultSchema = z.object({
  valid: z.boolean(),
  nonce: z.string().min(16).max(2_048).optional(),
  subject: z.string().min(1).max(1_024).optional(),
  issuer: z.string().min(1).max(2_048).optional(),
  credentialType: z.string().min(1).max(512).optional(),
  error: z.string().max(1_024).optional(),
}).strict();

function extractVpToken(result: CredentialResult): string {
  if (typeof result.data === "string") return result.data;
  if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
    const vpToken = result.data.vp_token;
    if (typeof vpToken === "string") return vpToken;
  }
  throw new Error("Credential Result does not contain a vp_token");
}

class ProofCredentialVerifier implements X401CredentialVerifier {
  async verify(result: CredentialResult, context: { verifierAudience: string }): Promise<X401VerificationFacts> {
    if (!result.protocol.startsWith("openid4vp-v1-")) {
      return { valid: false, error: "Unsupported credential result protocol" };
    }
    const encodedVPToken = extractVpToken(result);
    const trustRoot = process.env.X401_PROOF_TRUST_ROOT === "production" ? "production" : "development";
    const presentation = await createVerifier({ trustRoot }).verifyVPToken({
      encodedVPToken,
      aud: `origin:${context.verifierAudience}`,
    });
    const credentials = Object.values(presentation).flat();
    if (credentials.length === 0) return { valid: false, error: "Presentation contains no credentials" };
    const nonces = new Set(credentials.map((credential) => credential.getNonce()).filter(Boolean));
    if (nonces.size !== 1) return { valid: false, error: "Presentation nonce is missing or inconsistent" };
    const first = credentials[0];
    const claims = first.getClaims();
    const subject = typeof claims.sub === "string"
      ? claims.sub
      : `urn:sha256:${createHash("sha256").update(encodedVPToken).digest("hex")}`;
    return {
      valid: true,
      nonce: [...nonces][0],
      subject,
      issuer: typeof claims.iss === "string" ? claims.iss : "Proof",
      credentialType: String(first.credentialType()),
    };
  }
}

class RemoteCredentialVerifier implements X401CredentialVerifier {
  private readonly url: string;
  private readonly bearer?: string;

  constructor(url: string, bearer?: string) {
    this.url = url;
    this.bearer = bearer;
  }

  async verify(result: CredentialResult, context: { verifierAudience: string; requestId?: string }) {
    const response = await fetch(this.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
      },
      body: JSON.stringify({ credential_result: result, context }),
    });
    if (!response.ok) throw new Error(`Credential verifier returned HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 65_536) throw new Error("Credential verifier response is too large");
    return remoteResultSchema.parse(await response.json());
  }
}

export function getX401CredentialVerifier(): X401CredentialVerifier {
  const url = process.env.X401_CREDENTIAL_VERIFIER_URL;
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("X401_CREDENTIAL_VERIFIER_URL must use HTTPS outside localhost");
    }
    return new RemoteCredentialVerifier(parsed.toString(), process.env.X401_CREDENTIAL_VERIFIER_TOKEN);
  }
  return new ProofCredentialVerifier();
}

export { ProofCredentialVerifier, RemoteCredentialVerifier };
