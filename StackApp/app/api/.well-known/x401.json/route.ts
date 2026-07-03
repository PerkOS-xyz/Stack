import { NextRequest, NextResponse } from "next/server";
import { X401_HEADERS, X401_VERSION } from "@/lib/x401/challenge";
import { corsHeaders } from "@/lib/utils/cors";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/x401.json
 * Discovery document advertising this facilitator's x401 (agent identity /
 * authorization) support — the identity rail alongside x402.
 */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  return NextResponse.json(
    {
      schemaVersion: "1.0.0",
      protocol: "x401",
      version: X401_VERSION,
      name: "PerkOS Stack — Agent Identity & Authorization",
      description: "HTTP proof-requirement (OID4VP / Verifiable Credentials). Complements x402 payments.",
      headers: X401_HEADERS,
      formats: ["jwt_vc_json", "sd-jwt", "mso_mdoc"],
      endpoints: { demo: `${baseUrl}/api/v2/x401/demo` },
      reference: "https://x401.proof.com/spec/latest",
      note: "Challenge emission + response parsing are live; full OID4VP Verifiable-Presentation verification (issuer trust) is a follow-up.",
    },
    { headers: corsHeaders }
  );
}
