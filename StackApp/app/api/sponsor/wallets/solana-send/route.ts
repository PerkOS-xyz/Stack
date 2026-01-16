import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { logApiPerformance } from "@/lib/utils/withApiPerformance";
// Note: Wallet service import is done dynamically below to support provider switching

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  sponsor_address: string;
  para_wallet_id: string;
  para_user_share?: string;
  balance: string;
  created_at: string;
}

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

// Solana RPC endpoints
const SOLANA_RPC_URLS: Record<string, string> = {
  "solana": process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "solana-devnet": process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com",
};

// Validate Solana address format (base58, 32-44 characters)
function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * POST /api/sponsor/wallets/solana-send
 * Send SOL from a Solana sponsor wallet to another address
 * Uses Para Server Wallet for signing transactions
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { walletId, toAddress, amount, network } = body;

    console.log("[Solana Send] Request received:", { walletId, toAddress, amount, network });

    // Validate required fields
    if (!walletId || !toAddress || !amount || !network) {
      console.log("[Solana Send] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: walletId, toAddress, amount, network" },
        { status: 400 }
      );
    }

    // Validate Solana network
    const rpcUrl = SOLANA_RPC_URLS[network];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported Solana network: ${network}. Supported: solana, solana-devnet` },
        { status: 400 }
      );
    }

    // Validate recipient address format
    if (!isValidSolanaAddress(toAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana recipient address format" },
        { status: 400 }
      );
    }

    // Check for sendMax flag (similar to EVM send route)
    const isSendMax = body.isSendMax === true || amount === "max";

    // Validate amount (skip if sendMax)
    if (!isSendMax) {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          { error: "Invalid amount" },
          { status: 400 }
        );
      }
    }

    // Get wallet from database
    const { data: walletData, error: fetchError } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("id", walletId)
      .single();

    if (fetchError || !walletData) {
      console.log("[Solana Send] Wallet lookup failed:", { walletId, fetchError });
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 }
      );
    }

    const wallet = walletData as unknown as SponsorWallet;
    console.log("[Solana Send] Wallet found:", {
      id: wallet.id,
      sponsor_address: wallet.sponsor_address,
      has_para_wallet_id: !!wallet.para_wallet_id,
      has_para_user_share: !!wallet.para_user_share
    });

    // Validate wallet address is a Solana address
    if (!isValidSolanaAddress(wallet.sponsor_address)) {
      return NextResponse.json(
        { error: "This wallet is not a Solana wallet" },
        { status: 400 }
      );
    }

    // Validate Para wallet ID exists
    if (!wallet.para_wallet_id) {
      console.log("[Solana Send] Missing para_wallet_id for wallet:", wallet.id);
      return NextResponse.json(
        { error: "Wallet missing Para wallet ID - may need migration" },
        { status: 400 }
      );
    }

    // Check if para_user_share is missing - legacy wallets cannot sign transactions
    if (!wallet.para_user_share) {
      console.log("[Solana Send] Legacy wallet detected (no para_user_share):", wallet.id);
      return NextResponse.json(
        {
          error: "This is a legacy wallet that cannot sign transactions. Please create a new wallet to enable sending.",
          isLegacyWallet: true
        },
        { status: 400 }
      );
    }

    // Create Solana connection (needed for balance check and sending)
    const connection = new Connection(rpcUrl, "confirmed");
    const fromPubkey = new PublicKey(wallet.sponsor_address);
    const toPubkey = new PublicKey(toAddress);

    // Solana fee and rent calculations
    // Transaction fee is typically 5000 lamports per signature
    const TRANSACTION_FEE_LAMPORTS = 5000;
    // Rent-exempt minimum for a basic account (~0.00089 SOL)
    // Accounts must maintain this balance or they get purged
    const RENT_EXEMPT_MINIMUM = 890880;
    // Total reserve needed = fee + rent-exempt minimum
    const TOTAL_RESERVE_LAMPORTS = TRANSACTION_FEE_LAMPORTS + RENT_EXEMPT_MINIMUM;

    // Calculate lamports to send
    let lamports: number;
    let actualAmountSOL: number;

    if (isSendMax) {
      // Get current balance
      const balance = await connection.getBalance(fromPubkey);
      console.log("[Solana Send] Current balance:", balance, "lamports (", balance / LAMPORTS_PER_SOL, "SOL)");
      console.log("[Solana Send] Reserve needed:", TOTAL_RESERVE_LAMPORTS, "lamports (fee:", TRANSACTION_FEE_LAMPORTS, "+ rent:", RENT_EXEMPT_MINIMUM, ")");

      // Calculate max sendable (balance - fee - rent-exempt minimum)
      const maxSendable = balance - TOTAL_RESERVE_LAMPORTS;

      if (maxSendable <= 0) {
        return NextResponse.json(
          {
            error: `Insufficient balance. You need at least ${TOTAL_RESERVE_LAMPORTS / LAMPORTS_PER_SOL} SOL (${RENT_EXEMPT_MINIMUM / LAMPORTS_PER_SOL} SOL rent reserve + ${TRANSACTION_FEE_LAMPORTS / LAMPORTS_PER_SOL} SOL fee).`,
            balance: (balance / LAMPORTS_PER_SOL).toString(),
            rentExemptMinimum: (RENT_EXEMPT_MINIMUM / LAMPORTS_PER_SOL).toString(),
            transactionFee: (TRANSACTION_FEE_LAMPORTS / LAMPORTS_PER_SOL).toString(),
            hint: "Solana accounts must maintain a rent-exempt minimum balance to avoid being purged."
          },
          { status: 400 }
        );
      }

      // Check if max sendable is meaningful (at least 0.0001 SOL)
      const minSendable = 100000; // 0.0001 SOL
      if (maxSendable < minSendable) {
        return NextResponse.json(
          {
            error: `Balance too low. After fees and rent reserve, only ${maxSendable / LAMPORTS_PER_SOL} SOL can be sent.`,
            balance: (balance / LAMPORTS_PER_SOL).toString(),
            maxSendable: (maxSendable / LAMPORTS_PER_SOL).toString(),
            rentExemptMinimum: (RENT_EXEMPT_MINIMUM / LAMPORTS_PER_SOL).toString(),
          },
          { status: 400 }
        );
      }

      lamports = maxSendable;
      actualAmountSOL = lamports / LAMPORTS_PER_SOL;
      console.log("[Solana Send] Sending max amount:", actualAmountSOL, "SOL (keeping", TOTAL_RESERVE_LAMPORTS / LAMPORTS_PER_SOL, "SOL reserve)");
    } else {
      // Use specified amount
      const amountNum = parseFloat(amount);
      lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
      actualAmountSOL = amountNum;

      // Check if user has enough balance (amount + fee + rent reserve)
      const balance = await connection.getBalance(fromPubkey);
      const totalRequired = lamports + TOTAL_RESERVE_LAMPORTS;

      if (totalRequired > balance) {
        const maxSendable = Math.max(0, balance - TOTAL_RESERVE_LAMPORTS);
        return NextResponse.json(
          {
            error: `Insufficient funds. You requested ${amountNum} SOL but max sendable is ${maxSendable / LAMPORTS_PER_SOL} SOL (after fees and rent reserve)`,
            maxSendable: (maxSendable / LAMPORTS_PER_SOL).toString(),
            balance: (balance / LAMPORTS_PER_SOL).toString(),
            rentExemptMinimum: (RENT_EXEMPT_MINIMUM / LAMPORTS_PER_SOL).toString(),
            transactionFee: (TRANSACTION_FEE_LAMPORTS / LAMPORTS_PER_SOL).toString(),
          },
          { status: 400 }
        );
      }
    }

    // Get wallet service (Dynamic or Para based on NEXT_PUBLIC_WALLET_PROVIDER)
    const { getServerWalletService } = await import("@/lib/wallet/server");
    const { ACTIVE_PROVIDER } = await import("@/lib/wallet/config");

    let walletService;
    try {
      walletService = await getServerWalletService();
      if (!walletService.isInitialized()) {
        throw new Error(`${ACTIVE_PROVIDER} wallet service not initialized`);
      }
      console.log(`[Solana Send] ${ACTIVE_PROVIDER} wallet service initialized successfully`);
    } catch (serviceInitError) {
      console.error("[Solana Send] Failed to initialize wallet service:", serviceInitError);
      return NextResponse.json(
        { error: `Wallet service initialization failed: ${serviceInitError instanceof Error ? serviceInitError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Check if provider supports Solana
    if (!walletService.supportsSolana || !walletService.supportsSolana()) {
      console.error(`[Solana Send] ${ACTIVE_PROVIDER} provider does not support Solana`);
      return NextResponse.json(
        { error: `${ACTIVE_PROVIDER} wallet provider does not support Solana transactions` },
        { status: 400 }
      );
    }

    console.log(`[Solana Send] Sending SOL transfer via ${ACTIVE_PROVIDER}:`, {
      from: wallet.sponsor_address,
      to: toAddress,
      amount: actualAmountSOL,
      lamports: lamports,
      network: network,
      walletId: wallet.para_wallet_id,
    });

    // Get Solana signer from active provider
    let solanaSigner;
    try {
      solanaSigner = await walletService.getSolanaSigner!(wallet.para_wallet_id, wallet.para_user_share);
      console.log(`[Solana Send] ${ACTIVE_PROVIDER} Solana signer ready`);
    } catch (signerError) {
      console.error("[Solana Send] Failed to get Solana signer:", signerError);
      return NextResponse.json(
        { error: `Failed to get Solana signer: ${signerError instanceof Error ? signerError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    console.log("[Solana Send] Transaction created, signing...");

    // Sign transaction using Para Solana signer
    const signedTransaction = await solanaSigner.signTransaction(transaction);

    console.log("[Solana Send] Transaction signed, sending...");

    // Send and confirm transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      console.error("[Solana Send] Transaction failed:", confirmation.value.err);
      return NextResponse.json(
        { error: "Transaction failed on-chain" },
        { status: 400 }
      );
    }

    console.log(`✅ [Solana Send] Transfer sent from ${wallet.sponsor_address} to ${toAddress}`);
    console.log(`   Amount: ${actualAmountSOL} SOL (${lamports} lamports)`);
    console.log(`   Network: ${network}`);
    console.log(`   Signature: ${signature}`);

    logApiPerformance("/api/sponsor/wallets/solana-send", "POST", startTime, 200, { network });
    return NextResponse.json({
      success: true,
      message: "Transaction confirmed",
      transactionHash: signature,
      from: wallet.sponsor_address,
      to: toAddress,
      amount: actualAmountSOL.toString(),
      requestedAmount: isSendMax ? "max" : amount,
      lamports: lamports,
      network: network,
      symbol: "SOL",
    });
  } catch (error) {
    console.error("[Solana Send] Error:", error);
    logApiPerformance("/api/sponsor/wallets/solana-send", "POST", startTime, 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
