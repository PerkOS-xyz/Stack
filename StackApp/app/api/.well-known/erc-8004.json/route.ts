import { NextResponse } from "next/server";
import { config, type SupportedNetwork, getErc8004Registries, hasErc8004Registries } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { supabase } from "@/lib/db/supabase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/**
 * ERC-8004: Agent Registration File
 * Standard endpoint: /.well-known/erc-8004.json
 *
 * Provides agent registration data per ERC-8004 specification.
 * This file is pointed to by the Identity Registry tokenURI.
 *
 * @see https://eips.ethereum.org/EIPS/eip-8004
 * @see https://8004.org/spec
 */
export async function GET() {
  const x402Service = new X402Service();
  const supportedKinds = x402Service.getSupported().kinds;

  // Fetch live reputation stats from database
  let reputationStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    totalVolume: "0",
    successRate: 100,
    averageRating: 0,
    lastUpdated: new Date().toISOString(),
  };

  try {
    // Get transaction stats
    const { count: totalTx } = await supabase
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true });

    const { count: successTx } = await supabase
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");

    const { data: volumeData } = await supabase
      .from("perkos_x402_transactions")
      .select("amount_usd")
      .eq("status", "success");

    const totalVolumeUsd =
      volumeData?.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0) || 0;

    // Get average rating from reviews if available
    const { data: reviewData } = await supabase
      .from("perkos_reviews")
      .select("rating");

    const avgRating = reviewData?.length
      ? reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length
      : 0;

    reputationStats = {
      totalTransactions: totalTx || 0,
      successfulTransactions: successTx || 0,
      totalVolume: totalVolumeUsd.toFixed(2),
      successRate: totalTx ? Math.round(((successTx || 0) / totalTx) * 100) : 100,
      averageRating: Math.round(avgRating * 10) / 10,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch reputation stats:", error);
  }

  // Build registrations array (ERC-8004 format)
  // Each network where we have deployed registries gets an entry
  const registrations: Array<{
    chainId: string;  // CAIP-2 format
    registryAddress: string;
    agentId: string | null;
    tokenURI: string;
  }> = [];

  // Check each network for deployed registries
  for (const kind of supportedKinds) {
    const network = kind.network as SupportedNetwork;
    const chainId = getChainId(network);

    if (chainId && hasErc8004Registries(network)) {
      const registryInfo = getErc8004Registries(network);
      registrations.push({
        chainId: `eip155:${chainId}`,  // CAIP-2 format
        registryAddress: registryInfo.identity || "",
        agentId: null,  // Will be set when agent registers on-chain
        tokenURI: `${config.facilitatorUrl}/api/.well-known/erc-8004.json`,
      });
    }
  }

  // Build endpoints object per ERC-8004 spec
  const endpoints = {
    // Primary communication endpoints
    a2a: `${config.facilitatorUrl}/api/v2/x402`,  // Agent-to-Agent messaging
    mcp: null as string | null,  // Model Context Protocol endpoint

    // Identity endpoints
    ens: null as string | null,  // ENS name (e.g., "perkos.eth")
    did: null as string | null,  // Decentralized Identifier

    // Payment endpoint
    wallet: config.paymentReceiver,

    // Discovery endpoints
    discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
    agentCard: `${config.facilitatorUrl}/api/.well-known/agent-card.json`,
  };

  // Build supportedTrust array per ERC-8004 spec
  const supportedTrust: Array<{
    type: string;
    description: string;
    enabled: boolean;
    config?: Record<string, unknown>;
  }> = [
    {
      type: "reputation",
      description: "On-chain feedback via Reputation Registry with cryptographic signatures",
      enabled: true,
      config: {
        reputationRegistries: Object.fromEntries(
          supportedKinds
            .filter(k => hasErc8004Registries(k.network as SupportedNetwork))
            .map(k => {
              const network = k.network as SupportedNetwork;
              const chainId = getChainId(network);
              const registries = getErc8004Registries(network);
              return [`eip155:${chainId}`, registries.reputation];
            })
        ),
      },
    },
    {
      type: "validation",
      description: "Third-party validator attestations via Validation Registry",
      enabled: true,
      config: {
        validationRegistries: Object.fromEntries(
          supportedKinds
            .filter(k => hasErc8004Registries(k.network as SupportedNetwork))
            .map(k => {
              const network = k.network as SupportedNetwork;
              const chainId = getChainId(network);
              const registries = getErc8004Registries(network);
              return [`eip155:${chainId}`, registries.validation];
            })
        ),
        minimumStake: "0.1",  // Native token
        attestationTypes: [
          "security-audit",
          "performance-verified",
          "api-compliance",
          "uptime-verified",
        ],
      },
    },
    {
      type: "cryptoeconomic",
      description: "Stake-secured validation for critical operations",
      enabled: false,
    },
    {
      type: "tee-attestation",
      description: "Trusted Execution Environment verification",
      enabled: false,
    },
  ];

  // ERC-8004 Agent Registration File format
  const agentRegistration = {
    // === Required ERC-8004 Fields ===

    // Agent type classification
    type: "service",  // Options: service, autonomous, hybrid

    // Human-readable name
    name: config.facilitatorName,

    // Agent description
    description: config.facilitatorDescription,

    // Communication endpoints
    endpoints,

    // On-chain registrations (one per chain where registered)
    registrations,

    // Supported trust mechanisms
    supportedTrust,

    // === Extended Metadata ===

    // Visual identity
    image: `${config.facilitatorUrl}/logo.png`,
    icon: `${config.facilitatorUrl}/icon.png`,

    // Agent identifier (wallet address)
    agentId: config.paymentReceiver,

    // Primary URL
    url: config.facilitatorUrl,

    // Capabilities (x402 specific)
    capabilities: [
      "x402-v2",                    // x402 V2 protocol
      "x402-payment-exact",          // EIP-3009 exact payments
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []),
      "erc-8004-discovery",          // Agent discovery
      "erc-8004-reputation",         // Reputation registry
      "erc-8004-validation",         // Validation registry
      "multi-chain-support",         // Multiple networks
      "bazaar-indexable",            // Bazaar discovery
      "gasless-transactions",        // Sponsored gas
    ],

    // Payment methods with CAIP-2 chain IDs
    paymentMethods: supportedKinds.map((kind) => ({
      scheme: kind.scheme,
      network: kind.network,
      asset: config.paymentTokens[kind.network as SupportedNetwork],
      chainId: `eip155:${getChainId(kind.network)}`,  // CAIP-2 format
    })),

    // Networks summary
    networks: {
      mainnet: supportedKinds
        .filter((k) => !isTestnet(k.network))
        .map((k) => k.network),
      testnet: supportedKinds
        .filter((k) => isTestnet(k.network))
        .map((k) => k.network),
      total: supportedKinds.length,
    },

    // Live reputation data
    reputation: reputationStats,

    // Protocol versions
    protocolVersion: {
      erc8004: "1.0.0",
      x402: "2.0.0",
    },

    // Metadata
    version: "2.0.0",
    spec: "ERC-8004",
    created: new Date().toISOString(),
  };

  return NextResponse.json(agentRegistration, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",  // 5 minute cache
      "X-ERC8004-Version": "1.0.0",
      "X-x402-Version": "2.0.0",
    },
  });
}

