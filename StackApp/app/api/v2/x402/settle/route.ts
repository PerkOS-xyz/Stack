import { NextRequest, NextResponse } from "next/server";
import type { X402SettleRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getSettleHeaders,
  createV2Receipt,
} from "@/lib/utils/x402-headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  console.log("\n" + "💰".repeat(35));
  console.log(`🟢 [STACK] [${timestamp}] X402 SETTLE REQUEST ${requestId}`);
  console.log("💰".repeat(35));

  try {
    const x402Service = new X402Service();
    const body = (await request.json()) as X402SettleRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    // Log request details
    console.log("📥 Settle Request Details:");
    console.log("   Request ID:", requestId);
    console.log("   x402Version:", body.x402Version);
    console.log("   Payment Network:", network);
    console.log("   Payment Scheme:", scheme);
    console.log("   Requirements Network:", body.paymentRequirements?.network);
    console.log("   Pay To:", body.paymentRequirements?.payTo);
    console.log("   Max Amount:", body.paymentRequirements?.maxAmountRequired);
    console.log("   Resource:", typeof body.paymentRequirements?.resource === 'string'
      ? body.paymentRequirements.resource
      : JSON.stringify(body.paymentRequirements?.resource));

    // Extract payment details for receipt
    let paymentAmount: string | undefined;
    let paymentAsset: string | undefined;

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("   Payload From:", authorization?.from || payload.from || "N/A");
      console.log("   Payload Value:", authorization?.value || payload.value || "N/A");
      paymentAmount = String(authorization?.value || payload.value || "");
    }

    if (body.paymentRequirements?.asset) {
      paymentAsset = body.paymentRequirements.asset;
    }

    // Extract vendor domain from request headers for domain-based rules
    // Priority: 1) Origin header, 2) Referer header, 3) resource URL from paymentRequirements
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    let vendorDomain: string | undefined;

    if (origin) {
      try {
        const originUrl = new URL(origin);
        vendorDomain = originUrl.host; // Includes port if present
        console.log("   Vendor Domain (from Origin):", vendorDomain);
      } catch { /* ignore parse errors */ }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        vendorDomain = refererUrl.host;
        console.log("   Vendor Domain (from Referer):", vendorDomain);
      } catch { /* ignore parse errors */ }
    }

    // Fallback: Extract domain from resource URL in paymentRequirements
    // This handles server-to-server calls where Origin/Referer aren't present
    if (!vendorDomain && body.paymentRequirements?.resource) {
      try {
        // Import the helper to get the resource URL (handles both V1 string and V2 object)
        const { getResourceUrl } = await import("@/lib/types/x402");
        const resourceUrlStr = getResourceUrl(body.paymentRequirements);
        if (resourceUrlStr) {
          const resourceUrl = new URL(resourceUrlStr);
          vendorDomain = resourceUrl.host;
          console.log("   Vendor Domain (from resource):", vendorDomain);
        }
      } catch { /* ignore parse errors */ }
    }

    if (!vendorDomain) {
      console.log("   Vendor Domain: N/A");
    }
    console.log("\n⏳ Executing settlement...");
    const result = await x402Service.settle(body, vendorDomain);

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
