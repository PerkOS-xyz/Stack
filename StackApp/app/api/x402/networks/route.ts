/**
 * API Route: GET /api/x402/networks
 * Fetch x402 network statistics for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

// Network metadata for all 16 supported networks (8 mainnet + 8 testnet)
const NETWORK_METADATA: Record<
  string,
  { name: string; chainId: number; symbol: string; color: string; icon: string }
> = {
  // Mainnet networks
  avalanche: {
    name: "Avalanche",
    chainId: CHAIN_IDS.AVALANCHE,
    symbol: "AVAX",
    color: "#E84142",
    icon: "🔺",
  },
  base: {
    name: "Base",
    chainId: CHAIN_IDS.BASE,
    symbol: "ETH",
    color: "#0052FF",
    icon: "🔵",
  },
  ethereum: {
    name: "Ethereum",
    chainId: CHAIN_IDS.ETHEREUM,
    symbol: "ETH",
    color: "#627EEA",
    icon: "⟠",
  },
  polygon: {
    name: "Polygon",
    chainId: CHAIN_IDS.POLYGON,
    symbol: "MATIC",
    color: "#8247E5",
    icon: "🟣",
  },
  arbitrum: {
    name: "Arbitrum",
    chainId: CHAIN_IDS.ARBITRUM,
    symbol: "ETH",
    color: "#28A0F0",
    icon: "🔷",
  },
  optimism: {
    name: "Optimism",
    chainId: CHAIN_IDS.OPTIMISM,
    symbol: "ETH",
    color: "#FF0420",
    icon: "🔴",
  },
  celo: {
    name: "Celo",
    chainId: CHAIN_IDS.CELO,
    symbol: "CELO",
    color: "#35D07F",
    icon: "🟡",
  },
  monad: {
    name: "Monad",
    chainId: CHAIN_IDS.MONAD,
    symbol: "MON",
    color: "#00FF00",
    icon: "🟢",
  },
  // Testnet networks
  "avalanche-fuji": {
    name: "Avalanche Fuji",
    chainId: CHAIN_IDS.AVALANCHE_FUJI,
    symbol: "AVAX",
    color: "#E84142",
    icon: "🔺",
  },
  "base-sepolia": {
    name: "Base Sepolia",
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    symbol: "ETH",
    color: "#0052FF",
    icon: "🔵",
  },
  sepolia: {
    name: "Sepolia",
    chainId: CHAIN_IDS.SEPOLIA,
    symbol: "ETH",
    color: "#627EEA",
    icon: "⟠",
  },
  "polygon-amoy": {
    name: "Polygon Amoy",
    chainId: CHAIN_IDS.POLYGON_AMOY,
    symbol: "MATIC",
    color: "#8247E5",
    icon: "🟣",
  },
  "arbitrum-sepolia": {
    name: "Arbitrum Sepolia",
    chainId: CHAIN_IDS.ARBITRUM_SEPOLIA,
    symbol: "ETH",
    color: "#28A0F0",
    icon: "🔷",
  },
  "optimism-sepolia": {
    name: "OP Sepolia",
    chainId: CHAIN_IDS.OPTIMISM_SEPOLIA,
    symbol: "ETH",
    color: "#FF0420",
    icon: "🔴",
  },
  "celo-sepolia": {
    name: "Celo Sepolia",
    chainId: CHAIN_IDS.CELO_SEPOLIA,
    symbol: "CELO",
    color: "#35D07F",
    icon: "🟡",
  },
  "monad-testnet": {
    name: "Monad Testnet",
    chainId: CHAIN_IDS.MONAD_TESTNET,
    symbol: "MON",
    color: "#00FF00",
    icon: "🟢",
  },
};

// Lists of network keys for filtering
const MAINNET_NETWORKS = ["avalanche", "base", "ethereum", "polygon", "arbitrum", "optimism", "celo", "monad"];
const TESTNET_NETWORKS = ["avalanche-fuji", "base-sepolia", "sepolia", "polygon-amoy", "arbitrum-sepolia", "optimism-sepolia", "celo-sepolia", "monad-testnet"];

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

    // Determine which networks to show
    const networksToShow = includeTestnets
      ? [...MAINNET_NETWORKS, ...TESTNET_NETWORKS]
      : MAINNET_NETWORKS;

    // Fetch transactions from perkos_transactions table
    const { data: transactions, error } = await firebaseAdmin
      .from("perkos_transactions")
      .select("network, chain_id, payer, payee, amount, created_at, status")
      .eq("status", "settled");

    if (error) {
      console.error("Error fetching transactions:", error);
      // Return all networks with zero stats on error
      return returnEmptyNetworks(networksToShow, period);
    }

    // Initialize stats for all networks (even those with no transactions)
    const networkStatsMap = new Map<string, NetworkAggregation>();
    for (const networkKey of networksToShow) {
      const metadata = NETWORK_METADATA[networkKey];
      if (metadata) {
        networkStatsMap.set(networkKey, {
          network: networkKey,
          chain_id: metadata.chainId,
          total_transactions: 0,
          total_volume_usd: 0,
          unique_payers: 0,
          unique_recipients: 0,
          last_transaction_at: null,
        });
      }
    }

    // Aggregate transaction data into network stats
    for (const tx of transactions || []) {
      const networkKey = tx.network;

      // Skip if not in our networks list
      if (!networkStatsMap.has(networkKey)) {
        continue;
      }

      const stats = networkStatsMap.get(networkKey)!;
      stats.total_transactions += 1;
      // Convert amount from string (6 decimals for USDC) to USD
      const amountUsd = Number(tx.amount || "0") / 1e6;
      stats.total_volume_usd += amountUsd;

      // Track last transaction
      if (!stats.last_transaction_at || new Date(tx.created_at) > new Date(stats.last_transaction_at)) {
        stats.last_transaction_at = tx.created_at;
      }
    }

    // Calculate unique payers and recipients per network
    for (const [networkKey, stats] of networkStatsMap) {
      const networkTxs = (transactions || []).filter(tx => tx.network === networkKey);
      const uniquePayers = new Set(networkTxs.map(tx => tx.payer));
      const uniqueRecipients = new Set(networkTxs.map(tx => tx.payee));
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
          const amountUsd = Number(tx.amount || "0") / 1e6;
          acc[tx.network].volume += amountUsd;
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
        icon: "🌐",
      };

      const periodData = periodStats[network.network];
      const isTestnet = TESTNET_NETWORKS.includes(network.network);

      return {
        id: network.network,
        name: metadata.name,
        chainId: network.chain_id,
        symbol: metadata.symbol,
        color: metadata.color,
        icon: metadata.icon,
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

// Helper function to return empty networks on error
function returnEmptyNetworks(networksToShow: string[], period: string) {
  const emptyNetworks = networksToShow.map((networkKey) => {
    const metadata = NETWORK_METADATA[networkKey];
    const isTestnet = TESTNET_NETWORKS.includes(networkKey);
    return {
      id: networkKey,
      name: metadata?.name || networkKey,
      chainId: metadata?.chainId || 0,
      symbol: metadata?.symbol || "ETH",
      color: metadata?.color || "#627EEA",
      icon: metadata?.icon || "🌐",
      isTestnet,
      stats: {
        totalTransactions: 0,
        totalVolume: "$0.00",
        totalVolumeRaw: 0,
        uniquePayers: 0,
        uniqueRecipients: 0,
        lastActivity: null,
      },
      periodStats: null,
      volumeShare: 0,
      transactionShare: 0,
    };
  });

  return NextResponse.json({
    networks: emptyNetworks,
    summary: {
      totalNetworks: networksToShow.length,
      activeNetworks: 0,
      totalTransactions: 0,
      totalVolume: "$0.00",
      totalVolumeRaw: 0,
    },
    period,
  });
}
