/**
 * GET /.well-known/oauth-protected-resource — RFC 9728.
 * Names the authorization server that issues tokens for THIS origin. Public
 * path is rewritten here by next.config.
 */
import { NextResponse } from "next/server";
import { protectedResourceMetadata } from "@/lib/agents/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(JSON.stringify(protectedResourceMetadata(), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
