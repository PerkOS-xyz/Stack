import { NextResponse } from "next/server";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { supabase } from "@/lib/db/supabase";
import { CHAIN_IDS, SUPPORTED_NETWORKS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/**
 * x402 V2 Discovery Extension
 * Standard endpoint: /.well-known/x402-discovery.json
 *
 * Enables AI agents to automatically discover services, understand pricing,
 * and initiate payments. This endpoint follows the x402 V2 Bazaar discovery spec.
 *
 * @see https://www.x402.org/writing/x402-v2-launch
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
    avgSettlementTime: 0,
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

    const totalVolumeUsd = volumeData?.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0) || 0;

    reputationStats = {
      totalTransactions: totalTx || 0,
      successfulTransactions: successTx || 0,
      totalVolume: totalVolumeUsd.toFixed(2),
      successRate: totalTx ? Math.round(((successTx || 0) / totalTx) * 100) : 100,
      avgSettlementTime: 3000, // ~3 seconds average
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch reputation stats:", error);
  }

  // Build network configurations with CAIP-2 chain IDs
  const networkConfigs = supportedKinds.map((kind) => {
    const chainId = getChainId(kind.network);
    return {
      scheme: kind.scheme,
      network: kind.network,
      chainId,
      caip2: chainId ? `eip155:${chainId}` : null, // CAIP-2 format for multi-chain
      asset: {
        address: config.paymentTokens[kind.network as SupportedNetwork],
        symbol: "USDC",
        decimals: 6,
        caip19: chainId
          ? `eip155:${chainId}/erc20:${config.paymentTokens[kind.network as SupportedNetwork]}`
          : null, // CAIP-19 asset identifier
      },
      escrow: kind.scheme === "deferred"
        ? config.deferredEscrowAddresses[kind.network as SupportedNetwork]
        : null,
      isTestnet: kind.network.includes("fuji") ||
                 kind.network.includes("sepolia") ||
                 kind.network.includes("amoy") ||
                 kind.network.includes("testnet"),
    };
  });

  // x402 V2 Discovery Extension Response
  const discoveryMetadata = {
    // Protocol identification
    "@context": "https://x402.org/discovery/v2",
    "@type": "x402Facilitator",
    specVersion: "2.0.0",
    protocolVersion: 1,

    // Facilitator identity
    facilitator: {
      id: config.paymentReceiver,
      name: config.facilitatorName,
      description: config.facilitatorDescription,
      url: config.facilitatorUrl,
      logo: `${config.facilitatorUrl}/logo.png`,
      contact: {
        website: config.facilitatorUrl,
        support: `${config.facilitatorUrl}/support`,
      },
    },

    // x402 API endpoints (V2 standard)
    endpoints: {
      verify: `${config.facilitatorUrl}/api/v2/x402/verify`,
      settle: `${config.facilitatorUrl}/api/v2/x402/settle`,
      supported: `${config.facilitatorUrl}/api/v2/x402/supported`,
      config: `${config.facilitatorUrl}/api/v2/x402/config`,
      health: `${config.facilitatorUrl}/api/v2/x402/health`,
    },

    // Discovery endpoints
    discovery: {
      agentCard: `${config.facilitatorUrl}/api/.well-known/agent-card.json`,
      erc8004: `${config.facilitatorUrl}/api/.well-known/erc-8004.json`,
      x402Payment: `${config.facilitatorUrl}/api/.well-known/x402-payment.json`,
      x402Discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
    },

    // Capabilities (V2 format)
    capabilities: {
      schemes: ["exact", ...(config.deferredEnabled ? ["deferred"] : [])],
      features: [
        "multi-chain", // Supports multiple blockchain networks
        "evm-compatible", // EVM chain support
        "gasless-transactions", // Sponsored gas via Thirdweb
        "batch-settlement", // Batch deferred voucher settlement
        "real-time-verification", // Instant payment verification
        "agent-discovery", // ERC-8004 compliant discovery
        "bazaar-indexable", // Can be crawled by Bazaar
      ],
      paymentMethods: networkConfigs,
    },

    // Supported networks (V2 multi-chain format)
    networks: {
      mainnet: networkConfigs.filter((n) => !n.isTestnet),
      testnet: networkConfigs.filter((n) => n.isTestnet),
      total: networkConfigs.length,
    },

    // Trust & Reputation (V2 format)
    trust: {
      model: "reputation",
      reputation: reputationStats,
      verification: {
        type: "on-chain",
        description: "All settlements verified via blockchain transactions",
      },
      security: {
        auditStatus: "unaudited", // Update when audited
        securityContact: `${config.facilitatorUrl}/security`,
        bugBounty: false,
      },
    },

    // Pricing information (for Bazaar indexing)
    pricing: {
      model: "per-transaction",
      fees: {
        verification: "0", // Free verification
        settlement: "gas-only", // Only blockchain gas fees
        facilitator: "0", // No facilitator fee
      },
      currency: "USD",
      description: "Free facilitation with transparent on-chain settlement",
    },

    // Service Level Agreement
    sla: {
      uptime: "99.9%",
      settlementTime: {
        exact: "< 30 seconds",
        deferred: "< 60 seconds (batch)",
      },
      support: {
        channels: ["github", "discord"],
        responseTime: "< 24 hours",
      },
    },

    // Integration information
    integration: {
      sdkSupported: true,
      documentation: `${config.facilitatorUrl}/docs`,
      examples: `${config.facilitatorUrl}/examples`,
      changelog: `${config.facilitatorUrl}/changelog`,
    },

    // Metadata
    metadata: {
      version: "2.0.0",
      generatedAt: new Date().toISOString(),
      cacheControl: "public, max-age=300", // 5 minute cache
    },
  };

  return NextResponse.json(discoveryMetadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "X-x402-Version": "2.0.0",
    },
  });
}

// Helper to get chain ID from network name
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
