import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { chains, getNativeTokenSymbol } from "@/lib/utils/chains";
import { parseEther } from "viem";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  sponsor_address: string;
  turnkey_wallet_id: string;
  smart_wallet_address: string | null;
  balance: string;
  created_at: string;
}

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

/**
 * Poll for transaction status from Thirdweb API
 * Returns early if transaction is confirmed, failed, or times out
 */
async function pollTransactionStatus(
  transactionId: string,
  secretKey: string,
  maxAttempts = 60 // Increased from 30 to 60 (2 minutes max)
): Promise<{ success: boolean; transactionHash?: string; error?: string; status?: string; pending?: boolean }> {
  console.log(`Starting poll for transaction ${transactionId} (max ${maxAttempts} attempts)`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(
        `https://api.thirdweb.com/v1/transactions/${transactionId}`,
        {
          headers: {
            "x-secret-key": secretKey,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const txHash = data.result?.transactionHash || data.transactionHash;
        const status = (data.result?.status || data.status || "").toLowerCase();

        // Log every 5th attempt for debugging
        if (i % 5 === 0) {
          console.log(`Poll attempt ${i + 1}/${maxAttempts}: status="${status}", hasHash=${!!txHash}`);
        }

        if (txHash) {
          console.log(`✅ Transaction confirmed with hash: ${txHash}`);
          return { success: true, transactionHash: txHash, status };
        }

        if (status === "failed" || status === "errored" || status === "error") {
          const errorMessage =
            data.result?.errorMessage ||
            data.errorMessage ||
            data.result?.error ||
            data.error ||
            "Transaction failed";
          console.error(`❌ Transaction failed: ${errorMessage}`);
          return { success: false, error: errorMessage, status };
        }

        if (status === "confirmed" || status === "mined" || status === "success") {
          const hash = data.result?.hash || data.hash || data.result?.onChainTxHash;
          if (hash) {
            console.log(`✅ Transaction confirmed with hash: ${hash}`);
            return { success: true, transactionHash: hash, status };
          }
        }
      } else {
        console.warn(`Poll attempt ${i + 1} returned status ${response.status}`);
      }

      // Wait 2 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn(`Poll attempt ${i + 1} failed:`, error);
    }
  }

  console.warn(`⏳ Transaction ${transactionId} still pending after ${maxAttempts * 2}s`);
  return { success: true, pending: true, error: undefined, status: "pending" };
}

/**
 * POST /api/sponsor/wallets/send
 * Send native tokens from a sponsor wallet to another address
 * Uses Thirdweb Server Wallet API (v1/write/transaction)
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

    // Get Thirdweb secret key (required for server wallet operations)
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "Thirdweb secret key not configured" },
        { status: 500 }
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

    // Convert amount to wei
    const valueInWei = parseEther(amount.toString());

    // Use Thirdweb Server Wallet API to send transaction
    // POST https://engine.thirdweb.com/v1/write/transaction
    const requestBody = {
      executionOptions: {
        type: "EOA",
        from: wallet.sponsor_address,
        chainId: chain.id,
      },
      params: [
        {
          to: toAddress,
          value: valueInWei.toString(),
          data: "0x", // Empty data for native transfer
        },
      ],
    };

    console.log("Sending native transfer via Thirdweb:", {
      from: wallet.sponsor_address,
      to: toAddress,
      amount: amount,
      chainId: chain.id,
      valueInWei: valueInWei.toString(),
    });

    const response = await fetch("https://engine.thirdweb.com/v1/write/transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-secret-key": secretKey,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Thirdweb API error:", result);
      return NextResponse.json(
        { error: result.error?.message || result.message || "Transaction failed" },
        { status: 400 }
      );
    }

    console.log("Thirdweb response:", JSON.stringify(result, null, 2));

    // Extract transaction ID from response
    const transactions = result.result?.transactions || result.transactions;
    let transactionHash: string | undefined;
    let queueId: string | undefined;

    let isPending = false;

    if (transactions && Array.isArray(transactions) && transactions.length > 0) {
      const transactionId = transactions[0].id;
      console.log("Polling for transaction hash...", { transactionId });

      const pollResult = await pollTransactionStatus(transactionId, secretKey);
      if (pollResult.transactionHash) {
        transactionHash = pollResult.transactionHash;
      } else if (pollResult.pending) {
        // Transaction is still processing - return success with queue ID
        isPending = true;
      } else if (!pollResult.success) {
        return NextResponse.json(
          { error: pollResult.error || "Transaction failed" },
          { status: 400 }
        );
      }
      queueId = transactionId;
    } else if (result.transactionHash) {
      transactionHash = result.transactionHash;
    } else if (result.queueId || result.result?.queueId) {
      queueId = result.queueId || result.result?.queueId;
      if (queueId) {
        const pollResult = await pollTransactionStatus(queueId, secretKey);
        if (pollResult.transactionHash) {
          transactionHash = pollResult.transactionHash;
        } else if (pollResult.pending) {
          isPending = true;
        }
      }
    }

    // Get native token symbol for logging
    const symbol = getNativeTokenSymbol(network);

    // Log the transaction
    console.log(`✅ Transfer sent from ${wallet.sponsor_address} to ${toAddress}`);
    console.log(`   Amount: ${amount} ${symbol}`);
    console.log(`   Network: ${network} (Chain ID: ${chain.id})`);
    if (transactionHash) {
      console.log(`   Transaction Hash: ${transactionHash}`);
    }
    if (queueId) {
      console.log(`   Queue ID: ${queueId}`);
    }

    // Determine appropriate message based on state
    let message = "Transaction submitted";
    if (transactionHash) {
      message = "Transaction confirmed";
    } else if (isPending) {
      message = "Transaction pending - check explorer for status";
    }

    return NextResponse.json({
      success: true,
      message,
      transactionHash: transactionHash,
      queueId: queueId,
      pending: isPending,
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
