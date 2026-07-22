import { NextRequest, NextResponse } from "next/server";
import { verifier } from "@proof.com/x401-node";
import { decodeX401ResultArtifact, X401_MAX_HEADER_BYTES, verifyX401Artifact } from "@/lib/x401/result";
import { issueX401VerificationToken } from "@/lib/x401/token";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`x401-token:${getClientIp(request)}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429, headers: corsHeaders });
  }
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      throw new Error("Content-Type must be application/x-www-form-urlencoded");
    }
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > X401_MAX_HEADER_BYTES * 2) {
      throw new Error("Token exchange request is too large");
    }
    const exchange = verifier.parseTokenExchange(new URLSearchParams(body));
    const artifact = decodeX401ResultArtifact(exchange.subject_token);
    const access = await verifyX401Artifact({
      artifact,
      expectedResource: exchange.resource,
      request,
    });
    if (exchange.audience && exchange.audience !== access.challenge.resource) {
      throw new Error("OAuth audience does not match the challenged resource");
    }
    const issued = await issueX401VerificationToken(access, request);
    return NextResponse.json({
      access_token: issued.token,
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
      token_type: "Bearer",
      expires_in: issued.ttlSeconds,
      scope: "x401:proof",
      x401: {
        verifier_id: new URL(request.url).origin,
        request_id: access.challenge.requestId,
        satisfied_requirements: access.challenge.satisfiedRequirements,
        resource: access.challenge.resource,
        method: access.challenge.method,
        expires_at: issued.expiresAt,
      },
    }, {
      headers: { ...corsHeaders, "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    return NextResponse.json({
      error: "invalid_request",
      error_description: error instanceof Error ? error.message : "x401 token exchange failed",
    }, { status: 400, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  }
}
