import { NextResponse } from "next/server";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { firebaseAdmin } from "@/lib/db/firebase";
import { CHAIN_IDS, chains } from "@/lib/utils/chains";
import { createPublicClient, http } from "viem";

export const dynamic = "force-dynamic";

/**
 * x402 V2 Health Check Endpoint
 * Provides comprehensive system status for monitoring and discovery.
 */
export async function GET() {
  const startTime = Date.now();

  // Initialize health status
  const health: HealthStatus = {
    status: "healthy",
    version: {
      x402: "2.0.0",
      api: "v2",
      protocol: 1,
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: "unknown", latency: 0 },
      networks: [],
    },
    capabilities: {
      schemes: ["exact"],
      deferredEnabled: config.deferredEnabled,
      networksConfigured: 0,
      networksHealthy: 0,
    },
    endpoints: {
      verify: `${config.facilitatorUrl}/api/v2/x402/verify`,
      settle: `${config.facilitatorUrl}/api/v2/x402/settle`,
      supported: `${config.facilitatorUrl}/api/v2/x402/supported`,
      discovery: `${config.facilitatorUrl}/api/.well-known/x402-discovery.json`,
    },
  };

  if (config.deferredEnabled) {
    health.capabilities.schemes.push("deferred");
  }

  // Check database connectivity
  try {
    const dbStart = Date.now();
    const { error } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("id", { count: "exact", head: true });
    health.checks.database = {
      status: error ? "unhealthy" : "healthy",
      latency: Date.now() - dbStart,
      error: error?.message,
    };
  } catch (err) {
    health.checks.database = {
      status: "unhealthy",
      latency: 0,
      error: err instanceof Error ? err.message : "Database check failed",
    };
    health.status = "degraded";
  }

  // Check network connectivity (sample networks to avoid timeout)
  const x402Service = new X402Service();
  const supportedKinds = x402Service.getSupported().kinds;
  const uniqueNetworks = [...new Set(supportedKinds.map((k) => k.network))];
  health.capabilities.networksConfigured = uniqueNetworks.length;

  // Check a sample of networks (max 4 to keep response fast)
  const sampleNetworks = uniqueNetworks.slice(0, 4);

  for (const network of sampleNetworks) {
    const chainId = getChainId(network);
    const chain = chains[network];

    if (!chain) {
      health.checks.networks.push({
        network,
        chainId,
        status: "unconfigured",
      });
      continue;
    }

    try {
      const networkStart = Date.now();
      const client = createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0], { timeout: 3000 }),
      });

      const blockNumber = await client.getBlockNumber();
      const latency = Date.now() - networkStart;

      health.checks.networks.push({
        network,
        chainId,
        status: "healthy",
        latency,
        blockNumber: Number(blockNumber),
        rpc: chain.rpcUrls.default.http[0],
      });
      health.capabilities.networksHealthy++;
    } catch (err) {
      health.checks.networks.push({
        network,
        chainId,
        status: "unhealthy",
        error: err instanceof Error ? err.message : "RPC check failed",
      });
    }
  }

  // Determine overall status
  if (health.checks.database.status === "unhealthy") {
    health.status = "unhealthy";
  } else if (health.capabilities.networksHealthy < sampleNetworks.length) {
    health.status = "degraded";
  }

  // Add response time
  health.responseTime = Date.now() - startTime;

  // Build response headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-x402-Version": "2.0.0",
    "X-x402-Status": health.status,
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };

  return NextResponse.json(health, { headers });
}

// Helper to get chain ID
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

// Types
interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  version: {
    x402: string;
    api: string;
    protocol: number;
  };
  timestamp: string;
  uptime: number;
  responseTime?: number;
  checks: {
    database: {
      status: "healthy" | "unhealthy" | "unknown";
      latency: number;
      error?: string;
    };
    networks: NetworkCheck[];
  };
  capabilities: {
    schemes: string[];
    deferredEnabled: boolean;
    networksConfigured: number;
    networksHealthy: number;
  };
  endpoints: {
    verify: string;
    settle: string;
    supported: string;
    discovery: string;
  };
}

interface NetworkCheck {
  network: string;
  chainId: number | null;
  status: "healthy" | "unhealthy" | "unconfigured";
  latency?: number;
  blockNumber?: number;
  rpc?: string;
  error?: string;
}
