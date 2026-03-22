/**
 * /api/v2/agents/wallets
 * 
 * GET  — List agent's server wallets
 * POST — Create a new server wallet for the agent
 * 
 * Requires X-API-Key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/middleware/apiKeyAuth";
import { firebaseAdmin } from "@/lib/db/firebase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, ["read"]);
    if (auth.response) return auth.response;

    const { data: wallets, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("user_wallet_address", auth.agent.walletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch wallets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      wallets: (wallets || []).map((w) => ({
        id: w.id,
        address: w.sponsor_address,
        network: w.network,
        walletType: w.wallet_type,
        name: w.wallet_name,
        balance: w.balance,
        createdAt: w.created_at,
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/v2/agents/wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, ["write"]);
    if (auth.response) return auth.response;

    const body = await req.json();
    let { network = "evm", name } = body;

    // Validate network
    const validNetworks = ["evm", "solana"];
    if (!validNetworks.includes(network)) {
      return NextResponse.json(
        { error: `Invalid network. Must be "evm" or "solana"` },
        { status: 400 }
      );
    }

    // Count existing wallets for naming
    const { count } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*", { count: "exact", head: true })
      .eq("user_wallet_address", auth.agent.walletAddress);

    const walletName =
      name?.trim() || (count && count > 0 ? `Agent Wallet ${count + 1}` : "Default Agent Wallet");

    // Dynamic import to avoid loading SDK for GET requests
    const { getServerWalletService } = await import("@/lib/wallet/server");
    const walletService = await getServerWalletService();

    if (!walletService.isInitialized()) {
      return NextResponse.json(
        { error: "Wallet service not configured" },
        { status: 500 }
      );
    }

    const sponsorWallet = await walletService.createWallet(
      auth.agent.walletAddress,
      network as "evm" | "solana"
    );

    const { data: wallet, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .insert({
        user_wallet_address: auth.agent.walletAddress,
        network,
        wallet_type: sponsorWallet.walletType,
        para_wallet_id: sponsorWallet.walletId,
        para_user_share: sponsorWallet.keyMaterial,
        sponsor_address: sponsorWallet.address,
        balance: "0",
        wallet_name: walletName,
        is_public: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !wallet) {
      return NextResponse.json(
        { error: "Failed to store wallet" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        wallet: {
          id: wallet.id,
          address: wallet.sponsor_address,
          network: wallet.network,
          walletType: wallet.wallet_type,
          name: wallet.wallet_name,
        },
        message: "Wallet created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/v2/agents/wallets:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
