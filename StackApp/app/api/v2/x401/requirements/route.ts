import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertX401ResourceAllowed } from "@/lib/x401/config";
import { issueX401Challenge } from "@/lib/x401/request";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  resource: z.string().url().max(2_048),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
}).strict();

export async function OPTIONS() {
  return corsOptions();
}

async function respond(request: NextRequest, raw: unknown) {
  if (!rateLimit(`x401-requirement:${getClientIp(request)}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  try {
    const input = inputSchema.parse(raw);
    const resource = assertX401ResourceAllowed(input.resource, request).toString();
    const challenge = await issueX401Challenge({ resource, method: input.method, request });
    return NextResponse.json({
      scheme: "x401",
      version: "0.2.0",
      requestId: challenge.state.requestId,
      expiresAt: new Date(challenge.state.expiresAt).toISOString(),
    }, {
      status: 401,
      headers: {
        ...corsHeaders,
        "PROOF-REQUEST": challenge.encoded,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not issue x401 requirement" },
      { status: 400, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  return respond(request, {
    resource: url.searchParams.get("resource"),
    method: url.searchParams.get("method") || "GET",
  });
}

export async function POST(request: NextRequest) {
  return respond(request, await request.json());
}
