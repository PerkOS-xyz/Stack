import { NextRequest, NextResponse } from "next/server";
import type { X402VerifyRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getVerifyHeaders,
} from "@/lib/utils/x402-headers";
import { verifyAgentIdentity } from "@/lib/services/AgentIdentityService";
import type { SupportedNetwork } from "@/lib/utils/config";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { x402RequestSchema, validateBody } from "@/lib/validation/schemas";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  console.log(` [STACK] [${timestamp}] X402 VERIFY REQUEST ${requestId}`);

  // Rate limit: 30 requests per minute per IP
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, 30, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { isValid: false, invalidReason: "Rate limit exceeded. Try again later.", payer: null },
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
        { isValid: false, invalidReason: validation.error, payer: null },
        { status: 400, headers: { ...corsHeaders, "X-Request-Id": requestId } }
      );
    }

    const body = rawBody as X402VerifyRequest;

    // Extract network and scheme for headers
    const network = body.paymentPayload.network;
    const scheme = body.paymentPayload?.scheme || "exact";

    // Optional ERC-8004 identity verification
    const agentId = request.headers.get("X-Agent-Id");
    if (agentId && network !== "unknown") {
      const identity = await verifyAgentIdentity(agentId, network as SupportedNetwork);
      console.log(`    ERC-8004 Identity Check: agent=${agentId} exists=${identity.exists}`);
      if (identity.exists) {
        console.log(`    Agent Owner: ${identity.owner}`);
      }
      // Identity check is informational — does not block verification
    }

    // Log request details
    console.log(" Verify Request Details:");
    console.log("Request ID:", requestId);
    console.log("x402Version:", body.x402Version);
    console.log("Payment Network:", network);
    console.log("Payment Scheme:", scheme);
    console.log("Requirements Network:", body.paymentRequirements?.network);
    console.log("Pay To:", body.paymentRequirements?.payTo);
    console.log("Max Amount:", body.paymentRequirements?.maxAmountRequired);

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      console.log("Payload From:", authorization?.from || payload.from || "N/A");
      console.log("Payload Value:", authorization?.value || payload.value || "N/A");
    }

    const result = await x402Service.verify(body);

    // Log result
    console.log("\n Verify Result:");
    console.log("Is Valid:", result.isValid);
    console.log("Payer:", result.payer);
    if (!result.isValid) {
      console.log(" Invalid Reason:", result.invalidReason);
    }

    // Build V2 response headers
    const headers = getVerifyHeaders({
      requestId,
      network,
      scheme,
      isValid: result.isValid,
      payer: result.payer,
    });

    return NextResponse.json(result, { headers: { ...corsHeaders, ...headers } });
  } catch (error) {
    console.log(
      "\n Verify Error:",
      error instanceof Error ? error.message : String(error)
    );

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
      { status: 400, headers: { ...corsHeaders, ...headers } }
    );
  }
}
