import type { CredentialResult, JsonObject } from "@proof.com/x401-node";

export interface X401Policy {
  requestId: string;
  satisfiedRequirements: string[];
  dcqlQuery: JsonObject;
}

export interface X401ChallengeState {
  nonce: string;
  requestId: string;
  resource: string;
  method: string;
  satisfiedRequirements: string[];
  queryHash: string;
  issuedAt: number;
  expiresAt: number;
}

export interface X401VerificationFacts {
  valid: boolean;
  nonce?: string;
  subject?: string;
  issuer?: string;
  credentialType?: string;
  error?: string;
}

export interface X401CredentialVerifier {
  verify(result: CredentialResult, context: {
    verifierAudience: string;
    requestId?: string;
  }): Promise<X401VerificationFacts>;
}

export interface X401ChallengeStore {
  issue(challenge: X401ChallengeState): Promise<boolean>;
  consume(nonce: string): Promise<X401ChallengeState | null>;
}

export interface X401VerifiedAccess {
  subject: string;
  issuer?: string;
  credentialType?: string;
  challenge: X401ChallengeState;
}
