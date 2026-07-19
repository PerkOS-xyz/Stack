import { NextRequest, NextResponse } from "next/server";
import type { X402SettleRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getSettleHeaders,
  createV2Receipt,
} from "@/lib/utils/x402-headers";
import { verifyAgentIdentity, buildReputationFeedbackTx } from "@/lib/services/AgentIdentityService";
import type { SupportedNetwork } from "@/lib/utils/config";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { x402RequestSchema, validateBody } from "@/lib/validation/schemas";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";
import { normalizeX402Request } from "@/lib/utils/x402-normalization";
import { authenticateApiKey } from "@/lib/middleware/apiKeyAuth";
import { firebaseAdmin } from "@/lib/db/firebase";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  console.log(` [STACK] [${timestamp}] X402 SETTLE REQUEST ${requestId}`);

  // Rate limit: 30 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, 30, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { success: false, errorReason: "Rate limit exceeded. Try again later.", payer: null, transaction: null, network: "unknown" },
      { status: 429, headers: { ...corsHeaders, "Retry-After": "60", "X-Request-Id": requestId } }
    );
  }

  try {
    const x402Service = new X402Service();
    const rawBody = await request.json();

    // Validate input structure with Zod
    const validation = validateBody(x402RequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errorReason: validation.error, payer: null, transaction: null, network: "unknown" },
        { status: 400, headers: { ...corsHeaders, "X-Request-Id": requestId } }
      );
    }

    const body = normalizeX402Request(validation.data) as X402SettleRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload.network;
    const scheme = body.paymentPayload?.scheme || "exact";

    // Log request details
    console.log(" Settle Request Details:");
    console.log("Request ID:", requestId);
    console.log("x402Version:", body.x402Version);
    console.log("Payment Network:", network);
    console.log("Payment Scheme:", scheme);
    console.log("Requirements Network:", body.paymentRequirements?.network);
    console.log("Pay To:", body.paymentRequirements?.payTo);
    console.log("Max Amount:", body.paymentRequirements?.maxAmountRequired);
    console.log("Resource:", typeof body.paymentRequirements?.resource === 'string'
      ? body.paymentRequirements.resource
      : JSON.stringify(body.paymentRequirements?.resource));

    // Extract payment details for receipt
    let paymentAmount: string | undefined;
    let paymentAsset: string | undefined;

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("Payload From:", authorization?.from || payload.from || "N/A");
      console.log("Payload Value:", authorization?.value || payload.value || "N/A");
      paymentAmount = String(authorization?.value || payload.value || "");
    }

    if (body.paymentRequirements?.asset) {
      paymentAsset = body.paymentRequirements.asset;
    }

    // Domain sponsorship is authorization, not browser metadata. Origin,
    // Referer, and the caller-provided resource URL are forgeable, so only an
    // authenticated API key tied to a verified domain claim may activate it.
    let vendorDomain: string | undefined;
    if (request.headers.get("X-API-Key")) {
      const auth = await authenticateApiKey(request);
      if (!auth.agent) {
        return NextResponse.json(
          { success: false, errorReason: auth.error || "Invalid API key", payer: null, transaction: null, network },
          { status: 401, headers: { ...corsHeaders, "X-Request-Id": requestId } }
        );
      }
      try {
        const { getResourceUrl } = await import("@/lib/types/x402");
        const resourceUrlStr = getResourceUrl(body.paymentRequirements);
        if (resourceUrlStr) {
          const resourceHost = new URL(resourceUrlStr).hostname.toLowerCase();
          const { data: claims } = await firebaseAdmin
            .from("perkos_user_vendor_domains")
            .select("domain_url")
            .eq("user_wallet_address", auth.agent.walletAddress.toLowerCase())
            .eq("verification_status", "verified")
            .eq("is_active", true);
          const verified = claims?.some((claim) => {
            try {
              const value = String(claim.domain_url);
              const host = new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
              return host === resourceHost;
            } catch {
              return false;
            }
          });
          if (verified) vendorDomain = resourceHost;
        }
      } catch { /* ignore parse errors */ }
    }

    if (!vendorDomain) {
      console.log("Vendor Domain: N/A");
    }
    console.log("\n Executing settlement...");
    const result = await x402Service.settle(body, vendorDomain);

    // Log result
    console.log("\n Settle Result:");
    console.log("Success:", result.success);
    console.log("Payer:", result.payer);
    console.log("Network:", result.network);
    if (result.success) {
      console.log(" Transaction:", result.transaction);
    } else {
      console.log(" Error Reason:", result.errorReason);
    }

    // Optional ERC-8004 identity check and auto reputation feedback
    const agentId = request.headers.get("X-Agent-Id");
    let reputationTx = null;
    if (result.success && agentId && network !== "unknown") {
      const identity = await verifyAgentIdentity(agentId, network as SupportedNetwork);
      console.log(`    ERC-8004 Identity: agent=${agentId} exists=${identity.exists}`);
      if (identity.exists) {
        reputationTx = buildReputationFeedbackTx({
          network: network as SupportedNetwork,
          agentId,
          value: 1,
          valueDecimals: 0,
          tag1: "x402",
          tag2: "settlement",
          endpoint: typeof body.paymentRequirements?.resource === "string"
            ? body.paymentRequirements.resource : "",
        });
        if (reputationTx) {
          console.log(`    Reputation feedback tx prepared for agent ${agentId}`);
        }
      }
    }

    // Build V2 response headers
    const headers = getSettleHeaders({
      requestId,
      network: result.network || network,
      scheme,
      success: result.success,
      payer: result.payer,
      transaction: result.transaction,
    });

    headers["PAYMENT-RESPONSE"] = Buffer.from(JSON.stringify({
      success: result.success,
      ...(result.errorReason ? { errorReason: result.errorReason } : {}),
      ...(result.payer ? { payer: result.payer } : {}),
      transaction: result.transaction || "",
      network: result.network || network,
    })).toString("base64");

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

    // Enhanced V2 response with receipt and optional reputation tx
    const v2Response = {
      ...result,
      receipt,
      ...(reputationTx ? { reputationFeedback: reputationTx } : {}),
    };

    if (!result.success) {
      return NextResponse.json(v2Response, { status: 402, headers: { ...corsHeaders, ...headers } });
    }

    return NextResponse.json(v2Response, { headers: { ...corsHeaders, ...headers } });
  } catch (error) {
    console.log(
      "\n Settle Error:",
      error instanceof Error ? error.message : String(error)
    );

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
      { status: 400, headers: { ...corsHeaders, ...headers } }
    );
  }
}
