import { NextResponse } from "next/server";
import { config } from "@/lib/utils/config";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    deferredEnabled: config.deferredEnabled,
  });
}
