import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { chains, getNativeTokenSymbol, getRpcUrl, SUPPORTED_NETWORKS } from "@/lib/utils/chains";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

// Solana RPC endpoints
const SOLANA_RPC_ENDPOINTS = {
  "solana-mainnet": process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com",
  "solana-devnet": process.env.SOLANA_DEVNET_RPC || "https://api.devnet.solana.com",
};

/**
 * Fetch Solana balance for a given address
 */
async function fetchSolanaBalance(address: string, network: "solana-mainnet" | "solana-devnet") {
  try {
    const rpcUrl = SOLANA_RPC_ENDPOINTS[network];
    const connection = new Connection(rpcUrl, "confirmed");

    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);

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
 * Query params: address, walletType (optional: "EVM" | "SOLANA", defaults to "EVM")
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const walletType = searchParams.get("walletType") || "EVM";

    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
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

      return NextResponse.json({
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
      });
    }

    // Handle EVM wallets (existing logic)
    // Validate EVM address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid EVM address format" },
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
      walletType: "EVM",
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
