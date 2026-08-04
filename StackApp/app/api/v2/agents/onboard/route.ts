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
import { agentOnboardSchema, validateBody } from "@/lib/validation/schemas";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts/erc8004";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { isAgentReadyNetwork } from "@/lib/utils/network-capabilities";
import { SCHEME_EXACT, SCHEME_DEFERRED } from "@/lib/utils/x402-schemes";

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
    const validation = validateBody(agentOnboardSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: corsHeaders });
    }
    const { network, tokenURI, metadata, agentId, paymentReceiver } = validation.data;

    if (!isAgentReadyNetwork(network)) {
      return NextResponse.json(
        { error: `${network} is not agent-ready. Stack requires both x402 exact payments and an official ERC-8004 Identity Registry.` },
        { status: 400, headers: corsHeaders }
      );
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
    if (agentId !== undefined) {
      const identity = await verifyAgentIdentity(agentId, supportedNetwork);
      alreadyRegistered = identity.exists;
    }

    // Build ERC-8004 registration transaction (if not already registered)
    let registrationTx = null;
    if (!alreadyRegistered) {
      const hasMetadata = Boolean(metadata?.length);
      let data: Hex;
      if (tokenURI && hasMetadata) {
        data = encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [tokenURI, metadata!.map((entry) => ({
            metadataKey: entry.metadataKey,
            metadataValue: entry.metadataValue as Hex,
          }))],
        });
      } else if (tokenURI) {
        data = encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [tokenURI],
        });
      } else {
        data = encodeFunctionData({
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [],
        });
      }

      registrationTx = {
        to: registries.identity as Address,
        data,
        value: "0",
        chainId: chain.id,
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
      schemes: [SCHEME_EXACT, ...(config.deferredEnabled ? [SCHEME_DEFERRED] : [])],
    };

    return NextResponse.json({
      success: true,
      alreadyRegistered,
      registration: registrationTx,
      x402: x402Config,
      erc8004: {
        identityRegistry: registries.identity,
        reputationRegistry: registries.reputation,
        registry: `eip155:${chain.id}:${registries.identity}`,
        chainId: chain.id,
        network,
        registryExplorer: chain.blockExplorers?.default
          ? `${chain.blockExplorers.default.url}/address/${registries.identity}`
          : null,
        indexer: {
          name: "8004scan",
          statusEndpoint: `${baseUrl}/api/v2/agents/discovery?chainId=${chain.id}${agentId !== undefined ? `&agentId=${agentId}` : ""}`,
          note: "8004scan indexes the official registry automatically after the mint is confirmed and its agentURI is publicly resolvable.",
        },
      },
      wallet: {
        onchainAgentWallet: "The registry initializes agentWallet to the transaction signer.",
        x402PaymentReceiver: paymentReceiver || config.paymentReceiver,
        requiresWalletProof: Boolean(paymentReceiver),
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
