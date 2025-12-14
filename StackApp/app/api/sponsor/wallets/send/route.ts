import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { chains, getNativeTokenSymbol } from "@/lib/utils/chains";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  sponsor_address: string;
  smart_wallet_address: string | null;
  balance: string;
  created_at: string;
}

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

/**
 * POST /api/sponsor/wallets/send
 * Send native tokens from a sponsor wallet to another address
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletId, toAddress, amount, network } = body;

    // Validate required fields
    if (!walletId || !toAddress || !amount || !network) {
      return NextResponse.json(
        { error: "Missing required fields: walletId, toAddress, amount, network" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return NextResponse.json(
        { error: "Invalid recipient address format" },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
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

    // Get wallet from database
    const { data: walletData, error: fetchError } = await supabaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("id", walletId)
      .single();

    if (fetchError || !walletData) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    const wallet = walletData as unknown as SponsorWallet;

    // For server wallets, we need to use the Engine API or export the private key
    // Since this is a Thirdweb server wallet, we'll use the Engine API
    const engineUrl = process.env.THIRDWEB_ENGINE_URL || "https://engine.thirdweb.com";
    const engineAccessToken = process.env.THIRDWEB_ENGINE_ACCESS_TOKEN;

    if (!engineAccessToken) {
      return NextResponse.json(
        { error: "Thirdweb Engine access token not configured" },
        { status: 500 }
      );
    }

    // Send transaction via Thirdweb Engine
    const response = await fetch(`${engineUrl}/backend-wallet/${chain.id}/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${engineAccessToken}`,
        "x-backend-wallet-address": wallet.sponsor_address,
      },
      body: JSON.stringify({
        to: toAddress,
        currencyAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Native token
        amount: amount.toString(),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Engine transfer error:", result);
      return NextResponse.json(
        { error: result.error?.message || "Transaction failed" },
        { status: 400 }
      );
    }

    // Get native token symbol for logging
    const symbol = getNativeTokenSymbol(network);

    // Log the transaction
    console.log(`✅ Transfer sent from ${wallet.sponsor_address} to ${toAddress}`);
    console.log(`   Amount: ${amount} ${symbol}`);
    console.log(`   Network: ${network} (Chain ID: ${chain.id})`);
    console.log(`   Queue ID: ${result.result?.queueId}`);

    return NextResponse.json({
      success: true,
      message: "Transaction submitted",
      queueId: result.result?.queueId,
      from: wallet.sponsor_address,
      to: toAddress,
      amount: amount,
      network: network,
      chainId: chain.id,
      symbol: symbol,
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/wallets/send:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
