import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionService } from "@/lib/services/SubscriptionService";
import { getCouponService } from "@/lib/services/CouponService";
import { SUBSCRIPTION_TIERS, getAllTiers, SubscriptionTier } from "@/lib/config/subscriptions";
import { parseUnits, formatUnits, type Address } from "viem";
import { getChainIdFromNetwork, getUSDCAddress, type SupportedNetwork } from "@/lib/utils/chains";
import { config } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";
import { subscriptionPayX402Schema, validateBody } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/pay/x402
 * Process subscription payment via x402 protocol (signed authorization)
 *
 * Body: {
 *   userWalletAddress: string,
 *   tier: SubscriptionTier,
 *   billingCycle: "monthly" | "yearly",
 *   network: SupportedNetwork,
 *   paymentPayload: {
 *     x402Version: number,
 *     scheme: string,
 *     network: string,
 *     payload: {
 *       network: string,
 *       authorization: {
 *         from: string,
 *         to: string,
 *         value: string,
 *         nonce: string,
 *         validAfter: string,
 *         validBefore: string,
 *       },
 *       signature: string,
 *     }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request shape/types before running any payment logic.
    // (Domain checks below — tier allowlist, amount, signature — still apply.)
    const validation = validateBody(subscriptionPayX402Schema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      userWalletAddress,
      tier,
      billingCycle,
      network,
      paymentPayload,
      coupon,
    } = body;

    // Initialize services
    const couponService = getCouponService();

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

    if (!paymentPayload || !paymentPayload.payload) {
      return NextResponse.json(
        { error: "paymentPayload required" },
        { status: 400 }
      );
    }

    // Get tier config and expected price
    const tierConfig = SUBSCRIPTION_TIERS[tier as SubscriptionTier];
    const originalPrice = billingCycle === "monthly"
      ? tierConfig.priceMonthly
      : tierConfig.priceYearly;

    if (originalPrice <= 0) {
      return NextResponse.json(
        { error: "This tier cannot be purchased directly" },
        { status: 400 }
      );
    }

    // Calculate expected price (with coupon discount if applicable).
    // SECURITY: never trust the client-supplied `coupon` pricing. Re-validate
    // the coupon server-side and recompute the discount from the authoritative
    // coupon record — otherwise a caller could send `coupon.final_amount: 0.01`
    // and pay a token amount for any paid tier.
    let expectedPrice = originalPrice;
    let discountAmount = 0;
    let appliedCoupon: { id?: string; code?: string } | null = null;

    const couponCode: string | undefined = coupon?.code;
    if (couponCode) {
      const couponResult = await couponService.validateCoupon(
        couponCode,
        userWalletAddress,
        tier,
        originalPrice
      );
      if (couponResult.valid) {
        expectedPrice = couponResult.final_amount;
        discountAmount = couponResult.discount_amount;
        appliedCoupon = {
          id: couponResult.coupon?.id,
          code: couponResult.coupon?.code,
        };
      } else {
        // Invalid/expired/ineligible coupon → charge full price. The client's
        // authorization (signed for the discounted amount) will then fail the
        // amount check below, surfacing a clear error.
        console.warn(
          `Coupon "${couponCode}" rejected for ${userWalletAddress}: ${couponResult.error}`
        );
      }
    }

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

    // Extract authorization from payload
    const { authorization, signature } = paymentPayload.payload;

    // Verify the sender matches the user wallet
    if (authorization.from.toLowerCase() !== userWalletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Payment sender does not match user wallet" },
        { status: 400 }
      );
    }

    // Verify the recipient matches our payment receiver
    if (authorization.to.toLowerCase() !== paymentReceiver) {
      return NextResponse.json(
        { error: "Payment was not sent to the correct receiver" },
        { status: 400 }
      );
    }

    // Verify the amount (USDC has 6 decimals)
    const expectedAmount = parseUnits(expectedPrice.toString(), 6);
    const paymentAmount = BigInt(authorization.value);

    // Allow 1% tolerance for rounding
    const minAmount = (expectedAmount * BigInt(99)) / BigInt(100);
    if (paymentAmount < minAmount) {
      return NextResponse.json(
        {
          error: `Insufficient payment. Expected ${formatUnits(expectedAmount, 6)} USDC, received ${formatUnits(paymentAmount, 6)} USDC`
        },
        { status: 400 }
      );
    }

    // Create payment requirements for x402 verification
    const paymentRequirements = {
      scheme: "exact" as const,
      network: network,
      maxAmountRequired: expectedAmount.toString(),
      resource: `/api/subscription/pay/x402`,
      description: `Subscription payment for ${tierConfig.displayName} (${billingCycle})`,
      payTo: paymentReceiver as Address,
      maxTimeoutSeconds: 3600,
      asset: usdcAddress as Address,
    };

    // Use X402Service for verification and settlement
    const x402Service = new X402Service();

    console.log(`🔍 Verifying x402 payment for ${userWalletAddress}:`, {
      tier,
      billingCycle,
      network,
      amount: formatUnits(paymentAmount, 6),
    });

    // Create the x402 request object
    const x402Request = {
      x402Version: paymentPayload.x402Version || 1,
      paymentPayload,
      paymentRequirements,
    };

    // Verify the payment
    const verifyResult = await x402Service.verify(x402Request);

    if (!verifyResult.isValid) {
      console.error("Payment verification failed:", verifyResult.invalidReason);
      return NextResponse.json(
        { error: verifyResult.invalidReason || "Payment verification failed" },
        { status: 400 }
      );
    }

    console.log(`Payment verified for ${userWalletAddress}`);

    // Settle the payment on-chain
    const settleResult = await x402Service.settle(x402Request);

    if (!settleResult.success) {
      console.error("Payment settlement failed:", settleResult.errorReason);
      return NextResponse.json(
        { error: settleResult.errorReason || "Payment settlement failed" },
        { status: 500 }
      );
    }

    console.log(`Payment settled for ${userWalletAddress}:`, {
      transactionHash: settleResult.transaction,
    });

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

    console.log(`Subscription created/updated for ${userWalletAddress}:`, {
      tier,
      billingCycle,
      network,
      amount: formatUnits(paymentAmount, 6),
      transactionHash: settleResult.transaction,
      expiresAt: expiresAt.toISOString(),
    });

    // Create invoice record (linked to subscription)
    try {
      const invoice = await couponService.createInvoice({
        user_wallet: userWalletAddress,
        subscription_id: subscription.id,
        subscription_tier: tier,
        billing_cycle: billingCycle,
        original_amount: originalPrice,
        discount_amount: discountAmount,
        final_amount: expectedPrice,
        coupon_code: appliedCoupon?.code || null,
        coupon_id: appliedCoupon?.id || null,
        network,
        transaction_hash: settleResult.transaction || null,
        payment_status: "completed",
      });

      console.log(`📄 Invoice created for ${userWalletAddress}:`, invoice.id);

      // If a server-validated coupon was applied, redeem it
      if (appliedCoupon?.id) {
        try {
          await couponService.redeemCoupon(
            appliedCoupon.id,
            userWalletAddress,
            tier,
            billingCycle,
            originalPrice,
            discountAmount,
            expectedPrice
          );
          console.log(`🎟️ Coupon ${appliedCoupon.code} redeemed for ${userWalletAddress}`);
        } catch (redeemError) {
          // Log but don't fail the payment - coupon redemption is secondary
          console.error("Failed to redeem coupon:", redeemError);
        }
      }
    } catch (invoiceError) {
      // Log but don't fail the payment - invoice creation is secondary
      console.error("Failed to create invoice:", invoiceError);
    }

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
        amount: formatUnits(paymentAmount, 6),
        network,
        transactionHash: settleResult.transaction,
        payer: verifyResult.payer,
        couponApplied: appliedCoupon?.code || null,
        discountAmount: discountAmount,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/subscription/pay/x402:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
