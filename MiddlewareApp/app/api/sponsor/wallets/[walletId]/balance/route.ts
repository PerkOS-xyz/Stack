import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { createPublicClient, http, type Address } from "viem";
import { avalanche, avalancheFuji, base, baseSepolia, celo } from "viem/chains";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

// Chain configurations
const chains: Record<string, any> = {
  avalanche,
  "avalanche-fuji": avalancheFuji,
  base,
  "base-sepolia": baseSepolia,
  celo,
};

// RPC URLs from environment
const rpcUrls: Record<string, string> = {
  avalanche: process.env.NEXT_PUBLIC_AVALANCHE_RPC || "https://api.avax.network/ext/bc/C/rpc",
  "avalanche-fuji": process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
  base: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
  "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
  celo: process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org",
};

/**
 * GET /api/sponsor/wallets/[walletId]/balance
 * Fetches live balance from blockchain and updates database
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { walletId: string } }
) {
  try {
    const { walletId } = params;

    // Get wallet from database
    const { data: wallet, error: fetchError } = await supabase
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("id", walletId)
      .single();

    if (fetchError || !wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    const { network, sponsor_address } = wallet;

    // Get chain configuration
    const chain = chains[network];
    const rpcUrl = rpcUrls[network];

    if (!chain || !rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported network: ${network}` },
        { status: 400 }
      );
    }

    // Create public client for reading blockchain data
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    // Fetch live balance from blockchain
    const balance = await publicClient.getBalance({
      address: sponsor_address as Address,
    });

    // Update database with new balance
    const { error: updateError } = await supabase
      .from("perkos_sponsor_wallets")
      .update({
        balance: balance.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId);

    if (updateError) {
      console.error("Error updating balance:", updateError);
      return NextResponse.json(
        { error: "Failed to update balance" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: balance.toString(),
      balanceFormatted: `${(Number(balance) / 1e18).toFixed(4)} ${
        network === "avalanche" || network === "avalanche-fuji"
          ? "AVAX"
          : network === "base" || network === "base-sepolia"
          ? "ETH"
          : "CELO"
      }`,
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/[walletId]/balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
