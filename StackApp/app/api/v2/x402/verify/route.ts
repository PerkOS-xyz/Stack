import { NextRequest, NextResponse } from "next/server";
import type { X402VerifyRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getVerifyHeaders,
} from "@/lib/utils/x402-headers";
import {
  checkWalletRateLimit,
  recordWalletTransaction,
  extractPayerFromPayload,
  getRateLimitHeaders,
  createUnauthorizedResponse,
  createRateLimitExceededResponse,
} from "@/lib/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  console.log("\n" + "🔷".repeat(35));
  console.log(`🔵 [STACK] [${timestamp}] X402 VERIFY REQUEST ${requestId}`);
  console.log("🔷".repeat(35));

  try {
    // Clone request to read body for wallet extraction
    const clonedRequest = request.clone();
    const body = (await clonedRequest.json()) as X402VerifyRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    // Extract payer wallet from payment payload
    const payerWallet = extractPayerFromPayload(body);

    if (!payerWallet) {
      console.log("❌ Could not extract payer wallet from payload");
      console.log("🔷".repeat(35) + "\n");

      return NextResponse.json(
        {
          isValid: false,
          invalidReason: "Could not determine payer wallet from payment payload",
          payer: null,
        },
        { status: 400 }
      );
    }

    console.log("📥 Verify Request Details:");
    console.log("   Request ID:", requestId);
    console.log("   Payer Wallet:", payerWallet);
    console.log("   x402Version:", body.x402Version);
    console.log("   Payment Network:", network);
    console.log("   Payment Scheme:", scheme);
    console.log("   Requirements Network:", body.paymentRequirements?.network);
    console.log("   Pay To:", body.paymentRequirements?.payTo);
    console.log("   Max Amount:", body.paymentRequirements?.maxAmountRequired);

    // Check wallet subscription and rate limits
    console.log("\n🔐 Checking wallet subscription...");
    const rateLimitResult = await checkWalletRateLimit(
      payerWallet,
      "/v2/x402/verify",
      network
    );

    if (!rateLimitResult.allowed) {
      console.log("❌ Wallet check failed:", rateLimitResult.error);
      console.log("🔷".repeat(35) + "\n");

      if (rateLimitResult.error?.includes("not registered")) {
        return createUnauthorizedResponse(rateLimitResult.error);
      }
      return createRateLimitExceededResponse(rateLimitResult);
    }

    console.log("✅ Wallet authorized");
    console.log("   Plan:", rateLimitResult.subscription?.planId);
    console.log("   Remaining transactions:", rateLimitResult.rateLimit.remaining);

    // Re-read body for verification (original request)
    const originalBody = (await request.json()) as X402VerifyRequest;

    if (originalBody.paymentPayload?.payload) {
      const payload = originalBody.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("   Payload From:", authorization?.from || payload.from || "N/A");
      console.log("   Payload Value:", authorization?.value || payload.value || "N/A");
    }

    // Perform x402 verification
    const x402Service = new X402Service();
    const result = await x402Service.verify(originalBody);

    // Log result
    console.log("\n📤 Verify Result:");
    console.log("   Is Valid:", result.isValid);
    console.log("   Payer:", result.payer);
    if (!result.isValid) {
      console.log("   ❌ Invalid Reason:", result.invalidReason);
    }

    // Record successful verification transaction
    if (result.isValid) {
      console.log("\n📊 Recording transaction...");
      const recordResult = await recordWalletTransaction(
        payerWallet,
        "/v2/x402/verify",
        network
      );
      console.log("   Recorded:", recordResult.success);
      console.log("   Remaining:", recordResult.remaining);
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

    // Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult.rateLimit);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers[key] = value;
    }

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
