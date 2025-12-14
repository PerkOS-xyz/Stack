import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";

export const dynamic = 'force-dynamic';

export async function GET() {
  const x402Service = new X402Service();
  const result = x402Service.getSupported();
  return NextResponse.json(result);
}
