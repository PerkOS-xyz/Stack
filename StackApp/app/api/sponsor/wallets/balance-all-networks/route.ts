import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { chains, getNativeTokenSymbol, getRpcUrl, SUPPORTED_NETWORKS } from "@/lib/utils/chains";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

/**
 * GET /api/sponsor/wallets/balance-all-networks
 * Fetches live balance for a specific address across all supported networks
 * Query params: address
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Check all networks in parallel
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
          transport: http(rpcUrl),
        });

        // Fetch live balance from blockchain
        const balance = await publicClient.getBalance({
          address: address as Address,
        });

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

    const balances = await Promise.all(balancePromises);

    // Separate mainnets and testnets
    const mainnets = balances.filter(b => b.success && !b.isTestnet);
    const testnets = balances.filter(b => b.success && b.isTestnet);
    const errors = balances.filter(b => !b.success);

    return NextResponse.json({
      success: true,
      address,
      balances: {
        mainnets,
        testnets,
        errors,
      },
      totalNetworks: SUPPORTED_NETWORKS.length,
      successful: balances.filter(b => b.success).length,
      failed: errors.length,
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/balance-all-networks:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}

