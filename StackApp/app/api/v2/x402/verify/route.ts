import { NextRequest, NextResponse } from "next/server";
import type { X402VerifyRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import {
  generateRequestId,
  getVerifyHeaders,
} from "@/lib/utils/x402-headers";
import { verifyAgentIdentity } from "@/lib/services/AgentIdentityService";
import type { SupportedNetwork } from "@/lib/utils/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const x402Service = new X402Service();
    const body = (await request.json()) as X402VerifyRequest;

    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    const agentId = request.headers.get("X-Agent-Id");
    if (agentId && network !== "unknown") {
      await verifyAgentIdentity(agentId, network as SupportedNetwork);
    }

    const result = await x402Service.verify(body);

    const headers = getVerifyHeaders({
      requestId,
      network,
      scheme,
      isValid: result.isValid,
      payer: result.payer,
    });

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("[x402:verify]", requestId, error instanceof Error ? error.message : String(error));

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
