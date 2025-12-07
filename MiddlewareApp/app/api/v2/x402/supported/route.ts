import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";

const x402Service = new X402Service();

export async function GET() {
  const result = x402Service.getSupported();
  return NextResponse.json(result);
}
