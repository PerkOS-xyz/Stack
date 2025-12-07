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
    const { userWalletAddress, network } = body;

    if (!userWalletAddress || !network) {
      return NextResponse.json(
        { error: "userWalletAddress and network required" },
        { status: 400 }
      );
    }

    // Validate network
    const validNetworks = ["avalanche", "avalanche-fuji", "base", "base-sepolia", "celo", "celo-alfajores"];
    if (!validNetworks.includes(network)) {
      return NextResponse.json(
        { error: `Invalid network. Must be one of: ${validNetworks.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if wallet already exists
    const { data: existing } = await supabase
      .from("perkos_sponsor_wallets")
      .select("id")
      .eq("user_wallet_address", userWalletAddress.toLowerCase())
      .eq("network", network)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Sponsor wallet already exists for this network" },
        { status: 409 }
      );
    }

    // Create Thirdweb wallet
    const { getThirdwebService } = await import("@/lib/services/ThirdwebService");
    const thirdweb = getThirdwebService();

    const thirdwebWallet = await thirdweb.createWallet(
      userWalletAddress,
      network
    );

    const { data: wallet, error } = await supabase
      .from("perkos_sponsor_wallets")
      .insert({
        user_wallet_address: userWalletAddress.toLowerCase(),
        network,
        turnkey_wallet_id: thirdwebWallet.walletId, // Column name unchanged for now
        sponsor_address: thirdwebWallet.address,
        encrypted_private_key: thirdwebWallet.encryptedPrivateKey,
        balance: "0",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating sponsor wallet:", error);
      return NextResponse.json(
        { error: "Failed to create wallet" },
        { status: 500 }
      );
    }

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
