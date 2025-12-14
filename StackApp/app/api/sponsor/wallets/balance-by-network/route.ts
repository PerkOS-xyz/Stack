import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { chains, getNativeTokenSymbol, getRpcUrl } from "@/lib/utils/chains";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

/**
 * GET /api/sponsor/wallets/balance-by-network
 * Fetches live balance for a specific address on a specific network
 * Query params: address, network
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const network = searchParams.get("network");

    if (!address) {
      return NextResponse.json(
        { error: "Missing required parameter: address" },
        { status: 400 }
      );
    }

    if (!network) {
      return NextResponse.json(
        { error: "Missing required parameter: network" },
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

    // Get chain configuration from centralized chains.ts
    const chain = chains[network];
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported network: ${network}` },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(chain.id);
    const symbol = getNativeTokenSymbol(network);

    if (!rpcUrl) {
      return NextResponse.json(
        { error: `No RPC URL configured for network: ${network}` },
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
      address: address as Address,
    });

    const balanceFormatted = (Number(balance) / 1e18).toFixed(6);

    return NextResponse.json({
      success: true,
      network,
      address,
      balance: balance.toString(),
      balanceFormatted,
      symbol,
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/balance-by-network:", error);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
