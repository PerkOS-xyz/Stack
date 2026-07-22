import { NextRequest, NextResponse } from "next/server";
import { getX401Policy, getX401PublicOrigin, isX401Configured } from "@/lib/x401/config";
import { corsHeaders } from "@/lib/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = getX401PublicOrigin(request);
  const policy = getX401Policy();
  return NextResponse.json({
    scheme: "x401",
    version: "0.2.0",
    status: "draft",
    configured: isX401Configured(),
    sdk: "@proof.com/x401-node@0.3.0",
    requestMode: "openid4vp-v1-signed",
    credentialProfile: process.env.X401_CREDENTIAL_VERIFIER_URL ? "external-verifier" : "proof-sd-jwt-vc",
    endpoints: {
      requirements: `${origin}/api/v2/x401/requirements`,
      protectedExample: `${origin}/api/v2/x401/protected`,
      token: `${origin}/api/v2/x401/token`,
      jwks: `${origin}/.well-known/jwks.json`,
      did: `${origin}/.well-known/did.json`,
    },
    headers: {
      requirement: "PROOF-REQUEST",
      response: "PROOF-RESPONSE",
      result: "PROOF-RESULT",
    },
    policy: {
      requestId: policy.requestId,
      satisfiedRequirements: policy.satisfiedRequirements,
      agentBinding: "optional-not-enabled",
    },
    payment: {
      protocol: "x402",
      separation: "x401 proof never satisfies HTTP 402 payment",
    },
  }, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } });
}