function getChainId(network: string): number | null {
  const chainIdMap: Record<string, number> = {
    avalanche: CHAIN_IDS.AVALANCHE,
    "avalanche-fuji": CHAIN_IDS.AVALANCHE_FUJI,
    celo: CHAIN_IDS.CELO,
    "celo-sepolia": CHAIN_IDS.CELO_SEPOLIA,
    base: CHAIN_IDS.BASE,
    "base-sepolia": CHAIN_IDS.BASE_SEPOLIA,
    ethereum: CHAIN_IDS.ETHEREUM,
    sepolia: CHAIN_IDS.SEPOLIA,
    polygon: CHAIN_IDS.POLYGON,
    "polygon-amoy": CHAIN_IDS.POLYGON_AMOY,
    monad: CHAIN_IDS.MONAD,
    "monad-testnet": CHAIN_IDS.MONAD_TESTNET,
    arbitrum: CHAIN_IDS.ARBITRUM,
    "arbitrum-sepolia": CHAIN_IDS.ARBITRUM_SEPOLIA,
    optimism: CHAIN_IDS.OPTIMISM,
    "optimism-sepolia": CHAIN_IDS.OPTIMISM_SEPOLIA,
  };
  return chainIdMap[network] || null;
}

function isTestnet(network: string): boolean {
  return (
    network.includes("fuji") ||
    network.includes("sepolia") ||
    network.includes("amoy") ||
    network.includes("testnet")
  );
}
