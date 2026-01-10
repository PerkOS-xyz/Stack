import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { chains, getNativeTokenSymbol, getRpcUrl } from "@/lib/utils/chains";
import { parseEther } from "viem";
import { getParaService } from "@/lib/services/ParaService";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  sponsor_address: string;
  para_wallet_id: string;
  balance: string;
  created_at: string;
}

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

/**
 * POST /api/sponsor/wallets/send
 * Send native tokens from a sponsor wallet to another address
 * Uses Para Server Wallet for signing transactions
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
    const { data: walletData, error: fetchError } = await firebaseAdmin
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

    // Validate Para wallet ID exists
    if (!wallet.para_wallet_id) {
      return NextResponse.json(
        { error: "Wallet missing Para wallet ID - may need migration" },
        { status: 400 }
      );
    }

    // Convert amount to wei
    const valueInWei = parseEther(amount.toString());

    console.log("Sending native transfer via Para:", {
      from: wallet.sponsor_address,
      to: toAddress,
      amount: amount,
      chainId: chain.id,
      valueInWei: valueInWei.toString(),
      paraWalletId: wallet.para_wallet_id,
    });

    // Get Para signer for the sponsor wallet
    const paraService = getParaService();
    const rpcUrl = getRpcUrl(network);
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `No RPC URL configured for network: ${network}` },
        { status: 400 }
      );
    }
    const signer = await paraService.getSigner(wallet.para_wallet_id, rpcUrl);

    // Send native token transfer
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: valueInWei,
    });

    console.log("Transaction submitted:", { hash: tx.hash });

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    if (!receipt || receipt.status === 0) {
      console.error("Transaction reverted:", { hash: tx.hash });
      return NextResponse.json(
        { error: "Transaction reverted on-chain" },
        { status: 400 }
      );
    }

    const transactionHash = receipt.hash;
    const gasUsed = receipt.gasUsed.toString();
    const effectiveGasPrice = receipt.gasPrice?.toString() || "0";

    // Get native token symbol for logging
    const symbol = getNativeTokenSymbol(network);

    // Log the transaction
    console.log(`✅ Transfer sent from ${wallet.sponsor_address} to ${toAddress}`);
    console.log(`   Amount: ${amount} ${symbol}`);
    console.log(`   Network: ${network} (Chain ID: ${chain.id})`);
    console.log(`   Transaction Hash: ${transactionHash}`);
    console.log(`   Gas Used: ${gasUsed}`);

    return NextResponse.json({
      success: true,
      message: "Transaction confirmed",
      transactionHash: transactionHash,
      from: wallet.sponsor_address,
      to: toAddress,
      amount: amount,
      network: network,
      chainId: chain.id,
      symbol: symbol,
      gasUsed: gasUsed,
      effectiveGasPrice: effectiveGasPrice,
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/wallets/send:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
