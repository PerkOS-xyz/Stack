import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { X402SettleRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = 'force-dynamic';

/**
 * Root-level /settle endpoint for x402-express compatibility
 * The x402 library expects endpoints at /verify and /settle on the facilitator URL
 */
export async function POST(request: NextRequest) {
  // Public facilitator endpoint — throttle per-IP to prevent settlement abuse / DoS.
  if (!rateLimit(getClientIp(request), 100, 60000).allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests", payer: null, transaction: null, network: null },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const timestamp = new Date().toISOString();
  const requestId = randomUUID();

  console.log('\n' + '💰'.repeat(35));
  console.log(`🟢 [STACK] [${timestamp}] X402 SETTLE REQUEST ${requestId} (root /settle)`);
  console.log('💰'.repeat(35));

  try {
    const x402Service = new X402Service();
    const body = await request.json() as X402SettleRequest;

    // Log request details
    console.log('📥 Settle Request Details:');
    console.log('   x402Version:', body.x402Version);
    console.log('   Payment Network:', body.paymentPayload?.network);
    console.log('   Payment Scheme:', body.paymentPayload?.scheme);
    console.log('   Requirements Network:', body.paymentRequirements?.network);
    console.log('   Pay To:', body.paymentRequirements?.payTo);
    console.log('   Max Amount:', body.paymentRequirements?.maxAmountRequired);

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as any;
      console.log('   Payload From:', payload.authorization?.from || payload.from || 'N/A');
      console.log('   Payload Value:', payload.authorization?.value || payload.value || 'N/A');
    }

    console.log('\n⏳ Executing settlement...');
    const result = await x402Service.settle(body);

    // Log result
    console.log('\n📤 Settle Result:');
    console.log('   Success:', result.success);
    console.log('   Payer:', result.payer);
    console.log('   Network:', result.network);
    if (result.success) {
      console.log('   ✅ Transaction:', result.transaction);
    } else {
      console.log('   ❌ Error Reason:', result.errorReason);
    }
    console.log('💰'.repeat(35) + '\n');

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.log('\n❌ Settle Error:', error instanceof Error ? error.message : String(error));
    console.log('💰'.repeat(35) + '\n');

    // x402 standard uses errorReason, not error
    return NextResponse.json(
      {
        success: false,
        errorReason: error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: "avalanche",
      },
      { status: 400 }
    );
  }
}
