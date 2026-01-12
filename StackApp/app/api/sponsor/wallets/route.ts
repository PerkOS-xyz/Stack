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
    const validNetworks = ["evm", "solana"];
    if (!validNetworks.includes(network)) {
      return NextResponse.json(
        { error: `Invalid network. Must be "evm" or "solana"` },
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

    // Store wallet in database with Para wallet ID, address, and userShare
    // Para manages keys securely - we store the userShare for server-side signing
    const { data: wallet, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .insert({
        user_wallet_address: userWalletAddress.toLowerCase(),
        network,
        wallet_type: sponsorWallet.walletType, // EVM or SOLANA
        para_wallet_id: sponsorWallet.walletId, // Para wallet ID for signing
        para_user_share: sponsorWallet.userShare, // User share for server-side signing
        sponsor_address: sponsorWallet.address, // EOA address (same across all EVM chains) or Solana address
        balance: "0",
        wallet_name: finalWalletName,
        is_public: isPublic,
        created_at: new Date().toISOString(),
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
 * DELETE /api/sponsor/wallets
 * Deletes a wallet from the database
 * Note: The wallet remains in Para's system but is no longer accessible from our app
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletId, userWalletAddress } = body;

    if (!walletId || !userWalletAddress) {
      return NextResponse.json(
        { error: "walletId and userWalletAddress required" },
        { status: 400 }
      );
    }

    // First, verify the wallet exists and belongs to the user
    const { data: existingWallet, error: fetchError } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("id", walletId)
      .eq("user_wallet_address", userWalletAddress.toLowerCase())
      .single();

    if (fetchError || !existingWallet) {
      console.error("Wallet not found or access denied:", { walletId, fetchError });
      return NextResponse.json(
        { error: "Wallet not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the wallet from database
    // Note: Para doesn't provide a delete wallet API - the wallet remains in Para's system
    // but we lose access to it since we're removing our reference
    const { error: deleteError } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .delete()
      .eq("id", walletId)
      .eq("user_wallet_address", userWalletAddress.toLowerCase());

    if (deleteError) {
      console.error("Error deleting wallet:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete wallet" },
        { status: 500 }
      );
    }

    console.log(`✅ Wallet deleted successfully:`);
    console.log(`   Wallet ID: ${walletId}`);
    console.log(`   Address: ${existingWallet.sponsor_address}`);
    console.log(`   User: ${userWalletAddress}`);

    return NextResponse.json({
      success: true,
      message: "Wallet deleted successfully",
      deletedWallet: {
        id: walletId,
        address: existingWallet.sponsor_address,
        name: existingWallet.wallet_name,
      },
    });
  } catch (error) {
    console.error("Error in DELETE /api/sponsor/wallets:", error);
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
