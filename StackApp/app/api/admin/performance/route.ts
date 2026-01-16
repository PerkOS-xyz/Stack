import { NextRequest, NextResponse } from "next/server";
import {
  getPerformanceLogs,
  getSlowQueryLogs,
  getPerformanceStats,
  clearPerformanceLogs,
  getSlowQueryThreshold,
} from "@/lib/utils/performanceLogger";

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
 * GET /api/admin/performance?address=0x...&type=all|slow|stats
 * Returns performance statistics and logs (admin only)
 *
 * Query Parameters:
 * - address: Admin wallet address (required)
 * - type: Type of data to return (optional, default: "all")
 *   - "all": Returns all performance logs
 *   - "slow": Returns only slow query logs
 *   - "stats": Returns aggregated performance statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const type = searchParams.get("type") || "all";

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

    const slowQueryThreshold = getSlowQueryThreshold();

    switch (type) {
      case "slow": {
        const slowLogs = getSlowQueryLogs();
        return NextResponse.json({
          logs: slowLogs,
          count: slowLogs.length,
          slowQueryThreshold,
          type: "slow",
        });
      }

      case "stats": {
        const stats = getPerformanceStats();
        return NextResponse.json({
          stats,
          slowQueryThreshold,
          type: "stats",
        });
      }

      case "all":
      default: {
        const allLogs = getPerformanceLogs();
        const stats = getPerformanceStats();
        return NextResponse.json({
          logs: allLogs,
          count: allLogs.length,
          stats,
          slowQueryThreshold,
          type: "all",
        });
      }
    }
  } catch (error) {
    console.error("Error in GET /api/admin/performance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/performance
 * Clears all performance logs (admin only)
 * Body: { address: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;

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

    // Get count before clearing for the response
    const previousCount = getPerformanceLogs().length;

    clearPerformanceLogs();

    console.log(`[Admin] Performance logs cleared by ${address}. Previous count: ${previousCount}`);

    return NextResponse.json({
      success: true,
      message: "Performance logs cleared successfully",
      previousCount,
    });
  } catch (error) {
    console.error("Error in DELETE /api/admin/performance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
