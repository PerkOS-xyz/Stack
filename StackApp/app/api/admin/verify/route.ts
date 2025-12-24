import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/verify?address=0x...
 * Verifies if a wallet address is an admin
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

    const adminWallets = process.env.ADMIN_WALLETS || "";
    const adminList = adminWallets
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0);

    const isAdmin = adminList.includes(address.toLowerCase());

    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error("Error in GET /api/admin/verify:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
