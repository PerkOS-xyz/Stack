import { NextRequest, NextResponse } from "next/server";
import { getAccessPlanService } from "@/lib/services/AccessPlanService";
import type { RegisterWalletRequest } from "@/lib/types/access-plans";
import type { Address } from "@/lib/types/x402";
import { ACCESS_PLANS, type PlanId } from "@/lib/config/access-plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/v2/access/register
 *
 * Register a wallet with a plan.
 * No signature required - wallet ownership is verified via frontend connection.
 *
 * Flow:
 * 1. User connects wallet via frontend
 * 2. Frontend calls this endpoint with walletAddress + planId
 * 3. System creates subscription for the wallet
 * 4. User can now use x402 services (verify/settle)
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();

  console.log("\n" + "🔷".repeat(35));
  console.log(`🔵 [STACK] [${timestamp}] WALLET REGISTRATION REQUEST`);
  console.log("🔷".repeat(35));

  try {
    const body = (await request.json()) as RegisterWalletRequest;

    // Validate wallet address
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

    // Validate plan if provided
    const planId = (body.planId || "free") as PlanId;
    if (!ACCESS_PLANS[planId]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid plan: ${planId}. Valid plans: ${Object.keys(ACCESS_PLANS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    console.log("📥 Registration Details:");
    console.log("   Wallet:", body.walletAddress);
    console.log("   Plan:", planId);
    console.log("   Referral:", body.referralCode || "none");

    const service = getAccessPlanService();

    // Check if already registered
    const isRegistered = await service.isRegistered(body.walletAddress as Address);
    if (isRegistered) {
      console.log("ℹ️ Wallet already registered");
      console.log("🔷".repeat(35) + "\n");

      // Return existing subscription
      const subscription = await service.getSubscription(body.walletAddress as Address);
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        subscription,
        message: "Wallet is already registered",
      });
    }

    // Register the wallet
    const result = await service.registerWallet(
      body.walletAddress as Address,
      planId
    );

    if (result.success) {
      console.log("✅ Registration successful");
      console.log("   Subscription ID:", result.subscription?.id);
      console.log("   Plan:", result.subscription?.planId);
      console.log("   Monthly Limit:", result.subscription?.monthlyApiLimit);
    } else {
      console.log("❌ Registration failed:", result.error);
    }

    console.log("🔷".repeat(35) + "\n");

    return NextResponse.json(result, {
      status: result.success ? 201 : 400,
    });
  } catch (error) {
    console.log(
      "❌ Registration Error:",
      error instanceof Error ? error.message : String(error)
    );
    console.log("🔷".repeat(35) + "\n");

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v2/access/register?walletAddress=0x...
 *
 * Check if a wallet is registered
 */
export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing walletAddress query parameter",
      },
      { status: 400 }
    );
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid wallet address format",
      },
      { status: 400 }
    );
  }

  try {
    const service = getAccessPlanService();
    const isRegistered = await service.isRegistered(walletAddress as Address);

    if (!isRegistered) {
      return NextResponse.json({
        success: true,
        isRegistered: false,
        message: "Wallet is not registered. Please register to use x402 services.",
        registrationEndpoint: "/api/v2/access/register",
        availablePlans: Object.entries(ACCESS_PLANS)
          .filter(([, plan]) => plan.isActive)
          .map(([id, plan]) => ({
            id,
            name: plan.name,
            price: plan.priceUsd,
            monthlyTransactions: plan.monthlyApiCalls,
          })),
      });
    }

    // Get subscription details
    const subscription = await service.getSubscription(walletAddress as Address);
    const usage = await service.getUsageSummary(walletAddress as Address);

    return NextResponse.json({
      success: true,
      isRegistered: true,
      subscription,
      usage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check registration status",
      },
      { status: 500 }
    );
  }
}
