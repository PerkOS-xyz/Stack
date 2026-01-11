import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionService } from "@/lib/services/SubscriptionService";
import { DEFAULT_TIER } from "@/lib/config/subscriptions";

/**
 * POST /api/subscription/init
 *
 * Initialize a subscription for a new user.
 * Creates a free tier subscription if none exists.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const subscriptionService = getSubscriptionService();

    // Check if user already has a subscription
    const existingSubscription = await subscriptionService.getUserSubscription(address);

    if (existingSubscription) {
      // Return existing subscription info
      return NextResponse.json({
        success: true,
        message: "User already has an active subscription",
        subscription: {
          tier: existingSubscription.tier,
          status: existingSubscription.status,
          created: false,
        },
      });
    }

    // Create a free tier subscription for the new user
    const newSubscription = await subscriptionService.createOrUpdateSubscription(
      address,
      DEFAULT_TIER
    );

    // Also initialize the usage record for this billing period
    await subscriptionService.getOrCreateUsageRecord(address);

    return NextResponse.json({
      success: true,
      message: "Free subscription initialized",
      subscription: {
        tier: newSubscription.tier,
        status: newSubscription.status,
        created: true,
      },
    });
  } catch (error) {
    console.error("Error initializing subscription:", error);
    return NextResponse.json(
      { error: "Failed to initialize subscription" },
      { status: 500 }
    );
  }
}
