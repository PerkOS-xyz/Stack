import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { supabase } from "@/lib/db/supabase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

/**
 * x402 V2 Payment Configuration
 * Standard endpoint: /.well-known/x402-payment.json
 *
 * Provides payment configuration for x402 protocol integration.
 * Updated to V2 format with multi-chain support and CAIP identifiers.
 */
export async function GET() {
  const x402Service = new X402Service();
  const supportedKinds = x402Service.getSupported().kinds;

  // Fetch live stats for trust indicators
  let stats = { totalTransactions: 0, successRate: 100 };
  try {
    const { count: total } = await supabase
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true });
    const { count: success } = await supabase
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
    const tokenAddress = config.paymentTokens[kind.network as SupportedNetwork];
    return {
      scheme: kind.scheme,
      network: kind.network,
      chainId,
      caip2: chainId ? `eip155:${chainId}` : null,
      asset: {
        address: tokenAddress,
        symbol: "USDC",
        decimals: 6,
        caip19: chainId ? `eip155:${chainId}/erc20:${tokenAddress}` : null,
      },
      escrow:
        kind.scheme === "deferred"
          ? config.deferredEscrowAddresses[kind.network as SupportedNetwork]
          : null,
      isTestnet: isTestnet(kind.network),
    };
  });

  const paymentConfig = {
    // Protocol identification
    "@context": "https://x402.org/payment/v2",
    specVersion: "2.0.0",
    protocolVersion: 1,

    // Facilitator identity
    facilitator: {
      id: config.paymentReceiver,
      name: config.facilitatorName,
      description: config.facilitatorDescription,
      url: config.facilitatorUrl,
      logo: `${config.facilitatorUrl}/logo.png`,
    },

    // V2 API endpoints
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
      x402Discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
    },

    // Supported schemes
    schemes: {
      exact: {
        enabled: true,
        description: "Immediate payment via EIP-3009 transferWithAuthorization",
        standard: "EIP-3009",
      },
      deferred: {
        enabled: config.deferredEnabled,
        description: "Off-chain voucher aggregation with batch settlement",
        standard: "EIP-712",
      },
    },

    // Payment methods with V2 multi-chain format
    paymentMethods,

    // Networks summary
    networks: {
      mainnet: paymentMethods
        .filter((m) => !m.isTestnet)
        .map((m) => ({
          network: m.network,
          chainId: m.chainId,
          caip2: m.caip2,
        })),
      testnet: paymentMethods
        .filter((m) => m.isTestnet)
        .map((m) => ({
          network: m.network,
          chainId: m.chainId,
          caip2: m.caip2,
        })),
      total: paymentMethods.length,
    },

    // Capabilities
    capabilities: [
      "x402-v2",
      "x402-payment-exact",
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []),
      "multi-chain",
      "evm-compatible",
      "gasless-transactions",
      "batch-settlement",
      "real-time-verification",
    ],

    // Trust indicators
    trust: {
      totalTransactions: stats.totalTransactions,
      successRate: `${stats.successRate}%`,
      verified: false,
    },

    // Fees
    fees: {
      verification: "0",
      settlement: "gas-only",
      facilitator: "0",
      description: "Free facilitation with transparent on-chain settlement",
    },

    // Protocol version
    version: {
      x402: "2.0.0",
      api: "v2",
      spec: "1",
    },

    // Metadata
    metadata: {
      generatedAt: new Date().toISOString(),
      cacheControl: "public, max-age=300",
    },
  };

  return NextResponse.json(paymentConfig, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
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
