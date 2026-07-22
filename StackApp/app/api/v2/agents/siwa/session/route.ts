import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { verifyStackSiwaRequest } from "@/lib/siwa/verifyRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

async function session(request: NextRequest) {
  try {
    const result = await verifyStackSiwaRequest(request);
    return NextResponse.json(result, {
      status: result.valid ? 200 : 401,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "SIWA request verification failed" },
      { status: 503, headers: { ...corsHeaders, "Cache-Control": "no-store" } }
    );
  }
}

export const GET = session;
export const POST = session;
