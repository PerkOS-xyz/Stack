import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { chains, getNativeTokenSymbol } from "@/lib/utils/chains";
import { parseEther } from "viem";
import { getParaService } from "@/lib/services/ParaService";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  sponsor_address: string;
  para_wallet_id: string;
  para_user_share?: string; // User share for server-side signing
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

    console.log("Send request received:", { walletId, toAddress, amount, network });

    // Validate required fields
    if (!walletId || !toAddress || !amount || !network) {
      console.log("Missing required fields:", { walletId: !!walletId, toAddress: !!toAddress, amount: !!amount, network: !!network });
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
    console.log("Chain lookup:", { network, chainFound: !!chain, availableChains: Object.keys(chains) });
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
      console.log("Wallet lookup failed:", { walletId, fetchError });
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    const wallet = walletData as unknown as SponsorWallet;
    console.log("Wallet found:", {
      id: wallet.id,
      sponsor_address: wallet.sponsor_address,
      has_para_wallet_id: !!wallet.para_wallet_id,
      has_para_user_share: !!wallet.para_user_share
    });

    // Validate Para wallet ID exists
    if (!wallet.para_wallet_id) {
      console.log("Missing para_wallet_id for wallet:", wallet.id);
      return NextResponse.json(
        { error: "Wallet missing Para wallet ID - may need migration" },
        { status: 400 }
      );
    }

    // Check if para_user_share is missing - legacy wallets cannot sign transactions
    if (!wallet.para_user_share) {
      console.log("Legacy wallet detected (no para_user_share):", wallet.id);
      return NextResponse.json(
        {
          error: "This is a legacy wallet that cannot sign transactions. Please create a new wallet to enable sending.",
          isLegacyWallet: true
        },
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
    // Get RPC URL directly from chain definition
    const rpcUrl = chain.rpcUrls.default.http[0];
    console.log("Using RPC URL:", rpcUrl);

    // Get ethers signer with userShare
    const signer = await paraService.getSigner(wallet.para_wallet_id, rpcUrl, wallet.para_user_share);

    console.log("Para signer ready, sending transaction...");

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
