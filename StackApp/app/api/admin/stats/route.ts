import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

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
 * GET /api/admin/stats?address=0x...
 * Returns global admin statistics
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

    if (!isAdminWallet(address)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
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
      supabase
        .from("perkos_user_profiles")
        .select("*", { count: "exact", head: true }),
      // Total sponsor wallets
      supabase
        .from("perkos_sponsor_wallets")
        .select("*", { count: "exact", head: true }),
      // Total agents
      supabase
        .from("perkos_x402_agents")
        .select("*", { count: "exact", head: true }),
      // Total vendors
      supabase
        .from("perkos_vendors")
        .select("*", { count: "exact", head: true }),
      // Total endpoints
      supabase
        .from("perkos_vendor_endpoints")
        .select("*", { count: "exact", head: true }),
      // Total transactions
      supabase
        .from("perkos_x402_transactions")
        .select("*", { count: "exact", head: true }),
      // Network stats (sum of all)
      supabase
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
