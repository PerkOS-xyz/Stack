import { NextResponse } from "next/server";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { supabase } from "@/lib/db/supabase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/**
 * ERC-8004: Trustless Agent Discovery
 * Standard endpoint: /.well-known/erc-8004.json
 *
 * Provides agent metadata, capabilities, and trust mechanisms.
 * Updated to x402 V2 with live reputation data and multi-chain support.
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

  // Build payment methods with chain IDs
  const paymentMethods = supportedKinds.map((kind) => ({
    scheme: kind.scheme,
    network: kind.network,
    asset: config.paymentTokens[kind.network as SupportedNetwork],
    chainId: getChainId(kind.network),
    caip2: `eip155:${getChainId(kind.network)}`, // CAIP-2 format
  }));

  const agentRegistration = {
    // ERC-8004 metadata
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    image: `${config.facilitatorUrl}/logo.png`,

    // Agent identity
    agentId: config.paymentReceiver,
    url: config.facilitatorUrl,

    // Communication endpoints (V2 format)
    endpoints: {
      a2a: `${config.facilitatorUrl}/api/v2/x402`, // Agent-to-Agent
      verify: `${config.facilitatorUrl}/api/v2/x402/verify`,
      settle: `${config.facilitatorUrl}/api/v2/x402/settle`,
      discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
      mcp: null, // Model Context Protocol
      ens: null, // ENS name
      did: null, // Decentralized Identifier
      wallet: config.paymentReceiver,
    },

    // Capabilities (V2 format)
    capabilities: [
      "x402-v2", // x402 V2 protocol
      "x402-payment-exact", // EIP-3009 exact payments
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []),
      "erc-8004-discovery", // Agent discovery
      "multi-chain-support", // 16 networks
      "bazaar-indexable", // Bazaar discovery
      "gasless-transactions", // Sponsored gas
    ],

    // Payment methods with V2 multi-chain format
    paymentMethods,

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

    // Trust models (ERC-8004 standard)
    trustModels: [
      {
        type: "reputation",
        description: "On-chain transaction history and community feedback",
        enabled: true,
        data: reputationStats,
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
    ],

    // Registration details
    registration: {
      registryAddress: null, // ERC-721 NFT registry
      tokenId: null,
      registered: false,
    },

    // Live reputation (from database)
    reputation: reputationStats,

    // Protocol version
    protocolVersion: {
      x402: "2.0.0",
      erc8004: "1.0.0",
    },

    // Metadata
    version: "2.0.0",
    spec: "ERC-8004",
    created: new Date().toISOString(),
  };

  return NextResponse.json(agentRegistration, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // 5 minute cache
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
