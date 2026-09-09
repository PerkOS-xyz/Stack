/**
 * RFC 9727 API catalog. Public path: /.well-known/api-catalog (next.config rewrite).
 */
import { NextResponse } from "next/server";
import { apiCatalog } from "@/lib/agents/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(JSON.stringify(apiCatalog(), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/linkset+json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
