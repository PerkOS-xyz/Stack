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

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const x402Service = new X402Service();
    const body = (await request.json()) as X402SettleRequest;

    const network = body.paymentPayload?.network || "unknown";
    const scheme = body.paymentPayload?.scheme || "exact";

    let paymentAmount: string | undefined;
    let paymentAsset: string | undefined;

    if (body.paymentPayload?.payload) {
      const payload = body.paymentPayload.payload as unknown as Record<string, unknown>;
      const authorization = payload.authorization as Record<string, unknown> | undefined;
      paymentAmount = String(authorization?.value || payload.value || "");
    }

    if (body.paymentRequirements?.asset) {
      paymentAsset = body.paymentRequirements.asset;
    }

    // Resolve vendor domain for domain-based rules
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    let vendorDomain: string | undefined;

    if (origin) {
      try { vendorDomain = new URL(origin).host; } catch { /* ignore */ }
    } else if (referer) {
      try { vendorDomain = new URL(referer).host; } catch { /* ignore */ }
    }

    if (!vendorDomain && body.paymentRequirements?.resource) {
      try {
        const { getResourceUrl } = await import("@/lib/types/x402");
        const resourceUrlStr = getResourceUrl(body.paymentRequirements);
        if (resourceUrlStr) {
          vendorDomain = new URL(resourceUrlStr).host;
        }
      } catch { /* ignore */ }
    }

    const result = await x402Service.settle(body, vendorDomain);

    // ERC-8004 reputation feedback on successful settlement
    const agentId = request.headers.get("X-Agent-Id");
    let reputationTx = null;
    if (result.success && agentId && network !== "unknown") {
      const identity = await verifyAgentIdentity(agentId, network as SupportedNetwork);
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
      }
    }

    const headers = getSettleHeaders({
      requestId,
      network: result.network || network,
      scheme,
      success: result.success,
      payer: result.payer,
      transaction: result.transaction,
    });

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

    const v2Response = {
      ...result,
      receipt,
      ...(reputationTx ? { reputationFeedback: reputationTx } : {}),
    };

    if (!result.success) {
      return NextResponse.json(v2Response, { status: 400, headers });
    }

    return NextResponse.json(v2Response, { headers });
  } catch (error) {
    console.error("[x402:settle]", requestId, error instanceof Error ? error.message : String(error));

    const headers = getSettleHeaders({
      requestId,
      network: "unknown",
      scheme: "exact",
      success: false,
    });

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
