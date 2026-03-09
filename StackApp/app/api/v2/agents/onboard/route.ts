import { NextRequest, NextResponse } from "next/server";
import {
  type SupportedNetwork,
  getErc8004Registries,
  hasErc8004Registries,
  getPaymentToken,
  config,
} from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { verifyAgentIdentity } from "@/lib/services/AgentIdentityService";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * POST /api/v2/agents/onboard
 *
 * Unified onboarding: register ERC-8004 identity + configure x402 payment wallet.
 * Returns unsigned transaction for on-chain registration plus x402 configuration.
 *
 * Body:
 * - network: SupportedNetwork (required)
 * - tokenURI: Agent metadata URI (optional)
 * - metadata: Array of {metadataKey, metadataValue} (optional)
 * - agentId: Existing agent ID to check (optional — skips registration if exists)
 * - paymentReceiver: Address to receive x402 payments (optional, defaults to config)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { network, tokenURI, metadata, agentId, paymentReceiver } = body;

    if (!network) {
      return NextResponse.json(
        { error: "network parameter required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate optional fields
    if (agentId !== undefined && agentId !== null) {
      const parsed = Number(agentId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: "agentId must be a positive integer" },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    if (tokenURI !== undefined && tokenURI !== null) {
      try { new URL(tokenURI); } catch {
        return NextResponse.json(
          { error: "tokenURI must be a valid URL" },
          { status: 400, headers: corsHeaders }
        );
      }
    }
    if (paymentReceiver !== undefined && paymentReceiver !== null) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(paymentReceiver)) {
        return NextResponse.json(
          { error: "paymentReceiver must be a valid Ethereum address (0x + 40 hex chars)" },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const supportedNetwork = network as SupportedNetwork;

    if (!hasErc8004Registries(supportedNetwork)) {
      return NextResponse.json(
        { error: `ERC-8004 registries not deployed on ${network}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const chain = getChainByNetwork(supportedNetwork);
    if (!chain) {
      return NextResponse.json(
        { error: `Chain config not found for ${network}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const registries = getErc8004Registries(supportedNetwork);
    const paymentToken = getPaymentToken(supportedNetwork);

    // Check if agent already exists on-chain
    let alreadyRegistered = false;
    if (agentId) {
      const identity = await verifyAgentIdentity(agentId, supportedNetwork);
      alreadyRegistered = identity.exists;
    }

    // Build ERC-8004 registration transaction (if not already registered)
    let registrationTx = null;
    if (!alreadyRegistered) {
      const hasMetadata = metadata && metadata.length > 0;
      registrationTx = {
        to: registries.identity,
        network,
        function: tokenURI
          ? (hasMetadata ? "register(string,tuple[])" : "register(string)")
          : "register()",
        args: tokenURI
          ? (hasMetadata ? [tokenURI, metadata] : [tokenURI])
          : [],
        description: "Register as an agent in the ERC-8004 Identity Registry",
      };
    }

    // Derive base URL from the incoming request for correct host in any environment
    const baseUrl = new URL(request.url).origin;

    // Build x402 payment configuration
    const x402Config = {
      facilitator: baseUrl,
      payTo: paymentReceiver || config.paymentReceiver,
      network,
      asset: paymentToken,
      endpoints: {
        verify: `${baseUrl}/api/v2/x402/verify`,
        settle: `${baseUrl}/api/v2/x402/settle`,
        config: `${baseUrl}/api/v2/x402/config`,
        supported: `${baseUrl}/api/v2/x402/supported`,
      },
      schemes: ["exact", ...(config.deferredEnabled ? ["deferred"] : [])],
    };

    return NextResponse.json({
      success: true,
      alreadyRegistered,
      registration: registrationTx,
      x402: x402Config,
      erc8004: {
        identityRegistry: registries.identity,
        reputationRegistry: registries.reputation,
        network,
      },
      message: alreadyRegistered
        ? "Agent already registered. x402 config provided."
        : "Sign the registration transaction, then use x402 config for payments.",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error in POST /api/v2/agents/onboard:", error);
    return NextResponse.json(
      { error: "Failed to prepare onboarding" },
      { status: 500, headers: corsHeaders }
    );
  }
}
