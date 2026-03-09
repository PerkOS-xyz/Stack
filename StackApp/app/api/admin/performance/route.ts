import { NextRequest, NextResponse } from "next/server";
import {
  getPerformanceLogs,
  getSlowQueryLogs,
  getPerformanceStats,
  clearPerformanceLogs,
  getSlowQueryThreshold,
} from "@/lib/utils/performanceLogger";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/performance
 * Returns performance statistics and logs (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";

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
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const previousCount = getPerformanceLogs().length;

    clearPerformanceLogs();

    console.log(`[Admin] Performance logs cleared by ${auth.address}. Previous count: ${previousCount}`);

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
