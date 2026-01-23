import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
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
    { name: "Unichain", network: "unichain", icon: "🦄", chainId: CHAIN_IDS.UNICHAIN },
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
    { name: "Unichain Sepolia", network: "unichain-sepolia", icon: "🦄", chainId: CHAIN_IDS.UNICHAIN_SEPOLIA },
  ],
};

/**
 * GET /api/dashboard/stats
 * Returns dashboard statistics for the landing page from Firebase Firestore
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
    const { count: totalTransactions } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");

    // Fetch total volume (sum of all successful transactions)
    const { data: volumeData } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("amount_usd")
      .eq("status", "success");

    // Calculate total volume from USD amounts (already in decimal form)
    const totalVolumeUsd = volumeData?.reduce((sum, tx) => {
      return sum + (tx.amount_usd || 0);
    }, 0) || 0;

    // Fetch active agents count
    const { count: activeAgents } = await firebaseAdmin
      .from("perkos_agents")
      .select("*", { count: "exact", head: true })
      .gt("total_transactions", 0);

    // Fetch network statistics directly from x402 transactions
    // Group by network to get counts and volumes
    // Note: Don't filter by date for network stats - show all-time totals that match totalTransactions
    const { data: networkData } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("network, chain_id, amount_wei, amount_usd")
      .eq("status", "success");

    // Aggregate by network from transaction data
    const networkAgg = networkData?.reduce((acc, tx) => {
      const network = tx.network;
      if (!network) return acc;

      if (!acc[network]) {
        acc[network] = {
          txCount: 0,
          volume: 0n,
          volumeUsd: 0,
          chainId: tx.chain_id,
        };
      }
      acc[network].txCount += 1;
      acc[network].volume += BigInt(tx.amount_wei || "0");
      acc[network].volumeUsd += tx.amount_usd || 0;
      return acc;
    }, {} as Record<string, { txCount: number; volume: bigint; volumeUsd: number; chainId: number }>);

    // Format USD volume for display
    const formatVolumeUsd = (usd: number) => {
      return usd >= 1000000
        ? `$${(usd / 1000000).toFixed(1)}M`
        : usd >= 1000
        ? `$${(usd / 1000).toFixed(1)}K`
        : `$${usd.toFixed(2)}`;
    };

    // Build network stats from config, pulling data from aggregation
    const networkStats = {
      mainnet: NETWORK_CONFIG.mainnet.map((net) => ({
        name: net.name,
        network: net.network,
        icon: net.icon,
        chainId: net.chainId,
        txCount: networkAgg?.[net.network]?.txCount || 0,
        volume: formatVolumeUsd(networkAgg?.[net.network]?.volumeUsd || 0),
      })),
      testnet: NETWORK_CONFIG.testnet.map((net) => ({
        name: net.name,
        network: net.network,
        icon: net.icon,
        chainId: net.chainId,
        txCount: networkAgg?.[net.network]?.txCount || 0,
        volume: formatVolumeUsd(networkAgg?.[net.network]?.volumeUsd || 0),
      })),
    };

    // Fetch chart data from x402 transactions
    // For transactions without created_at, we filter them out client-side in the reduce
    const { data: chartDataRaw } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("created_at, amount_usd")
      .eq("status", "success")
      .order("created_at", { ascending: true });

    // Aggregate by date for transactions that have timestamps
    const dailyAgg = chartDataRaw?.reduce((acc, tx) => {
      if (!tx.created_at) return acc;
      const date = tx.created_at.split("T")[0]; // Extract date part
      if (!acc[date]) {
        acc[date] = { transactions: 0, volumeUsd: 0 };
      }
      acc[date].transactions += 1;
      acc[date].volumeUsd += tx.amount_usd || 0;
      return acc;
    }, {} as Record<string, { transactions: number; volumeUsd: number }>);

    // Generate chart data - if no real data, create placeholder entries
    let chartData = Object.entries(dailyAgg || {}).map(([date, data], i) => ({
      day: i + 1,
      value: data.transactions,
      date,
    }));

    // If no chart data but we have transactions, show a single bar
    if (chartData.length === 0 && (totalTransactions || 0) > 0) {
      chartData = [{
        day: 1,
        value: totalTransactions || 0,
        date: new Date().toISOString().split("T")[0],
      }];
    }

    // Fetch recent transactions (last 10 for landing page display)
    // Match the approach from /api/x402/transactions - order by created_at, no status filter in query
    const { data: recentTxsRaw } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("transaction_hash, network, amount_usd, asset_symbol, scheme, created_at, payer_address, recipient_address, vendor_domain, vendor_endpoint, status")
      .order("created_at", { ascending: false })
      .limit(20);

    // Filter for successful transactions and take only 10
    const sortedTxs = (recentTxsRaw || [])
      .filter((tx) => tx.status === "success")
      .slice(0, 10);

    const recentTransactions = sortedTxs.map((tx) => {
      let timeStr = "Recently";
      let datetimeStr = "Unknown";
      if (tx.created_at) {
        const txDate = new Date(tx.created_at);
        const timeDiff = Date.now() - txDate.getTime();
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        timeStr =
          minutesAgo < 60
            ? `${minutesAgo}m ago`
            : minutesAgo < 1440
            ? `${Math.floor(minutesAgo / 60)}h ago`
            : `${Math.floor(minutesAgo / 1440)}d ago`;
        datetimeStr = txDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      // Format amount from USD value
      const amountUsd = tx.amount_usd || 0;
      const tokenSymbol = tx.asset_symbol || "USDC";
      const formattedAmount = `${amountUsd.toFixed(3)} ${tokenSymbol}`;

      // Truncate addresses
      const truncateAddr = (addr: string) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

      return {
        hash: `${tx.transaction_hash.slice(0, 6)}...${tx.transaction_hash.slice(-4)}`,
        fullHash: tx.transaction_hash,
        network: tx.network,
        amount: formattedAmount,
        scheme: tx.scheme,
        time: timeStr,
        timestamp: tx.created_at ? new Date(tx.created_at).getTime() : Date.now(),
        // New fields
        from: truncateAddr(tx.payer_address),
        fullFrom: tx.payer_address || "",
        to: truncateAddr(tx.recipient_address),
        fullTo: tx.recipient_address || "",
        vendorDomain: tx.vendor_domain || null,
        vendorEndpoint: tx.vendor_endpoint || null,
        status: tx.status || "success",
        datetime: datetimeStr,
      };
    });

    // Calculate growth (compare with previous period)
    const prevStartDate = new Date(startDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const { count: prevTransactions } = await firebaseAdmin
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

    // Debug logging
    console.log("[Dashboard Stats]", {
      totalTransactions,
      totalVolumeUsd,
      networkDataCount: networkData?.length || 0,
      networkAggKeys: Object.keys(networkAgg || {}),
      chartDataCount: chartData.length,
      recentTxsCount: recentTransactions.length,
    });

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
