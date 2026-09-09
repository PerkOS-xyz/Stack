/**
 * GET /.well-known/ucp/x402-handler.schema.json — the JSON Schema the UCP
 * profile points at. The profile references it, so it has to answer.
 */
import { NextResponse } from "next/server";
import { OAUTH_RESOURCE } from "@/lib/agents/oauth";
import { ucpHandlerSchema } from "@/lib/agents/ucp";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(JSON.stringify(ucpHandlerSchema(OAUTH_RESOURCE), null, 2), {
    status: 200,
    headers: { "Content-Type": "application/schema+json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
