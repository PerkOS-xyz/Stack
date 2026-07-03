import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  X401_HEADERS,
  buildProofRequest,
  parseProofResponse,
  buildProofResult,
} from "@/lib/x401/challenge";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * GET /api/v2/x401/demo
 * Reference x401-protected route. Without a `PROOF-RESPONSE` header it emits a
 * `PROOF-REQUEST` challenge (asking for organizational signing authority);
 * with one, it parses the presented proof.
 *
 * NOTE: full OID4VP Verifiable-Presentation verification (issuer signatures +
 * claim predicates + trust registry) is a follow-up — this returns
 * `verified: false` with the parsed presentation.
 */
export async function GET(req: NextRequest) {
  const proof = req.headers.get(X401_HEADERS.response);

  if (!proof) {
    const nonce = randomUUID();
    const challenge = buildProofRequest(
      [{ id: "org_authority", type_values: [["OrganizationalAffiliation"]] }],
      nonce
    );
    return new NextResponse(
      JSON.stringify({ error: "proof required", hint: `resend with the ${X401_HEADERS.response} header` }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", [X401_HEADERS.request]: challenge },
      }
    );
  }

  try {
    const presented = parseProofResponse(proof);
    return NextResponse.json(
      {
        ok: true,
        verified: false,
        note: "PROOF-RESPONSE parsed; OID4VP presentation verification is a follow-up.",
        presented,
      },
      { headers: corsHeaders }
    );
  } catch {
    return new NextResponse(JSON.stringify({ error: "invalid PROOF-RESPONSE" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        [X401_HEADERS.result]: buildProofResult("invalid_response", "PROOF-RESPONSE must be base64url JSON"),
      },
    });
  }
}
