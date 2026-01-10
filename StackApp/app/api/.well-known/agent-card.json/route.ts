import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { firebaseAdmin } from "@/lib/db/firebase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/**
 * Agent Card (ActivityPub-style)
 * Standard endpoint: /.well-known/agent-card.json
 *
 * Provides agent metadata with payment capabilities for AI agent discovery.
 * Updated to x402 V2 format with multi-chain support.
 */
export async function GET() {
  const x402Service = new X402Service();
  const supportedKinds = x402Service.getSupported().kinds;

  // Fetch live stats for reputation
  let stats = { totalTransactions: 0, successRate: 100 };
  try {
    const { count: total } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true });
    const { count: success } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");
    stats = {
      totalTransactions: total || 0,
      successRate: total ? Math.round(((success || 0) / total) * 100) : 100,
    };
  } catch {
    // Use defaults on error
  }

  // Build payment methods with V2 multi-chain format
  const paymentMethods = supportedKinds.map((kind) => {
    const chainId = getChainId(kind.network);
    return {
      scheme: kind.scheme,
      network: kind.network,
      chainId,
      asset: config.paymentTokens[kind.network as SupportedNetwork],
      assetSymbol: "USDC",
      assetDecimals: 6,
    };
  });

  const agentCard = {
    // ActivityPub context
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://x402.org/context/v2",
    ],

    // Agent identity
    id: config.paymentReceiver,
    type: "Agent",
    name: config.facilitatorName,
    summary: config.facilitatorDescription,
    url: config.facilitatorUrl,

    // Profile
    icon: {
      type: "Image",
      url: `${config.facilitatorUrl}/logo.png`,
      mediaType: "image/png",
    },

    // x402 V2 capabilities (EIP-8004 compliant)
    capabilities: [
      "x402-v2", // V2 protocol support
      "x402-payment-exact", // EIP-3009 exact payments
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []), // EIP-712 deferred
      "multi-chain", // Multi-chain support
      "evm-compatible", // EVM chains
      "erc-8004-discovery", // Agent discovery
      "erc-8004-reputation", // On-chain reputation (score 0-100, tag filtering)
      "erc-8004-validation", // Request-response validation model
      "bazaar-indexable", // Bazaar discovery
      "gasless-transactions", // Sponsored gas
    ],

    // Payment configuration (V2 format)
    paymentMethods,

    // Supported schemes
    schemes: ["exact", ...(config.deferredEnabled ? ["deferred"] : [])],

    // Networks summary
    networks: {
      mainnet: supportedKinds
        .filter((k) => !isTestnet(k.network))
        .map((k) => k.network),
      testnet: supportedKinds
        .filter((k) => isTestnet(k.network))
        .map((k) => k.network),
    },

    // x402 V2 Endpoints
    endpoints: {
      x402: `${config.facilitatorUrl}/api/v2/x402`,
      verify: `${config.facilitatorUrl}/api/v2/x402/verify`,
      settle: `${config.facilitatorUrl}/api/v2/x402/settle`,
      supported: `${config.facilitatorUrl}/api/v2/x402/supported`,
      discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
    },

    // Trust indicators (EIP-8004 compliant)
    trust: {
      totalTransactions: stats.totalTransactions,
      successRate: `${stats.successRate}%`,
      verified: false, // Update when on-chain registry deployed
      erc8004: {
        reputation: {
          enabled: true,
          model: "score-0-100",
          features: ["tag1-tag2-filtering", "feedback-uri-hash"],
        },
        validation: {
          enabled: true,
          model: "request-response",
          features: ["validator-targeting", "tag-categorization"],
        },
      },
    },

    // Protocol version
    protocolVersion: {
      x402: "2.0.0",
      spec: "1",
    },

    // Metadata
    published: new Date().toISOString(),
  };

  return NextResponse.json(agentCard, {
    headers: {
      "Content-Type": "application/ld+json",
      "Cache-Control": "public, max-age=300",
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
