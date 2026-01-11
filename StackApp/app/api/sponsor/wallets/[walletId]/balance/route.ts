import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { createPublicClient, http, type Address } from "viem";
import { chains, getRpcUrl, getNativeTokenSymbol } from "@/lib/utils/chains";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

// Default network for multi-chain EVM wallets
const DEFAULT_EVM_NETWORK = "base";

/**
 * GET /api/sponsor/wallets/[walletId]/balance?network=base
 * Fetches live balance from blockchain and updates database
 *
 * For multi-chain EVM wallets (network="evm"), pass the specific network as a query param
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    const { walletId } = await params;
    const { searchParams } = new URL(req.url);
    const queryNetwork = searchParams.get("network");

    // Get wallet from database
    const { data: wallet, error: fetchError } = await firebaseAdmin
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

    const { network: storedNetwork, sponsor_address } = wallet;

    // For multi-chain EVM wallets, use the query param network or default
    // For legacy single-network wallets, use the stored network
    let targetNetwork = storedNetwork;
    if (storedNetwork === "evm") {
      targetNetwork = queryNetwork || DEFAULT_EVM_NETWORK;
    }

    // Get chain configuration from centralized chains.ts
    const chain = chains[targetNetwork];
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported network: ${targetNetwork}. For EVM wallets, specify network query param (e.g., ?network=base)` },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(chain.id);
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `No RPC URL configured for network: ${targetNetwork}` },
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
    const { error: updateError } = await firebaseAdmin
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

    // Get native token symbol
    const symbol = getNativeTokenSymbol(targetNetwork);

    return NextResponse.json({
      success: true,
      balance: balance.toString(),
      balanceFormatted: `${(Number(balance) / 1e18).toFixed(4)} ${symbol}`,
      symbol,
      network: targetNetwork,
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/[walletId]/balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
