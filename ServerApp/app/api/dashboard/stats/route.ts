import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the landing page from Supabase
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("timeRange") || "7d";

    // Calculate date range
    const now = new Date();
    const daysAgo = timeRange === "24h" ? 1 : timeRange === "7d" ? 7 : 30;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Fetch total transactions count
    const { count: totalTransactions } = await supabase
      .from("perkos_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "settled");

    // Fetch total volume (sum of all settled transactions)
    const { data: volumeData } = await supabase
      .from("perkos_transactions")
      .select("amount")
      .eq("status", "settled");

    const totalVolume = volumeData?.reduce((sum, tx) => {
      return sum + BigInt(tx.amount || "0");
    }, 0n) || 0n;

    // Fetch active agents count
    const { count: activeAgents } = await supabase
      .from("perkos_agents")
      .select("*", { count: "exact", head: true })
      .gt("total_transactions", 0);

    // Fetch network statistics
    const { data: networkData } = await supabase
      .from("perkos_network_stats")
      .select("network, chain_id, total_transactions, total_volume")
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });

    // Aggregate by network
    const networkAgg = networkData?.reduce((acc, stat) => {
      if (!acc[stat.network]) {
        acc[stat.network] = {
          txCount: 0,
          volume: 0n,
          chainId: stat.chain_id,
        };
      }
      acc[stat.network].txCount += stat.total_transactions;
      acc[stat.network].volume += BigInt(stat.total_volume || "0");
      return acc;
    }, {} as Record<string, { txCount: number; volume: bigint; chainId: number }>);

    // Format network stats
    const formatVolume = (vol: bigint) => {
      const num = Number(vol) / 1e6; // Assuming USDC (6 decimals)
      return num >= 1000000
        ? `$${(num / 1000000).toFixed(1)}M`
        : num >= 1000
        ? `$${(num / 1000).toFixed(0)}K`
        : `$${num.toFixed(0)}`;
    };

    const networkStats = {
      mainnet: [
        {
          name: "Avalanche",
          network: "avalanche",
          txCount: networkAgg?.["avalanche"]?.txCount || 0,
          volume: formatVolume(networkAgg?.["avalanche"]?.volume || 0n),
          icon: "🔺",
        },
        {
          name: "Base",
          network: "base",
          txCount: networkAgg?.["base"]?.txCount || 0,
          volume: formatVolume(networkAgg?.["base"]?.volume || 0n),
          icon: "🔵",
        },
      ],
      testnet: [
        {
          name: "Avalanche Fuji",
          network: "avalanche-fuji",
          txCount: networkAgg?.["avalanche-fuji"]?.txCount || 0,
          volume: formatVolume(networkAgg?.["avalanche-fuji"]?.volume || 0n),
          icon: "🔺",
        },
        {
          name: "Base Sepolia",
          network: "base-sepolia",
          txCount: networkAgg?.["base-sepolia"]?.txCount || 0,
          volume: formatVolume(networkAgg?.["base-sepolia"]?.volume || 0n),
          icon: "🔵",
        },
      ],
    };

    // Fetch chart data (daily transactions for the time range)
    const { data: chartDataRaw } = await supabase
      .from("perkos_network_stats")
      .select("date, total_transactions, total_volume")
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: true });

    // Aggregate by date
    const dailyAgg = chartDataRaw?.reduce((acc, stat) => {
      if (!acc[stat.date]) {
        acc[stat.date] = { transactions: 0, volume: 0n };
      }
      acc[stat.date].transactions += stat.total_transactions;
      acc[stat.date].volume += BigInt(stat.total_volume || "0");
      return acc;
    }, {} as Record<string, { transactions: number; volume: bigint }>);

    const chartData = Object.entries(dailyAgg || {}).map(([date, data], i) => ({
      day: i + 1,
      value: data.transactions,
      date,
    }));

    // Fetch recent transactions
    const { data: recentTxs } = await supabase
      .from("perkos_transactions")
      .select("hash, network, amount, scheme, created_at")
      .eq("status", "settled")
      .order("created_at", { ascending: false })
      .limit(5);

    const recentTransactions = recentTxs?.map((tx) => {
      const timeDiff = Date.now() - new Date(tx.created_at).getTime();
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      const timeStr =
        minutesAgo < 60
          ? `${minutesAgo}m ago`
          : `${Math.floor(minutesAgo / 60)}h ago`;

      return {
        hash: `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`,
        network: tx.network,
        amount: formatVolume(BigInt(tx.amount || "0")),
        scheme: tx.scheme,
        time: timeStr,
        timestamp: new Date(tx.created_at).getTime(),
      };
    }) || [];

    // Calculate growth (compare with previous period)
    const prevStartDate = new Date(startDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const { count: prevTransactions } = await supabase
      .from("perkos_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "settled")
      .gte("created_at", prevStartDate.toISOString())
      .lt("created_at", startDate.toISOString());

    const txGrowth = prevTransactions
      ? ((((totalTransactions || 0) - prevTransactions) / prevTransactions) * 100).toFixed(1)
      : "0";

    const stats = {
      totalTransactions: totalTransactions || 0,
      totalVolume: formatVolume(totalVolume),
      activeAgents: activeAgents || 0,
      networks: 4, // Avalanche, Base (mainnet + testnet)
      growth: {
        transactions: `${txGrowth >= "0" ? "+" : ""}${txGrowth}%`,
        volume: "+0%", // TODO: Calculate volume growth
        agents: "+0%", // TODO: Calculate agent growth
      },
      networkStats,
      chartData,
      recentTransactions,
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, max-age=60", // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    // Return mock data on error to prevent UI breaking
    const mockStats = {
      totalTransactions: 0,
      totalVolume: "$0",
      activeAgents: 0,
      networks: 4,
      growth: {
        transactions: "+0%",
        volume: "+0%",
        agents: "+0%",
      },
      networkStats: {
        mainnet: [
          { name: "Avalanche", network: "avalanche", txCount: 0, volume: "$0", icon: "🔺" },
          { name: "Base", network: "base", txCount: 0, volume: "$0", icon: "🔵" },
        ],
        testnet: [
          { name: "Avalanche Fuji", network: "avalanche-fuji", txCount: 0, volume: "$0", icon: "🔺" },
          { name: "Base Sepolia", network: "base-sepolia", txCount: 0, volume: "$0", icon: "🔵" },
        ],
      },
      chartData: [],
      recentTransactions: [],
    };

    return NextResponse.json(mockStats, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }
}
