import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

// Network configuration for all supported networks
const NETWORK_CONFIG = {
  mainnet: [
    { name: "Avalanche", network: "avalanche", icon: "🔺", chainId: CHAIN_IDS.AVALANCHE },
    { name: "Base", network: "base", icon: "🔵", chainId: CHAIN_IDS.BASE },
    { name: "Ethereum", network: "ethereum", icon: "⟠", chainId: CHAIN_IDS.ETHEREUM },
    { name: "Polygon", network: "polygon", icon: "🟣", chainId: CHAIN_IDS.POLYGON },
    { name: "Arbitrum", network: "arbitrum", icon: "🔷", chainId: CHAIN_IDS.ARBITRUM },
    { name: "Optimism", network: "optimism", icon: "🔴", chainId: CHAIN_IDS.OPTIMISM },
    { name: "Celo", network: "celo", icon: "🟡", chainId: CHAIN_IDS.CELO },
    { name: "Monad", network: "monad", icon: "🟢", chainId: CHAIN_IDS.MONAD },
  ],
  testnet: [
    { name: "Avalanche Fuji", network: "avalanche-fuji", icon: "🔺", chainId: CHAIN_IDS.AVALANCHE_FUJI },
    { name: "Base Sepolia", network: "base-sepolia", icon: "🔵", chainId: CHAIN_IDS.BASE_SEPOLIA },
    { name: "Sepolia", network: "sepolia", icon: "⟠", chainId: CHAIN_IDS.SEPOLIA },
    { name: "Polygon Amoy", network: "polygon-amoy", icon: "🟣", chainId: CHAIN_IDS.POLYGON_AMOY },
    { name: "Arbitrum Sepolia", network: "arbitrum-sepolia", icon: "🔷", chainId: CHAIN_IDS.ARBITRUM_SEPOLIA },
    { name: "OP Sepolia", network: "optimism-sepolia", icon: "🔴", chainId: CHAIN_IDS.OPTIMISM_SEPOLIA },
    { name: "Celo Sepolia", network: "celo-sepolia", icon: "🟡", chainId: CHAIN_IDS.CELO_SEPOLIA },
    { name: "Monad Testnet", network: "monad-testnet", icon: "🟢", chainId: CHAIN_IDS.MONAD_TESTNET },
  ],
};

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

    // Fetch total transactions count from x402 transactions table
    const { count: totalTransactions } = await supabase
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");

    // Fetch total volume (sum of all successful transactions)
    const { data: volumeData } = await supabase
      .from("perkos_x402_transactions")
      .select("amount_usd")
      .eq("status", "success");

    // Calculate total volume from USD amounts (already in decimal form)
    const totalVolumeUsd = volumeData?.reduce((sum, tx) => {
      return sum + (tx.amount_usd || 0);
    }, 0) || 0;

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

    // Build network stats from config, pulling data from aggregation
    const networkStats = {
      mainnet: NETWORK_CONFIG.mainnet.map((net) => ({
        name: net.name,
        network: net.network,
        icon: net.icon,
        chainId: net.chainId,
        txCount: networkAgg?.[net.network]?.txCount || 0,
        volume: formatVolume(networkAgg?.[net.network]?.volume || 0n),
      })),
      testnet: NETWORK_CONFIG.testnet.map((net) => ({
        name: net.name,
        network: net.network,
        icon: net.icon,
        chainId: net.chainId,
        txCount: networkAgg?.[net.network]?.txCount || 0,
        volume: formatVolume(networkAgg?.[net.network]?.volume || 0n),
      })),
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

    // Fetch recent transactions (last 15 for landing page display)
    const { data: recentTxs } = await supabase
      .from("perkos_x402_transactions")
      .select("transaction_hash, network, amount_usd, asset_symbol, scheme, created_at")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(15);

    const recentTransactions = recentTxs?.map((tx) => {
      const timeDiff = Date.now() - new Date(tx.created_at).getTime();
      const minutesAgo = Math.floor(timeDiff / (1000 * 60));
      const timeStr =
        minutesAgo < 60
          ? `${minutesAgo}m ago`
          : `${Math.floor(minutesAgo / 60)}h ago`;

      // Format amount from USD value
      const amountUsd = tx.amount_usd || 0;
      const formattedAmount = amountUsd >= 1000
        ? `$${(amountUsd / 1000).toFixed(1)}K`
        : `$${amountUsd.toFixed(2)}`;

      return {
        hash: `${tx.transaction_hash.slice(0, 6)}...${tx.transaction_hash.slice(-4)}`,
        network: tx.network,
        amount: formattedAmount,
        scheme: tx.scheme,
        time: timeStr,
        timestamp: new Date(tx.created_at).getTime(),
      };
    }) || [];

    // Calculate growth (compare with previous period)
    const prevStartDate = new Date(startDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const { count: prevTransactions } = await supabase
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success")
      .gte("created_at", prevStartDate.toISOString())
      .lt("created_at", startDate.toISOString());

    const txGrowth = prevTransactions
      ? ((((totalTransactions || 0) - prevTransactions) / prevTransactions) * 100).toFixed(1)
      : "0";

    // Format total volume from USD
    const formattedTotalVolume = totalVolumeUsd >= 1000000
      ? `$${(totalVolumeUsd / 1000000).toFixed(1)}M`
      : totalVolumeUsd >= 1000
      ? `$${(totalVolumeUsd / 1000).toFixed(1)}K`
      : `$${totalVolumeUsd.toFixed(2)}`;

    const stats = {
      totalTransactions: totalTransactions || 0,
      totalVolume: formattedTotalVolume,
      activeAgents: activeAgents || 0,
      networks: NETWORK_CONFIG.mainnet.length, // Count of mainnet networks
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
      networks: NETWORK_CONFIG.mainnet.length,
      growth: {
        transactions: "+0%",
        volume: "+0%",
        agents: "+0%",
      },
      networkStats: {
        mainnet: NETWORK_CONFIG.mainnet.map((net) => ({
          name: net.name,
          network: net.network,
          icon: net.icon,
          chainId: net.chainId,
          txCount: 0,
          volume: "$0",
        })),
        testnet: NETWORK_CONFIG.testnet.map((net) => ({
          name: net.name,
          network: net.network,
          icon: net.icon,
          chainId: net.chainId,
          txCount: 0,
          volume: "$0",
        })),
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
