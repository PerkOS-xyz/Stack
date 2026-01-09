import { NextRequest, NextResponse } from "next/server";
import type { X402SettleRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getSettleHeaders,
  createV2Receipt,
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

  console.log("\n" + "💰".repeat(35));
  console.log(`🟢 [STACK] [${timestamp}] X402 SETTLE REQUEST ${requestId}`);
  console.log("💰".repeat(35));

  try {
    // Clone request to read body for wallet extraction
    const clonedRequest = request.clone();
    const body = (await clonedRequest.json()) as X402SettleRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    // Extract payer wallet from payment payload
    const payerWallet = extractPayerFromPayload(body);

    if (!payerWallet) {
      console.log("❌ Could not extract payer wallet from payload");
      console.log("💰".repeat(35) + "\n");

      const headers = getSettleHeaders({
        requestId,
        network,
        scheme,
        success: false,
      });

      return NextResponse.json(
        {
          success: false,
          errorReason: "Could not determine payer wallet from payment payload",
          payer: null,
          transaction: null,
          network,
        },
        { status: 400, headers }
      );
    }

    console.log("📥 Settle Request Details:");
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
      "/v2/x402/settle",
      network
    );

    if (!rateLimitResult.allowed) {
      console.log("❌ Wallet check failed:", rateLimitResult.error);
      console.log("💰".repeat(35) + "\n");

      if (rateLimitResult.error?.includes("not registered")) {
        return createUnauthorizedResponse(rateLimitResult.error);
      }
      return createRateLimitExceededResponse(rateLimitResult);
    }

    console.log("✅ Wallet authorized");
    console.log("   Plan:", rateLimitResult.subscription?.planId);
    console.log("   Remaining transactions:", rateLimitResult.rateLimit.remaining);

    // Extract payment details for receipt
    let paymentAmount: string | undefined;
    let paymentAsset: string | undefined;

    // Re-read body for settlement (original request)
    const originalBody = (await request.json()) as X402SettleRequest;

    if (originalBody.paymentPayload?.payload) {
      const payload = originalBody.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("   Payload From:", authorization?.from || payload.from || "N/A");
      console.log("   Payload Value:", authorization?.value || payload.value || "N/A");
      paymentAmount = String(authorization?.value || payload.value || "");
    }

    if (originalBody.paymentRequirements?.asset) {
      paymentAsset = originalBody.paymentRequirements.asset;
    }

    console.log("\n⏳ Executing settlement...");
    const x402Service = new X402Service();
    const result = await x402Service.settle(originalBody);

    // Log result
    console.log("\n📤 Settle Result:");
    console.log("   Success:", result.success);
    console.log("   Payer:", result.payer);
    console.log("   Network:", result.network);
    if (result.success) {
      console.log("   ✅ Transaction:", result.transaction);
    } else {
      console.log("   ❌ Error Reason:", result.errorReason);
    }

    // Record successful settlement transaction
    if (result.success) {
      console.log("\n📊 Recording transaction...");
      const recordResult = await recordWalletTransaction(
        payerWallet,
        "/v2/x402/settle",
        network
      );
      console.log("   Recorded:", recordResult.success);
      console.log("   Remaining:", recordResult.remaining);
    }

    console.log("💰".repeat(35) + "\n");

    // Build V2 response headers
    const headers = getSettleHeaders({
      requestId,
      network: result.network || network,
      scheme,
      success: result.success,
      payer: result.payer,
      transaction: result.transaction,
    });

    // Add rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult.rateLimit);
    for (const [key, value] of Object.entries(rateLimitHeaders)) {
      headers[key] = value;
    }

    // Create V2 receipt
    const receipt = createV2Receipt({
      requestId,
      network: result.network || network,
      scheme,
      success: result.success,
      payer: result.payer || null,
      transaction: result.transaction || null,
      amount: paymentAmount,
      asset: paymentAsset,
    });

    // Enhanced V2 response with receipt
    const v2Response = {
      ...result,
      receipt,
    };

    if (!result.success) {
      return NextResponse.json(v2Response, { status: 400, headers });
    }

    return NextResponse.json(v2Response, { headers });
  } catch (error) {
    console.log(
      "\n❌ Settle Error:",
      error instanceof Error ? error.message : String(error)
    );
    console.log("💰".repeat(35) + "\n");

    // Build error headers
    const headers = getSettleHeaders({
      requestId,
      network: "unknown",
      scheme: "exact",
      success: false,
    });

    // Create error receipt
    const receipt = createV2Receipt({
      requestId,
      network: "unknown",
      scheme: "exact",
      success: false,
      payer: null,
      transaction: null,
    });

    return NextResponse.json(
      {
        success: false,
        errorReason:
          error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: "unknown",
        receipt,
      },
      { status: 400, headers }
    );
  }
}
