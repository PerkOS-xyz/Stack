/**
 * API Route: GET /api/x402/networks
 * Fetch x402 network statistics for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = "force-dynamic";

// Network metadata
const NETWORK_METADATA: Record<
  string,
  { name: string; chainId: number; symbol: string; color: string }
> = {
  avalanche: {
    name: "Avalanche",
    chainId: 43114,
    symbol: "AVAX",
    color: "#E84142",
  },
  "avalanche-fuji": {
    name: "Avalanche Fuji",
    chainId: 43113,
    symbol: "AVAX",
    color: "#E84142",
  },
  base: { name: "Base", chainId: 8453, symbol: "ETH", color: "#0052FF" },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: 84532,
    symbol: "ETH",
    color: "#0052FF",
  },
  celo: { name: "Celo", chainId: 42220, symbol: "CELO", color: "#35D07F" },
  "celo-sepolia": {
    name: "Celo Sepolia",
    chainId: 11142220,
    symbol: "CELO",
    color: "#35D07F",
  },
};

interface NetworkAggregation {
  network: string;
  chain_id: number;
  total_transactions: number;
  total_volume_usd: number;
  unique_payers: number;
  unique_recipients: number;
  last_transaction_at: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const includeTestnets = searchParams.get("includeTestnets") === "true";

    // Calculate time filter
    let timeFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case "24h":
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = null;
    }

    // Aggregate network stats directly from transactions table
    // This is more accurate than using the daily stats table
    const { data: transactions, error } = await supabase
      .from("perkos_x402_transactions")
      .select("network, chain_id, payer_address, recipient_address, amount_usd, created_at");

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch network stats", details: error.message },
        { status: 500 }
      );
    }

    // Aggregate stats per network
    const networkStatsMap = new Map<string, NetworkAggregation>();

    for (const tx of transactions || []) {
      const networkKey = tx.network;

      // Skip testnets if not requested
      if (!includeTestnets && (networkKey?.includes("fuji") || networkKey?.includes("sepolia"))) {
        continue;
      }

      if (!networkStatsMap.has(networkKey)) {
        networkStatsMap.set(networkKey, {
          network: networkKey,
          chain_id: tx.chain_id,
          total_transactions: 0,
          total_volume_usd: 0,
          unique_payers: 0,
          unique_recipients: 0,
          last_transaction_at: null,
        });
      }

      const stats = networkStatsMap.get(networkKey)!;
      stats.total_transactions += 1;
      stats.total_volume_usd += tx.amount_usd || 0;

      // Track last transaction
      if (!stats.last_transaction_at || new Date(tx.created_at) > new Date(stats.last_transaction_at)) {
        stats.last_transaction_at = tx.created_at;
      }
    }

    // Calculate unique payers and recipients per network
    for (const [networkKey, stats] of networkStatsMap) {
      const networkTxs = (transactions || []).filter(tx => tx.network === networkKey);
      const uniquePayers = new Set(networkTxs.map(tx => tx.payer_address));
      const uniqueRecipients = new Set(networkTxs.map(tx => tx.recipient_address));
      stats.unique_payers = uniquePayers.size;
      stats.unique_recipients = uniqueRecipients.size;
    }

    const networkStats = Array.from(networkStatsMap.values());

    // Get period-specific stats if filtering by time
    let periodStats: Record<string, { transactions: number; volume: number }> = {};

    if (timeFilter) {
      const filteredTxs = (transactions || []).filter(
        tx => new Date(tx.created_at) >= timeFilter!
      );

      periodStats = filteredTxs.reduce(
        (acc, tx) => {
          if (!acc[tx.network]) {
            acc[tx.network] = { transactions: 0, volume: 0 };
          }
          acc[tx.network].transactions += 1;
          acc[tx.network].volume += tx.amount_usd || 0;
          return acc;
        },
        {} as Record<string, { transactions: number; volume: number }>
      );
    }

    // Calculate overall totals
    const totalTransactions = networkStats.reduce((sum, n) => sum + n.total_transactions, 0);
    const totalVolumeUsd = networkStats.reduce((sum, n) => sum + n.total_volume_usd, 0);

    // Format networks for frontend
    const formattedNetworks = networkStats.map((network) => {
      const metadata = NETWORK_METADATA[network.network] || {
        name: network.network,
        chainId: network.chain_id,
        symbol: "ETH",
        color: "#627EEA",
      };

      const periodData = periodStats[network.network];
      const isTestnet =
        network.network?.includes("fuji") ||
        network.network?.includes("sepolia");

      return {
        id: network.network,
        name: metadata.name,
        chainId: network.chain_id,
        symbol: metadata.symbol,
        color: metadata.color,
        isTestnet,
        stats: {
          totalTransactions: network.total_transactions || 0,
          totalVolume: formatCurrency(network.total_volume_usd || 0),
          totalVolumeRaw: network.total_volume_usd || 0,
          uniquePayers: network.unique_payers || 0,
          uniqueRecipients: network.unique_recipients || 0,
          lastActivity: network.last_transaction_at,
        },
        periodStats: periodData
          ? {
              transactions: periodData.transactions,
              volume: formatCurrency(periodData.volume),
              volumeRaw: periodData.volume,
            }
          : null,
        // Calculate percentage of total
        volumeShare:
          totalVolumeUsd > 0
            ? ((network.total_volume_usd || 0) / totalVolumeUsd) * 100
            : 0,
        transactionShare:
          totalTransactions > 0
            ? ((network.total_transactions || 0) / totalTransactions) * 100
            : 0,
      };
    });

    // Sort by volume (descending)
    formattedNetworks.sort(
      (a, b) => b.stats.totalVolumeRaw - a.stats.totalVolumeRaw
    );

    // Get active networks count
    const activeNetworks = networkStats.filter((n) => {
      if (!n.last_transaction_at) return false;
      const lastActive = new Date(n.last_transaction_at);
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return lastActive >= cutoff;
    }).length;

    return NextResponse.json({
      networks: formattedNetworks || [],
      summary: {
        totalNetworks: networkStats.length || 0,
        activeNetworks,
        totalTransactions,
        totalVolume: formatCurrency(totalVolumeUsd),
        totalVolumeRaw: totalVolumeUsd,
      },
      period,
    });
  } catch (error) {
    console.error("Error in networks API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}
