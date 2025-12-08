import { NextRequest, NextResponse } from "next/server";
import { getThirdwebValidator } from "@/lib/services/ThirdwebWalletValidator";

export const dynamic = "force-dynamic";

/**
 * GET /api/sponsor/wallets/validate?address=0x...
 * Validates if a wallet address exists in Thirdweb project
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

    const validator = getThirdwebValidator();

    // Check if wallet exists
    const exists = await validator.walletExists(address);

    // Get wallet details if it exists
    const wallet = exists ? await validator.getWalletByAddress(address) : null;

    return NextResponse.json({
      exists,
      address,
      wallet,
      message: exists
        ? "Wallet found in Thirdweb project"
        : "Wallet not found in Thirdweb project",
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/wallets/validate:", error);
    return NextResponse.json(
      {
        error: "Failed to validate wallet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sponsor/wallets/validate/list
 * Lists all server wallets in Thirdweb project
 */
export async function POST() {
  try {
    const validator = getThirdwebValidator();
    const wallets = await validator.listWallets();
    const count = await validator.getWalletCount();

    return NextResponse.json({
      wallets,
      count,
      message: `Found ${count} wallet(s) in Thirdweb project`,
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/wallets/validate/list:", error);
    return NextResponse.json(
      {
        error: "Failed to list wallets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
