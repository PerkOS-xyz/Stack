import { NextRequest, NextResponse } from "next/server";
import { getAccessPlanService } from "@/lib/services/AccessPlanService";
import { ACCESS_PLANS, getUpgradePlan, type PlanId } from "@/lib/config/access-plans";
import type { UpgradePlanRequest } from "@/lib/types/access-plans";
import type { Address } from "@/lib/types/x402";

export const dynamic = "force-dynamic";

/**
 * POST /api/v2/access/upgrade
 *
 * Upgrade user's plan
 *
 * Request body requires walletAddress + planId.
 * No API key needed - wallet ownership is verified via frontend wallet connection.
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  console.log("\n" + "🔷".repeat(35));
  console.log(`🔵 [STACK] [${timestamp}] PLAN UPGRADE REQUEST`);
  console.log("🔷".repeat(35));

  try {
    const service = getAccessPlanService();
    const body = (await request.json()) as UpgradePlanRequest & { walletAddress?: Address };

    // Require wallet address in body
    if (!body.walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: walletAddress",
        },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid wallet address format",
        },
        { status: 400 }
      );
    }

    const walletAddress = body.walletAddress;

    // Check if wallet is registered
    const isRegistered = await service.isRegistered(walletAddress);
    if (!isRegistered) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet not registered. Please register first at /api/v2/access/register",
        },
        { status: 401 }
      );
    }

    // Get current subscription
    const subscription = await service.getSubscription(walletAddress);
    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: "No active subscription found",
        },
        { status: 400 }
      );
    }

    // Validate plan exists
    if (!ACCESS_PLANS[body.planId]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid plan: ${body.planId}. Valid plans: ${Object.keys(ACCESS_PLANS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    console.log("📥 Upgrade Details:");
    console.log("   Wallet:", walletAddress);
    console.log("   Current Plan:", subscription.planId);
    console.log("   New Plan:", body.planId);

    const result = await service.upgradePlan(walletAddress, body);

    if (result.success) {
      console.log("✅ Upgrade successful");
      console.log("   Transaction:", result.transactionHash || "N/A");
    } else {
      console.log("❌ Upgrade failed:", result.error);
    }

    console.log("🔷".repeat(35) + "\n");

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.log(
      "❌ Upgrade Error:",
      error instanceof Error ? error.message : String(error)
    );
    console.log("🔷".repeat(35) + "\n");

    return NextResponse.json(
      {
        success: false,
        error: "Upgrade failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/access/upgrade?walletAddress=0x...
 *
 * Get upgrade options for current plan
 */
export async function GET(request: NextRequest) {
  try {
    const service = getAccessPlanService();
    const walletAddress = request.nextUrl.searchParams.get("walletAddress");

    let currentPlanId: PlanId = "free";

    // If wallet address provided, get their current plan
    if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      const subscription = await service.getSubscription(walletAddress as Address);
      if (subscription) {
        currentPlanId = subscription.planId as PlanId;
      }
    } else {
      // Check for plan query param
      const planParam = request.nextUrl.searchParams.get("currentPlan");
      if (planParam && ACCESS_PLANS[planParam as PlanId]) {
        currentPlanId = planParam as PlanId;
      }
    }

    const currentPlan = ACCESS_PLANS[currentPlanId];
    const nextPlanId = getUpgradePlan(currentPlanId);
    const nextPlan = nextPlanId ? ACCESS_PLANS[nextPlanId] : null;

    // Get all higher tier plans
    const upgradeOptions = Object.values(ACCESS_PLANS)
      .filter((plan) => plan.displayOrder > currentPlan.displayOrder && plan.isActive)
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.priceUsd === "custom" ? "Contact Us" : `$${plan.priceUsd}/mo`,
        priceAtomicUnits: plan.priceAtomicUnits,
        monthlyTransactions: plan.monthlyApiCalls === -1 ? "Unlimited" : plan.monthlyApiCalls.toLocaleString(),
        features: plan.features,
      }));

    return NextResponse.json({
      success: true,
      currentPlan: {
        id: currentPlan.id,
        name: currentPlan.name,
      },
      recommendedUpgrade: nextPlan
        ? {
            id: nextPlan.id,
            name: nextPlan.name,
            price: nextPlan.priceUsd === "custom" ? "Contact Us" : `$${nextPlan.priceUsd}/mo`,
          }
        : null,
      upgradeOptions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get upgrade options",
      },
      { status: 500 }
    );
  }
}
