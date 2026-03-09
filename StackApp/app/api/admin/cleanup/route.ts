import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cleanup
 * Clean up orphaned data (endpoints without vendors)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    const address = auth.address;

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
