import { NextResponse } from "next/server";
import type { X402PaymentConfig } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config } from "@/lib/utils/config";

const x402Service = new X402Service();

export async function GET() {
  const paymentConfig: X402PaymentConfig = {
    version: 1,
    facilitator: config.facilitatorUrl,
    supportedSchemes: x402Service.getSupported().kinds,
    endpoints: {
      verify: `${config.facilitatorUrl}/api/v2/x402/verify`,
      settle: `${config.facilitatorUrl}/api/v2/x402/settle`,
      supported: `${config.facilitatorUrl}/api/v2/x402/supported`,
    },
  };

  return NextResponse.json(paymentConfig);
}
