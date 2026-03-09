import { NextRequest, NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config } from "@/lib/utils/config";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const x402Service = new X402Service();
  return NextResponse.json({
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    url: baseUrl,
    supportedSchemes: x402Service.getSupported().kinds,
    defaultNetwork: config.defaultNetwork,
    paymentTokens: config.paymentTokens,
    deferredEnabled: config.deferredEnabled,
    deferredEscrowAddresses: config.deferredEscrowAddresses,
  });
}
