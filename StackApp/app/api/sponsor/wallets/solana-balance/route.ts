import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * Solana Balance API
 *
 * Fetches SOL balance for a Solana wallet address.
 *
 * Query Parameters:
 * - address: Solana wallet address (base58 encoded)
 * - network: "solana" | "solana-devnet"
 */

// Solana RPC endpoints
const SOLANA_RPC_URLS: Record<string, string> = {
  "solana": process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "solana-devnet": process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
};

// Validate Solana address format (base58, 32-44 characters)
function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const network = searchParams.get("network") || "solana";

    // Validate address parameter
    if (!address) {
      return NextResponse.json(
        { error: "Missing address parameter" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: "Invalid Solana address format" },
        { status: 400 }
      );
    }

    // Validate network
    const rpcUrl = SOLANA_RPC_URLS[network];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported Solana network: ${network}` },
        { status: 400 }
      );
    }

    // Create Solana connection
    const connection = new Connection(rpcUrl, "confirmed");

    // Get public key from address
    const publicKey = new PublicKey(address);

    // Fetch SOL balance
    const balanceLamports = await connection.getBalance(publicKey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    console.log(`[SolanaBalance] Address: ${address}, Network: ${network}, Balance: ${balanceSOL} SOL`);

    return NextResponse.json({
      success: true,
      address,
      network,
      balance: balanceSOL.toString(),
      balanceLamports: balanceLamports.toString(),
      symbol: "SOL",
      decimals: 9,
    });

  } catch (error) {
    console.error("[SolanaBalance] Error fetching balance:", error);

    // Handle specific Solana errors
    if (error instanceof Error) {
      if (error.message.includes("Invalid public key")) {
        return NextResponse.json(
          { error: "Invalid Solana address" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch Solana balance" },
      { status: 500 }
    );
  }
}
