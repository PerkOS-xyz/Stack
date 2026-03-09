import { NextRequest, NextResponse } from "next/server";
import { config, type SupportedNetwork, getErc8004Registries, hasErc8004Registries } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { firebaseAdmin } from "@/lib/db/firebase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/** GET /.well-known/erc-8004.json — ERC-8004 Agent Registration File (v2). */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const x402Service = new X402Service();
  const supportedKinds = x402Service.getSupported().kinds;

  let reputationStats = {
    totalTransactions: 0,
    successfulTransactions: 0,
    totalVolume: "0",
    successRate: 100,
    averageRating: 0,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const { count: totalTx } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true });

    const { count: successTx } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");

    const { data: volumeData } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("amount_usd")
      .eq("status", "success");

    const totalVolumeUsd =
      volumeData?.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0) || 0;

    const { data: reviewData } = await firebaseAdmin
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

  const registrations: Array<{
    agentRegistry: string;  // {namespace}:{chainId}:{identityRegistry}
    agentId: string | null;
    tokenURI: string;
  }> = [];

  for (const kind of supportedKinds) {
    const network = kind.network as SupportedNetwork;
    const chainId = getChainId(network);

    if (chainId && hasErc8004Registries(network)) {
      const registryInfo = getErc8004Registries(network);
      registrations.push({
        agentRegistry: `eip155:${chainId}:${registryInfo.identity}`,
        agentId: null,
        tokenURI: `${baseUrl}/api/.well-known/erc-8004.json`,
      });
    }
  }

  const services = {
    a2a: `${baseUrl}/api/v2/x402`,
    mcp: null as string | null,
    ens: null as string | null,
    did: null as string | null,
    wallet: config.paymentReceiver,
    discovery: `${baseUrl}/api/.well-known/x402-discovery.json`,
    agentCard: `${baseUrl}/api/.well-known/agent-card.json`,
    x402Verify: `${baseUrl}/api/v2/x402/verify`,
    x402Settle: `${baseUrl}/api/v2/x402/settle`,
    x402Config: `${baseUrl}/api/v2/x402/config`,
    x402Supported: `${baseUrl}/api/v2/x402/supported`,
    x402Health: `${baseUrl}/api/v2/x402/health`,
    agentOnboard: `${baseUrl}/api/v2/agents/onboard`,
  };

  const supportedTrust: Array<{
    type: string;
    description: string;
    enabled: boolean;
    config?: Record<string, unknown>;
  }> = [
    {
      type: "reputation",
      description: "On-chain feedback via Reputation Registry (EIP-8004 v2: int128 value + valueDecimals)",
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
        valueFormat: "int128 + uint8 valueDecimals (signed, 0-18 decimals)",
        features: [
          "signed-value-decimals",
          "tag1-tag2-filtering",
          "feedback-uri-hash",
          "response-append",
          "revocation",
          "response-count",
        ],
      },
    },
    {
      type: "validation",
      description: "Request-response validation (EIP-8004 v2: progressive, no enum)",
      enabled: true,
      config: {
        validationRegistries: Object.fromEntries(
          supportedKinds
            .filter(k => {
              const registries = getErc8004Registries(k.network as SupportedNetwork);
              return !!registries.validation;
            })
            .map(k => {
              const network = k.network as SupportedNetwork;
              const chainId = getChainId(network);
              const registries = getErc8004Registries(network);
              return [`eip155:${chainId}`, registries.validation];
            })
        ),
        model: "request-response",
        responseRange: { min: 0, max: 100 },
        features: [
          "progressive-validation",
          "validator-targeting",
          "tag-categorization",
          "request-hash-tracking",
        ],
      },
    },
    {
      type: "tee-attestation",
      description: "Trusted Execution Environment verification",
      enabled: false,
    },
  ];

  const agentRegistration = {
    type: "service",
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    active: true,
    x402Support: true,

    services,

    registrations,

    supportedTrust,

    image: `${baseUrl}/logo.png`,
    icon: `${baseUrl}/icon.png`,
    agentId: config.paymentReceiver,
    url: baseUrl,

    capabilities: [
      "x402-v2",
      "x402-payment-exact",
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []),
      "erc-8004-discovery",
      "erc-8004-reputation",
      "erc-8004-validation",
      "multi-chain-support",
      "bazaar-indexable",
      "gasless-transactions",
    ],

    paymentMethods: supportedKinds.map((kind) => ({
      scheme: kind.scheme,
      network: kind.network,
      asset: config.paymentTokens[kind.network as SupportedNetwork],
      chainId: `eip155:${getChainId(kind.network)}`,
    })),

    networks: {
      mainnet: supportedKinds.filter((k) => !isTestnet(k.network)).map((k) => k.network),
      testnet: supportedKinds.filter((k) => isTestnet(k.network)).map((k) => k.network),
      total: supportedKinds.length,
    },

    reputation: reputationStats,

    protocolVersion: {
      erc8004: "2.0.0",
      x402: "2.0.0",
    },

    version: "3.0.0",
    spec: "ERC-8004",
    created: new Date().toISOString(),
  };

  return NextResponse.json(agentRegistration, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
      "X-ERC8004-Version": "2.0.0",
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
    network.includes("testnet") ||
    network.includes("chiado")
  );
}
