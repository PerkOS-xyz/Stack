import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionService } from "@/lib/services/SubscriptionService";
import { SUBSCRIPTION_TIERS, getAllTiers, SubscriptionTier } from "@/lib/config/subscriptions";
import { enforceRateLimit } from "@/lib/middleware/rateLimiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription?address=0x...
 * Returns the user's subscription status and usage
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

    // Check rate limit
    const rateLimitResult = await enforceRateLimit(address, req);
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    const subscriptionService = getSubscriptionService();
    const status = await subscriptionService.getSubscriptionStatus(address);

    console.log(`[API] GET /api/subscription for ${address}:`, {
      tier: status.tier,
      hasSubscription: !!status.subscription,
      subscriptionStatus: status.subscription?.status,
    });

    return NextResponse.json({
      success: true,
      data: {
        tier: status.tier,
        tierConfig: {
          name: status.tierConfig.name,
          displayName: status.tierConfig.displayName,
          description: status.tierConfig.description,
          features: status.tierConfig.features,
          priceMonthly: status.tierConfig.priceMonthly,
          priceYearly: status.tierConfig.priceYearly,
        },
        subscription: status.subscription
          ? {
              status: status.subscription.status,
              startedAt: status.subscription.started_at,
              expiresAt: status.subscription.expires_at,
              trialEndsAt: status.subscription.trial_ends_at,
            }
          : null,
        usage: {
          periodStart: status.usage.period_start,
          periodEnd: status.usage.period_end,
          transactions: {
            used: status.limits.transactions.used,
            limit: status.limits.transactions.limit,
            remaining: status.limits.transactions.remaining,
            percentUsed: status.limits.transactions.percentUsed,
          },
          wallets: {
            used: status.limits.wallets.used,
            limit: status.limits.wallets.limit,
            remaining: status.limits.wallets.remaining,
            percentUsed: status.limits.wallets.percentUsed,
          },
        },
        limits: status.tierConfig.limits,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscription
 * Create or update a subscription (admin use / webhook handler)
 *
 * Body: {
 *   userWalletAddress: string,
 *   tier: SubscriptionTier,
 *   stripeCustomerId?: string,
 *   stripeSubscriptionId?: string,
 *   expiresAt?: string (ISO date),
 *   trialEndsAt?: string (ISO date),
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userWalletAddress,
      tier,
      stripeCustomerId,
      stripeSubscriptionId,
      expiresAt,
      trialEndsAt,
    } = body;

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

    // TODO: Add authentication/authorization check here
    // This endpoint should only be callable by admin or Stripe webhook

    const subscriptionService = getSubscriptionService();
    const subscription = await subscriptionService.createOrUpdateSubscription(
      userWalletAddress,
      tier as SubscriptionTier,
      {
        stripeCustomerId,
        stripeSubscriptionId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : undefined,
      }
    );

    console.log(`✅ Subscription created/updated for ${userWalletAddress}:`);
    console.log(`   Tier: ${tier}`);
    console.log(`   Status: ${subscription.status}`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        startedAt: subscription.started_at,
        expiresAt: subscription.expires_at,
        trialEndsAt: subscription.trial_ends_at,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscription
 * Cancel a subscription
 *
 * Body: { userWalletAddress: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { userWalletAddress } = body;

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "userWalletAddress required" },
        { status: 400 }
      );
    }

    // TODO: Add authentication check - user can only cancel their own subscription

    const subscriptionService = getSubscriptionService();
    await subscriptionService.cancelSubscription(userWalletAddress);

    console.log(`✅ Subscription cancelled for ${userWalletAddress}`);

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
