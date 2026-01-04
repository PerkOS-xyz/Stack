import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { getBaseHeaders } from "@/lib/utils/x402-headers";

export const dynamic = 'force-dynamic';

export async function GET() {
  const x402Service = new X402Service();
  const result = x402Service.getSupported();

  // Build x402 V2 compliant headers
  const headers = {
    ...getBaseHeaders(),
    "X-x402-Supported-Schemes": result.kinds.map(k => k.scheme).filter((v, i, a) => a.indexOf(v) === i).join(","),
    "X-x402-Supported-Networks": result.kinds.map(k => k.network).filter((v, i, a) => a.indexOf(v) === i).join(","),
  };

  return NextResponse.json(result, { headers });
}
