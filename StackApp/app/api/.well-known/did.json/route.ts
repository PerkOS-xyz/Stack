import { NextRequest, NextResponse } from "next/server";
import { getX401DidDocument } from "@/lib/x401/request";
import { corsHeaders } from "@/lib/utils/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getX401DidDocument(request), {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "x401 DID is unavailable" }, {
      status: 503,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  }
}
