import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";

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

    const { data: wallets, error } = await firebaseAdmin
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
 * Creates a new sponsor wallet via Para
 * Supports multiple wallets per user with naming and public/private visibility
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { userWalletAddress, network = "evm", walletName, isPublic = false } = body;

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

    // Count existing wallets for this user (for default naming)
    const { count: walletCount } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*", { count: "exact", head: true })
      .eq("user_wallet_address", userWalletAddress.toLowerCase());

    // Generate default wallet name if not provided
    const defaultName = walletCount && walletCount > 0
      ? `Sponsor Wallet ${walletCount + 1}`
      : "Default Wallet";
    const finalWalletName = walletName?.trim() || defaultName;

    // Create server-controlled sponsor wallet using Para
    const { getParaService } = await import("@/lib/services/ParaService");
    const paraService = getParaService();

    const sponsorWallet = await paraService.createWallet(
      userWalletAddress,
      network
    );

    // Store wallet in database with Para wallet ID and address
    // Para manages keys securely - we only store the wallet ID for signing operations
    const { data: wallet, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .insert({
        user_wallet_address: userWalletAddress.toLowerCase(),
        network,
        para_wallet_id: sponsorWallet.walletId, // Para wallet ID for signing
        sponsor_address: sponsorWallet.address, // EOA address (same across all EVM chains)
        balance: "0",
        wallet_name: finalWalletName,
        is_public: isPublic,
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
    console.log(`   Name: ${finalWalletName}`);
    console.log(`   Address: ${sponsorWallet.address}`);
    console.log(`   Para Wallet ID: ${sponsorWallet.walletId}`);
    console.log(`   Network: ${network} (works on all EVM chains)`);
    console.log(`   Public: ${isPublic}`);

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

/**
 * PATCH /api/sponsor/wallets
 * Updates wallet metadata (name, public/private)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletId, walletName, isPublic, userWalletAddress } = body;

    if (!walletId || !userWalletAddress) {
      return NextResponse.json(
        { error: "walletId and userWalletAddress required" },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (walletName !== undefined) updateData.wallet_name = walletName.trim();
    if (isPublic !== undefined) updateData.is_public = isPublic;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No update fields provided" },
        { status: 400 }
      );
    }

    // Update wallet, ensuring user owns the wallet
    const { data: wallet, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .update(updateData)
      .eq("id", walletId)
      .eq("user_wallet_address", userWalletAddress.toLowerCase())
      .select()
      .single();

    if (error) {
      console.error("Error updating sponsor wallet:", error);
      return NextResponse.json(
        { error: "Failed to update wallet" },
        { status: 500 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      wallet,
      message: "Wallet updated successfully",
    });
  } catch (error) {
    console.error("Error in PATCH /api/sponsor/wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
