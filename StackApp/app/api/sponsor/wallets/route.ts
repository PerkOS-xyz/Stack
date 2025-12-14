import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/sponsor/wallets?address=0x...
 * Returns sponsor wallets for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    const { data: wallets, error } = await supabase
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("user_wallet_address", address.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sponsor wallets:", error);
      return NextResponse.json(
        { error: "Failed to fetch wallets" },
        { status: 500 }
      );
    }

    return NextResponse.json({ wallets: wallets || [] });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sponsor/wallets
 * Creates a new Turnkey sponsor wallet
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { userWalletAddress, network = "evm" } = body;

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "userWalletAddress required" },
        { status: 400 }
      );
    }

    // Auto-convert legacy EVM chain names to "evm"
    const evmNetworks = ["avalanche", "avalanche-fuji", "base", "base-sepolia", "celo", "celo-alfajores"];
    if (evmNetworks.includes(network)) {
      console.log(`Converting legacy network "${network}" to "evm"`);
      network = "evm";
    }

    // Validate network (default to 'evm' for multi-chain wallets)
    // Future: Add 'solana' support
    const validNetworks = ["evm", "solana"];
    if (!validNetworks.includes(network)) {
      return NextResponse.json(
        { error: `Invalid network. Must be "evm" or "solana" (future)` },
        { status: 400 }
      );
    }

    // Check if wallet already exists in database (network-agnostic since Thirdweb wallets work across all EVM chains)
    const { data: existing } = await supabase
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("user_wallet_address", userWalletAddress.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        {
          error: "Sponsor wallet already exists (works across all networks)",
          wallet: existing,
        },
        { status: 409 }
      );
    }

    // Create server-controlled sponsor wallet using ThirdwebService
    const { getThirdwebService } = await import("@/lib/services/ThirdwebService");
    const thirdweb = getThirdwebService();

    const sponsorWallet = await thirdweb.createWallet(
      userWalletAddress,
      network
    );

    // Store wallet in database with both EOA and Smart Wallet addresses
    const { data: wallet, error } = await supabase
      .from("perkos_sponsor_wallets")
      .insert({
        user_wallet_address: userWalletAddress.toLowerCase(),
        network,
        turnkey_wallet_id: sponsorWallet.walletId,
        sponsor_address: sponsorWallet.address, // EOA address
        smart_wallet_address: sponsorWallet.smartWalletAddress, // Smart Wallet address
        encrypted_private_key: sponsorWallet.encryptedPrivateKey,
        balance: "0",
      })
      .select()
      .single();

    if (error) {
      console.error("Error storing sponsor wallet:", error);
      return NextResponse.json(
        { error: "Failed to create wallet" },
        { status: 500 }
      );
    }

    console.log(`✅ Sponsor wallet created successfully:`);
    console.log(`   EOA Address: ${sponsorWallet.address}`);
    console.log(`   Smart Wallet: ${sponsorWallet.smartWalletAddress}`);
    console.log(`   Network: ${network} (works on all EVM chains)`);

    return NextResponse.json({
      wallet,
      message: "Sponsor wallet created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
