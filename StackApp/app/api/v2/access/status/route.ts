import { NextRequest, NextResponse } from "next/server";
import { getAccessPlanService } from "@/lib/services/AccessPlanService";
import type { Address } from "@/lib/types/x402";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/access/status?walletAddress=0x...
 *
 * Get wallet status including subscription, usage, and transaction limits.
 * This is a public endpoint - wallets are identified by address.
 */
export async function GET(request: NextRequest) {
  try {
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

    const service = getAccessPlanService();
    const status = await service.getWalletStatus(walletAddress as Address);

    return NextResponse.json({
      success: true,
      walletAddress,
      ...status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get wallet status",
      },
      { status: 500 }
    );
  }
}
