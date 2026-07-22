import { NextRequest, NextResponse } from "next/server";
import { authorizeX401Header, x401ErrorHeader } from "@/lib/x401/http";
import { issueX401Challenge } from "@/lib/x401/request";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

async function protectedRoute(request: NextRequest) {
  if (!rateLimit(`x401-protected:${getClientIp(request)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  const url = new URL(request.url);
  const resource = `${url.origin}${url.pathname}`;
  const proofResponse = request.headers.get("proof-response");
  if (!proofResponse) {
    try {
      const challenge = await issueX401Challenge({ resource, method: request.method, request });
      return NextResponse.json({
        error: "proof_required",
        scheme: "x401",
        version: "0.2.0",
      }, {
        status: 401,
        headers: {
          ...corsHeaders,
          "PROOF-REQUEST": challenge.encoded,
          "Cache-Control": "no-store",
          Vary: "PROOF-RESPONSE",
        },
      });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "x401 is not configured",
      }, { status: 503, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }
  }
  try {
    const authorization = await authorizeX401Header({
      proofResponse,
      resource,
      method: request.method,
      request,
    });
    const subject = authorization.kind === "artifact" ? authorization.access.subject : authorization.subject;
    return NextResponse.json({
      authorized: true,
      scheme: "x401",
      version: "0.2.0",
      proofType: authorization.kind,
      subject,
    }, { headers: { ...corsHeaders, "Cache-Control": "no-store", Vary: "PROOF-RESPONSE" } });
  } catch (error) {
    const description = error instanceof Error ? error.message : "x401 verification failed";
    return NextResponse.json({ error: "invalid_proof", description }, {
      status: 401,
      headers: {
        ...corsHeaders,
        "PROOF-RESULT": x401ErrorHeader("invalid_result", description),
        "Cache-Control": "no-store",
        Vary: "PROOF-RESPONSE",
      },
    });
  }
}

export const GET = protectedRoute;
export const POST = protectedRoute;
