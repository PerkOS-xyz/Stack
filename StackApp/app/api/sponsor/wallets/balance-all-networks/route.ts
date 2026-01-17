import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { chains, getNativeTokenSymbol, getRpcUrl, SUPPORTED_NETWORKS } from "@/lib/utils/chains";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

// ============================================================================
// PERFORMANCE OPTIMIZATIONS
// ============================================================================

// In-memory cache for balance results (TTL: 30 seconds)
const balanceCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Timeout for individual RPC calls (5 seconds per network)
const RPC_TIMEOUT_MS = 5000;

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * Get cached balance if still valid
 */
function getCachedBalance(cacheKey: string): unknown | null {
  const cached = balanceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  balanceCache.delete(cacheKey);
  return null;
}

/**
 * Set balance in cache
 */
function setCachedBalance(cacheKey: string, data: unknown): void {
  balanceCache.set(cacheKey, { data, timestamp: Date.now() });
}

// Solana RPC endpoints
const SOLANA_RPC_ENDPOINTS = {
  "solana-mainnet": process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com",
  "solana-devnet": process.env.SOLANA_DEVNET_RPC || "https://api.devnet.solana.com",
};

/**
 * Fetch Solana balance for a given address (with timeout)
 */
async function fetchSolanaBalance(address: string, network: "solana-mainnet" | "solana-devnet") {
  try {
    const rpcUrl = SOLANA_RPC_ENDPOINTS[network];
    const connection = new Connection(rpcUrl, "confirmed");

    const publicKey = new PublicKey(address);

    // Wrap balance fetch with timeout
    const balance = await withTimeout(
      connection.getBalance(publicKey),
      RPC_TIMEOUT_MS,
      `Timeout fetching ${network} balance`
    );

    const balanceFormatted = (balance / LAMPORTS_PER_SOL).toFixed(6);
    const isTestnet = network === "solana-devnet";

    return {
      network,
      success: true,
      address,
      balance: balance.toString(),
      balanceFormatted,
      symbol: "SOL",
      chainId: isTestnet ? "solana-devnet" : "solana-mainnet",
      isTestnet,
    };
  } catch (error) {
    return {
      network,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * GET /api/sponsor/wallets/balance-all-networks
 * Fetches live balance for a specific address across all supported networks
 *
 * Query params:
 * - address: The wallet address to check
 * - walletType: "EVM" | "SOLANA" (defaults to "EVM")
 * - forceRefresh: "true" to bypass cache and fetch fresh data
 *
 * Performance optimizations:
 * - 30-second in-memory cache to reduce RPC calls
 * - 5-second timeout per network to prevent slow RPCs from blocking
 * - Promise.allSettled for parallel fetching with graceful error handling
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const walletType = searchParams.get("walletType") || "EVM";
    const forceRefresh = searchParams.get("forceRefresh") === "true";

    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    // If force refresh, clear cached data for this address
    if (forceRefresh) {
      const evmCacheKey = `evm-balances-${address.toLowerCase()}`;
      const solanaCacheKey = `solana-balances-${address}`;
      balanceCache.delete(evmCacheKey);
      balanceCache.delete(solanaCacheKey);
      console.log(`[Balance API] Force refresh requested for ${address}`);
    }

    // Handle Solana wallets
    if (walletType === "SOLANA") {
      // Validate Solana address format (base58, 32-44 characters)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return NextResponse.json(
          { error: "Invalid Solana address format" },
          { status: 400 }
        );
      }

      // Check cache first for Solana
      const solanaCacheKey = `solana-balances-${address}`;
      const cachedSolanaResult = getCachedBalance(solanaCacheKey);
      if (cachedSolanaResult) {
        console.log(`[Balance API] Returning cached Solana balances for ${address}`);
        return NextResponse.json(cachedSolanaResult);
      }

      // Fetch Solana balances for mainnet and devnet
      const [mainnetBalance, devnetBalance] = await Promise.all([
        fetchSolanaBalance(address, "solana-mainnet"),
        fetchSolanaBalance(address, "solana-devnet"),
      ]);

      const mainnets = mainnetBalance.success ? [mainnetBalance] : [];
      const testnets = devnetBalance.success ? [devnetBalance] : [];
      const errors = [
        ...(mainnetBalance.success ? [] : [mainnetBalance]),
        ...(devnetBalance.success ? [] : [devnetBalance]),
      ];

      const solanaResponseData = {
        success: true,
        address,
        walletType: "SOLANA",
        balances: {
          mainnets,
          testnets,
          errors,
        },
        totalNetworks: 2,
        successful: mainnets.length + testnets.length,
        failed: errors.length,
        cachedAt: new Date().toISOString(),
      };

      // Cache the result
      setCachedBalance(solanaCacheKey, solanaResponseData);

      return NextResponse.json(solanaResponseData);
    }

    // Handle EVM wallets (existing logic)
    // Validate EVM address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid EVM address format" },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `evm-balances-${address.toLowerCase()}`;
    const cachedResult = getCachedBalance(cacheKey);
    if (cachedResult) {
      console.log(`[Balance API] Returning cached balances for ${address}`);
      return NextResponse.json(cachedResult);
    }

    console.log(`[Balance API] Fetching fresh balances for ${address} across ${SUPPORTED_NETWORKS.length} networks`);
    const startTime = Date.now();

    // Check all networks in parallel with individual timeouts
    const balancePromises = SUPPORTED_NETWORKS.map(async (network) => {
      try {
        const chain = chains[network];
        if (!chain) {
          return {
            network,
            success: false,
            error: `Chain not configured for ${network}`,
          };
        }

        const rpcUrl = getRpcUrl(chain.id);
        if (!rpcUrl) {
          return {
            network,
            success: false,
            error: `No RPC URL configured for ${network}`,
          };
        }

        const symbol = getNativeTokenSymbol(network);
        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl, {
            timeout: RPC_TIMEOUT_MS, // Set HTTP transport timeout
          }),
        });

        // Fetch live balance from blockchain with timeout wrapper
        const balance = await withTimeout(
          publicClient.getBalance({
            address: address as Address,
          }),
          RPC_TIMEOUT_MS,
          `Timeout fetching ${network} balance`
        );

        const balanceFormatted = (Number(balance) / 1e18).toFixed(6);
        const isTestnet = network.includes("fuji") ||
                         network.includes("sepolia") ||
                         network.includes("amoy") ||
                         network.includes("testnet");

        return {
          network,
          success: true,
          address,
          balance: balance.toString(),
          balanceFormatted,
          symbol,
          chainId: chain.id,
          isTestnet,
        };
      } catch (error) {
        return {
          network,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    // Use Promise.allSettled to ensure all requests complete (even if some fail)
    const results = await Promise.allSettled(balancePromises);
    const balances = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      // Handle rejected promises
      return {
        network: SUPPORTED_NETWORKS[index],
        success: false,
        error: result.reason?.message || "Unknown error",
      };
    });

    console.log(`[Balance API] Completed in ${Date.now() - startTime}ms`);

    // Separate mainnets and testnets
    const mainnets = balances.filter(b => b.success && 'isTestnet' in b && !b.isTestnet);
    const testnets = balances.filter(b => b.success && 'isTestnet' in b && b.isTestnet);
    const errors = balances.filter(b => !b.success);

    const responseData = {
      success: true,
      address,
      walletType: "EVM",
      balances: {
        mainnets,
        testnets,
        errors,
      },
      totalNetworks: SUPPORTED_NETWORKS.length,
      successful: balances.filter(b => b.success).length,
      failed: errors.length,
      cachedAt: new Date().toISOString(),
    };

    // Cache the result for future requests
    setCachedBalance(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/balance-all-networks:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
