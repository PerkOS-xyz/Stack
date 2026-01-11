import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionService } from "@/lib/services/SubscriptionService";
import { SUBSCRIPTION_TIERS, getAllTiers, SubscriptionTier } from "@/lib/config/subscriptions";
import { createPublicClient, http, parseUnits, formatUnits, type Address } from "viem";
import { getChainByNetwork, getUSDCAddress, getChainIdFromNetwork, type SupportedNetwork } from "@/lib/utils/chains";
import { config } from "@/lib/utils/config";

export const dynamic = "force-dynamic";

// ERC20 ABI for transfer function
const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * POST /api/subscription/pay
 * Process subscription payment via USDC transfer
 *
 * Body: {
 *   userWalletAddress: string,
 *   tier: SubscriptionTier,
 *   billingCycle: "monthly" | "yearly",
 *   network: SupportedNetwork,
 *   transactionHash: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userWalletAddress,
      tier,
      billingCycle,
      network,
      transactionHash,
    } = body;

    // Validate required fields
    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "userWalletAddress required" },
        { status: 400 }
      );
    }

    if (!tier || !getAllTiers().includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${getAllTiers().join(", ")}` },
        { status: 400 }
      );
    }

    if (!billingCycle || !["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        { error: "billingCycle must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    if (!network) {
      return NextResponse.json(
        { error: "network required" },
        { status: 400 }
      );
    }

    if (!transactionHash) {
      return NextResponse.json(
        { error: "transactionHash required" },
        { status: 400 }
      );
    }

    // Get tier config and expected price
    const tierConfig = SUBSCRIPTION_TIERS[tier as SubscriptionTier];
    const expectedPrice = billingCycle === "monthly"
      ? tierConfig.priceMonthly
      : tierConfig.priceYearly;

    if (expectedPrice <= 0) {
      return NextResponse.json(
        { error: "This tier cannot be purchased directly" },
        { status: 400 }
      );
    }

    // Verify the transaction on-chain
    const chain = getChainByNetwork(network as SupportedNetwork);
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported network: ${network}` },
        { status: 400 }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    });

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 400 }
      );
    }

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 400 }
      );
    }

    // Get transaction details
    const transaction = await client.getTransaction({
      hash: transactionHash as `0x${string}`,
    });

    // Verify the payment recipient is our payment receiver
    const paymentReceiver = config.paymentReceiver?.toLowerCase();
    if (!paymentReceiver) {
      console.error("NEXT_PUBLIC_X402_PAYMENT_RECEIVER not configured");
      return NextResponse.json(
        { error: "Payment receiver not configured" },
        { status: 500 }
      );
    }

    // Get USDC address for this network
    const chainId = getChainIdFromNetwork(network as SupportedNetwork);
    if (!chainId) {
      return NextResponse.json(
        { error: `Chain ID not found for network: ${network}` },
        { status: 400 }
      );
    }
    const usdcAddress = getUSDCAddress(chainId);
    if (!usdcAddress) {
      return NextResponse.json(
        { error: `USDC not configured for network: ${network}` },
        { status: 400 }
      );
    }

    // Verify transaction is to USDC contract (ERC20 transfer)
    if (transaction.to?.toLowerCase() !== usdcAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Invalid transaction: not a USDC transfer" },
        { status: 400 }
      );
    }

    // Parse transfer event to get recipient and amount
    // ERC20 Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const transferLog = receipt.logs.find(
      (log) => log.topics[0] === transferEventSignature
    );

    if (!transferLog) {
      return NextResponse.json(
        { error: "No transfer event found in transaction" },
        { status: 400 }
      );
    }

    // Extract recipient from topics (topic[2] is "to" address)
    const toAddress = `0x${transferLog.topics[2]?.slice(26)}`.toLowerCase();
    if (toAddress !== paymentReceiver) {
      return NextResponse.json(
        { error: "Payment was not sent to the correct receiver" },
        { status: 400 }
      );
    }

    // Extract and verify amount (USDC has 6 decimals)
    const transferredAmount = BigInt(transferLog.data);
    const expectedAmount = parseUnits(expectedPrice.toString(), 6);

    // Allow 1% tolerance for gas fluctuations or rounding
    const minAmount = (expectedAmount * BigInt(99)) / BigInt(100);
    if (transferredAmount < minAmount) {
      return NextResponse.json(
        {
          error: `Insufficient payment. Expected ${formatUnits(expectedAmount, 6)} USDC, received ${formatUnits(transferredAmount, 6)} USDC`
        },
        { status: 400 }
      );
    }

    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now);
    if (billingCycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Create or update subscription
    const subscriptionService = getSubscriptionService();
    const subscription = await subscriptionService.createOrUpdateSubscription(
      userWalletAddress,
      tier as SubscriptionTier,
      {
        expiresAt,
      }
    );

    console.log(`✅ Subscription payment processed for ${userWalletAddress}:`);
    console.log(`   Tier: ${tier}`);
    console.log(`   Billing: ${billingCycle}`);
    console.log(`   Network: ${network}`);
    console.log(`   Amount: ${formatUnits(transferredAmount, 6)} USDC`);
    console.log(`   TX: ${transactionHash}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        startedAt: subscription.started_at,
        expiresAt: subscription.expires_at,
      },
      payment: {
        amount: formatUnits(transferredAmount, 6),
        network,
        transactionHash,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/subscription/pay:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscription/pay/requirements
 * Get payment requirements for a specific tier
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier");
    const billingCycle = searchParams.get("billingCycle") || "monthly";

    if (!tier || !getAllTiers().includes(tier as SubscriptionTier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${getAllTiers().join(", ")}` },
        { status: 400 }
      );
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier as SubscriptionTier];
    const price = billingCycle === "monthly"
      ? tierConfig.priceMonthly
      : tierConfig.priceYearly;

    const paymentReceiver = config.paymentReceiver;
    if (!paymentReceiver) {
      return NextResponse.json(
        { error: "Payment receiver not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requirements: {
        tier,
        tierName: tierConfig.displayName,
        billingCycle,
        price,
        priceInMicroUnits: parseUnits(price.toString(), 6).toString(),
        paymentReceiver,
        asset: "USDC",
        decimals: 6,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/subscription/pay:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
