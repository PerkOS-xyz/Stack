import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { chains, getNativeTokenSymbol } from "@/lib/utils/chains";
import { parseEther, formatEther, createPublicClient, http, type Hex } from "viem";
import { logApiPerformance } from "@/lib/utils/withApiPerformance";
// Note: Wallet service import is done dynamically below to support provider switching

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
  const startTime = Date.now();
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

    // Validate amount (skip if isSendMax is true or amount is "max")
    const isSendMax = body.isSendMax === true || amount === "max";
    if (!isSendMax) {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          { error: "Invalid amount" },
          { status: 400 }
        );
      }
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

    // Validate wallet ID exists (field named para_wallet_id for backward compatibility)
    if (!wallet.para_wallet_id) {
      console.log("Missing wallet ID for wallet:", wallet.id);
      return NextResponse.json(
        { error: "Wallet missing provider wallet ID - may need migration" },
        { status: 400 }
      );
    }

    // Check if key material is missing - legacy wallets cannot sign transactions
    // (field named para_user_share for backward compatibility)
    if (!wallet.para_user_share) {
      console.log("Legacy wallet detected (no key material):", wallet.id);
      return NextResponse.json(
        {
          error: "This is a legacy wallet that cannot sign transactions. Please create a new wallet to enable sending.",
          isLegacyWallet: true
        },
        { status: 400 }
      );
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
      console.log(`${ACTIVE_PROVIDER} wallet service initialized successfully`);
    } catch (serviceInitError) {
      console.error("Failed to initialize wallet service:", serviceInitError);
      return NextResponse.json(
        { error: `Wallet service initialization failed: ${serviceInitError instanceof Error ? serviceInitError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Get viem wallet client for the sponsor wallet
    let walletClient;
    try {
      walletClient = await walletService.getViemClient(wallet.para_wallet_id, chain, wallet.para_user_share);
      console.log(`${ACTIVE_PROVIDER} wallet client ready`);
    } catch (clientError) {
      console.error("Failed to get wallet client:", clientError);
      return NextResponse.json(
        { error: `Failed to get wallet client: ${clientError instanceof Error ? clientError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create public client for balance and gas queries
    const publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });

    // Get current balance and estimate gas to ensure sufficient funds
    const balance = await publicClient.getBalance({ address: wallet.sponsor_address as Hex });
    const gasPrice = await publicClient.getGasPrice();

    // Standard gas limit for native transfer is 21000
    const gasLimit = BigInt(21000);
    let maxFeePerGas = gasPrice;

    // Some RPC endpoints return unrealistically low fee data
    // Add minimum gas price floors for different networks
    const GWEI = BigInt(1_000_000_000); // 1 gwei in wei
    const minGasPriceByNetwork: Record<string, bigint> = {
      'ethereum': BigInt(50) * GWEI,    // Min 50 gwei for Ethereum mainnet (can be 20-100+ gwei)
      'sepolia': BigInt(5) * GWEI,      // Min 5 gwei for Sepolia testnet
      'polygon': BigInt(50) * GWEI,     // Min 50 gwei for Polygon
      'polygon-amoy': BigInt(5) * GWEI, // Min 5 gwei for Polygon Amoy testnet
      'avalanche': BigInt(25) * GWEI,   // Min 25 nAVAX for Avalanche
      'avalanche-fuji': BigInt(25) * GWEI, // Min 25 nAVAX for Avalanche Fuji
    };
    const minGasPrice = minGasPriceByNetwork[network] || BigInt(1) * GWEI; // Default 1 gwei minimum

    // Apply minimum gas price if the RPC returned something too low
    if (maxFeePerGas < minGasPrice) {
      console.log(`Gas price too low (${formatEther(maxFeePerGas)} ETH/gas), using minimum: ${formatEther(minGasPrice)} ETH/gas`);
      maxFeePerGas = minGasPrice;
    }

    const estimatedGasCost = gasLimit * maxFeePerGas;

    // L2 networks (Base, Optimism, Arbitrum) have additional L1 data fees
    // that are NOT included in the regular gas estimation.
    // We need to add a buffer for this L1 data availability cost.
    const L2_NETWORKS = ['base', 'base-sepolia', 'optimism', 'optimism-sepolia', 'arbitrum', 'arbitrum-sepolia'];
    const isL2Network = L2_NETWORKS.includes(network);

    // High-gas networks like Ethereum mainnet need larger buffers due to price volatility
    const HIGH_GAS_NETWORKS = ['ethereum', 'polygon'];
    const isHighGasNetwork = HIGH_GAS_NETWORKS.includes(network);

    // For L2s, add a larger buffer to account for L1 data fees
    // For high-gas L1s, add buffer for price volatility
    // L1 data fee for a simple transfer is typically 0.00005-0.0005 ETH depending on L1 gas prices
    let bufferMultiplier: bigint;
    if (isL2Network) {
      bufferMultiplier = BigInt(600); // 6x for L2 (L1 data fees)
    } else if (isHighGasNetwork) {
      bufferMultiplier = BigInt(200); // 2x for high-gas L1s (price volatility)
    } else {
      bufferMultiplier = BigInt(120); // 1.2x for other networks
    }
    let gasCostWithBuffer = (estimatedGasCost * bufferMultiplier) / BigInt(100);

    // For L2 networks, also add a minimum fixed buffer for L1 data fee
    // This ensures we have enough even when L2 gas is very cheap but L1 is expensive
    // Base/Optimism L1 data fees can be 0.0001-0.0005+ ETH depending on L1 gas prices
    if (isL2Network) {
      const minL1DataFee = parseEther("0.0005"); // Minimum 0.0005 ETH buffer for L1 data + L2 gas
      if (gasCostWithBuffer < minL1DataFee) {
        gasCostWithBuffer = minL1DataFee;
      }
    }

    console.log("Balance and gas check:", {
      balance: formatEther(balance),
      estimatedGasCost: formatEther(estimatedGasCost),
      gasCostWithBuffer: formatEther(gasCostWithBuffer),
      maxFeePerGas: maxFeePerGas.toString(),
      isL2Network,
      bufferMultiplier: bufferMultiplier.toString(),
    });

    // Calculate max sendable amount (balance - gas with buffer)
    const maxSendable = balance > gasCostWithBuffer ? balance - gasCostWithBuffer : BigInt(0);

    // Use the isSendMax flag we computed earlier

    let valueInWei: bigint;
    if (isSendMax) {
      if (maxSendable <= BigInt(0)) {
        const networkName = isL2Network ? `${network} (L2)` : network;
        return NextResponse.json(
          {
            error: `Insufficient balance to cover transaction fees on ${networkName}. You need at least ${formatEther(gasCostWithBuffer)} ${getNativeTokenSymbol(network)} for fees.`,
            balance: formatEther(balance),
            estimatedGas: formatEther(gasCostWithBuffer),
            isL2Network,
            hint: isL2Network ? "L2 networks like Base require ETH for both L2 execution and L1 data availability fees." : undefined,
          },
          { status: 400 }
        );
      }
      // Check if max sendable is too small to be meaningful (less than 0.00001 ETH)
      const minSendableAmount = parseEther("0.00001");
      if (maxSendable < minSendableAmount) {
        return NextResponse.json(
          {
            error: `Balance too low. After gas fees, only ${formatEther(maxSendable)} ${getNativeTokenSymbol(network)} can be sent, which is below the minimum threshold.`,
            balance: formatEther(balance),
            estimatedGas: formatEther(gasCostWithBuffer),
            maxSendable: formatEther(maxSendable),
          },
          { status: 400 }
        );
      }
      valueInWei = maxSendable;
      console.log("Sending max amount:", formatEther(valueInWei));
    } else {
      valueInWei = parseEther(amount.toString());

      // Check if amount + gas exceeds balance
      const totalRequired = valueInWei + gasCostWithBuffer;
      if (totalRequired > balance) {
        const maxSendableFormatted = formatEther(maxSendable);
        console.log("Insufficient funds:", {
          requested: amount,
          balance: formatEther(balance),
          gasCost: formatEther(gasCostWithBuffer),
          maxSendable: maxSendableFormatted,
        });
        return NextResponse.json(
          {
            error: `Insufficient funds. You requested ${amount} but max sendable is ${maxSendableFormatted} (after gas fees)`,
            maxSendable: maxSendableFormatted,
            balance: formatEther(balance),
            estimatedGas: formatEther(gasCostWithBuffer),
          },
          { status: 400 }
        );
      }
    }

    console.log("Sending native transfer:", {
      from: wallet.sponsor_address,
      to: toAddress,
      amount: formatEther(valueInWei),
      chainId: chain.id,
      valueInWei: valueInWei.toString(),
      walletId: wallet.para_wallet_id,
    });

    // Send native token transfer using viem
    let transactionHash: Hex;
    try {
      // Wallet client from getViemClient() already has account attached
      if (!walletClient.account) {
        throw new Error("Wallet client account not found");
      }
      transactionHash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: toAddress as Hex,
        value: valueInWei,
        gas: gasLimit,
        chain,
      });
      console.log("Transaction submitted:", { hash: transactionHash });
    } catch (sendError) {
      console.error("Failed to send transaction:", sendError);
      return NextResponse.json(
        { error: `Transaction failed: ${sendError instanceof Error ? sendError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Wait for transaction confirmation
    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: 1,
      });
    } catch (waitError) {
      console.error("Failed waiting for confirmation:", waitError);
      return NextResponse.json(
        { error: `Transaction sent but confirmation failed: ${waitError instanceof Error ? waitError.message : 'Unknown error'}. Tx hash: ${transactionHash}` },
        { status: 500 }
      );
    }

    if (!receipt || receipt.status === "reverted") {
      console.error("Transaction reverted:", { hash: transactionHash });
      return NextResponse.json(
        { error: "Transaction reverted on-chain" },
        { status: 400 }
      );
    }

    const gasUsed = receipt.gasUsed.toString();
    const effectiveGasPrice = receipt.effectiveGasPrice?.toString() || "0";

    // Get native token symbol for logging
    const symbol = getNativeTokenSymbol(network);

    // Calculate actual amount sent
    const actualAmountSent = formatEther(valueInWei);

    // Log the transaction
    console.log(`✅ Transfer sent from ${wallet.sponsor_address} to ${toAddress}`);
    console.log(`   Amount: ${actualAmountSent} ${symbol}`);
    console.log(`   Network: ${network} (Chain ID: ${chain.id})`);
    console.log(`   Transaction Hash: ${transactionHash}`);
    console.log(`   Gas Used: ${gasUsed}`);

    logApiPerformance("/api/sponsor/wallets/send", "POST", startTime, 200, { network });
    return NextResponse.json({
      success: true,
      message: "Transaction confirmed",
      transactionHash: transactionHash,
      from: wallet.sponsor_address,
      to: toAddress,
      amount: actualAmountSent,
      requestedAmount: isSendMax ? "max" : amount,
      network: network,
      chainId: chain.id,
      symbol: symbol,
      gasUsed: gasUsed,
      effectiveGasPrice: effectiveGasPrice,
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/wallets/send:", error);
    logApiPerformance("/api/sponsor/wallets/send", "POST", startTime, 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
