import { NextResponse } from "next/server";
import { getX401PublicJwk } from "@/lib/x401/request";
import { corsHeaders } from "@/lib/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ keys: [await getX401PublicJwk()] }, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "x401 key is unavailable" }, {
      status: 503,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  }
}
