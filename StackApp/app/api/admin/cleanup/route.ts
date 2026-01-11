import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

// Helper to verify admin access
function isAdminWallet(address: string): boolean {
  const adminWallets = process.env.ADMIN_WALLETS || "";
  const adminList = adminWallets
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return adminList.includes(address.toLowerCase());
}

/**
 * POST /api/admin/cleanup?address=0x...
 * Clean up orphaned data (endpoints without vendors)
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    if (!isAdminWallet(address)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    console.log(`[AdminCleanup] Starting cleanup requested by ${address}`);

    // Clean up orphaned endpoints
    const result = await vendorDiscoveryService.cleanupOrphanedEndpoints();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Cleanup failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} orphaned endpoints`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error in POST /api/admin/cleanup:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
