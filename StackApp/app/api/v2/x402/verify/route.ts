import { NextRequest, NextResponse } from "next/server";
import type { X402VerifyRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getVerifyHeaders,
} from "@/lib/utils/x402-headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  console.log("\n" + "🔷".repeat(35));
  console.log(`🔵 [STACK] [${timestamp}] X402 VERIFY REQUEST ${requestId}`);
  console.log("🔷".repeat(35));

  try {
    const x402Service = new X402Service();
    const body = (await request.json()) as X402VerifyRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    // Log request details
    console.log("📥 Verify Request Details:");
    console.log("   Request ID:", requestId);
    console.log("   x402Version:", body.x402Version);
    console.log("   Payment Network:", network);
    console.log("   Payment Scheme:", scheme);
    console.log("   Requirements Network:", body.paymentRequirements?.network);
    console.log("   Pay To:", body.paymentRequirements?.payTo);
    console.log("   Max Amount:", body.paymentRequirements?.maxAmountRequired);

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("   Payload From:", authorization?.from || payload.from || "N/A");
      console.log("   Payload Value:", authorization?.value || payload.value || "N/A");
    }

    const result = await x402Service.verify(body);

    // Log result
    console.log("\n📤 Verify Result:");
    console.log("   Is Valid:", result.isValid);
    console.log("   Payer:", result.payer);
    if (!result.isValid) {
      console.log("   ❌ Invalid Reason:", result.invalidReason);
    }
    console.log("🔷".repeat(35) + "\n");

    // Build V2 response headers
    const headers = getVerifyHeaders({
      requestId,
      network,
      scheme,
      isValid: result.isValid,
      payer: result.payer,
    });

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.log(
      "\n❌ Verify Error:",
      error instanceof Error ? error.message : String(error)
    );
    console.log("🔷".repeat(35) + "\n");

    // Build error headers
    const headers = getVerifyHeaders({
      requestId,
      network: "unknown",
      scheme: "exact",
      isValid: false,
    });

    return NextResponse.json(
      {
        isValid: false,
        invalidReason:
          error instanceof Error ? error.message : "Verification failed",
        payer: null,
      },
      { status: 400, headers }
    );
  }
}
