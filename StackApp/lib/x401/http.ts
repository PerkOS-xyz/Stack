import { verifier } from "@proof.com/x401-node";
import { verifyX401Artifact, decodeX401ResultArtifact, X401_MAX_HEADER_BYTES } from "./result.ts";
import { verifyX401VerificationToken } from "./token.ts";
import type { X401VerifiedAccess } from "./types.ts";

export type X401Authorization =
  | { kind: "artifact"; access: X401VerifiedAccess }
  | { kind: "token"; subject: string; requestId: string; satisfiedRequirements: string[] };

function assertHeaderBounded(value: string) {
  if (Buffer.byteLength(value, "utf8") > X401_MAX_HEADER_BYTES) {
    throw new Error("PROOF-RESPONSE exceeds the 64 KiB limit");
  }
  if (value.includes(",")) throw new Error("PROOF-RESPONSE must contain exactly one value");
}

export async function authorizeX401Header(input: {
  proofResponse: string;
  resource: string;
  method: string;
  request?: Request;
}): Promise<X401Authorization> {
  assertHeaderBounded(input.proofResponse);
  try {
    const tokenObject = verifier.decodeTokenObject(input.proofResponse);
    const claims = await verifyX401VerificationToken({
      token: tokenObject.access_token,
      resource: input.resource,
      method: input.method,
      request: input.request,
    });
    return {
      kind: "token",
      subject: claims.sub || "",
      requestId: claims.x401_request_id,
      satisfiedRequirements: claims.x401_satisfied_requirements,
    };
  } catch (tokenError) {
    try {
      const artifact = decodeX401ResultArtifact(input.proofResponse);
      return {
        kind: "artifact",
        access: await verifyX401Artifact({
          artifact,
          expectedResource: input.resource,
          expectedMethod: input.method,
          request: input.request,
        }),
      };
    } catch (artifactError) {
      const tokenMessage = tokenError instanceof Error ? tokenError.message : "invalid token object";
      const artifactMessage = artifactError instanceof Error ? artifactError.message : "invalid result artifact";
      throw new Error(`Invalid x401 proof response: ${artifactMessage}; token path: ${tokenMessage}`);
    }
  }
}

export function x401ErrorHeader(error: string, description: string, requestId?: string): string {
  return verifier.encodeErrorObject(verifier.buildErrorObject({
    error,
    error_description: description,
    request_id: requestId,
  }));
}
