import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config } from "@/lib/utils/config";

export const dynamic = 'force-dynamic';

export async function GET() {
  const x402Service = new X402Service();
  return NextResponse.json({
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    url: config.facilitatorUrl,
    supportedSchemes: x402Service.getSupported().kinds,
    network: "avalanche",
    chainId: 43114,
    paymentToken: config.paymentToken,
  });
}
