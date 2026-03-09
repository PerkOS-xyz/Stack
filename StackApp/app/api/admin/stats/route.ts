import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Returns global admin statistics
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Fetch all statistics in parallel
    const [
      usersResult,
      walletsResult,
      agentsResult,
      vendorsResult,
      endpointsResult,
      transactionsResult,
      networkStatsResult,
    ] = await Promise.all([
      // Total users
      firebaseAdmin
        .from("perkos_user_profiles")
        .select("*", { count: "exact", head: true }),
      // Total sponsor wallets
      firebaseAdmin
        .from("perkos_sponsor_wallets")
        .select("*", { count: "exact", head: true }),
      // Total agents
      firebaseAdmin
        .from("perkos_x402_agents")
        .select("*", { count: "exact", head: true }),
      // Total vendors
      firebaseAdmin
        .from("perkos_vendors")
        .select("*", { count: "exact", head: true }),
      // Total endpoints
      firebaseAdmin
        .from("perkos_vendor_endpoints")
        .select("*", { count: "exact", head: true }),
      // Total transactions
      firebaseAdmin
        .from("perkos_x402_transactions")
        .select("*", { count: "exact", head: true }),
      // Network stats (sum of all)
      firebaseAdmin
        .from("perkos_x402_network_stats")
        .select("*")
        .order("stats_date", { ascending: false })
        .limit(100),
    ]);

    // Calculate totals from network stats
    const networkStats = networkStatsResult.data || [];
    const totalVolumeUsd = networkStats.reduce(
      (sum, stat) => sum + (parseFloat(stat.total_volume_usd) || 0),
      0
    );

    return NextResponse.json({
      stats: {
        users: usersResult.count || 0,
        wallets: walletsResult.count || 0,
        agents: agentsResult.count || 0,
        vendors: vendorsResult.count || 0,
        endpoints: endpointsResult.count || 0,
        transactions: transactionsResult.count || 0,
        totalVolumeUsd: totalVolumeUsd.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
