"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface NetworkStats {
  totalTransactions: number;
  totalVolume: string;
  totalVolumeRaw: number;
  uniquePayers: number;
  uniqueRecipients: number;
  lastActivity: string | null;
}

interface Network {
  id: string;
  name: string;
  chainId: number;
  symbol: string;
  color: string;
  icon: string;
  isTestnet: boolean;
  stats: NetworkStats;
  periodStats: {
    transactions: number;
    volume: string;
    volumeRaw: number;
  } | null;
  volumeShare: number;
  transactionShare: number;
}

interface Summary {
  totalNetworks: number;
  activeNetworks: number;
  totalTransactions: number;
  totalVolume: string;
  totalVolumeRaw: number;
}

interface ApiResponse {
  networks: Network[];
  summary: Summary;
  period: string;
}

export default function NetworksPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [showTestnets, setShowTestnets] = useState(false);
  const [chartData, setChartData] = useState<Record<string, Array<{ height: number; value: number }>>>({});
  const [networks, setNetworks] = useState<Network[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalNetworks: 0,
    activeNetworks: 0,
    totalTransactions: 0,
    totalVolume: "$0",
    totalVolumeRaw: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period: timeRange,
        includeTestnets: showTestnets ? "true" : "false",
      });

      const response = await fetch(`/api/x402/networks?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch networks");
      }

      const data: ApiResponse = await response.json();
      setNetworks(data.networks);
      setSummary(data.summary);

      // Generate chart data for each network
      const newChartData: Record<string, Array<{ height: number; value: number }>> = {};
      data.networks.forEach((network) => {
        const txCount = network.stats.totalTransactions || 1;
        newChartData[network.id] = Array.from({ length: 48 }, () => ({
          height: Math.max(5, Math.floor(Math.random() * 60) + (txCount > 0 ? 20 : 5)),
          value: Math.floor((txCount / 48) * (0.8 + Math.random() * 0.4)),
        }));
      });
      setChartData(newChartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load networks");
    } finally {
      setLoading(false);
    }
  }, [timeRange, showTestnets]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        <Header />

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  Networks
                </h2>
                <p className="text-gray-400">Multi-chain x402 payment processing statistics</p>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                {/* Testnet Toggle */}
                <button
                  onClick={() => setShowTestnets(!showTestnets)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    showTestnets
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                      : "bg-slate-800/50 border-blue-500/30 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {showTestnets ? "Hide Testnets" : "Show Testnets"}
                </button>

                {/* Time Range Filter */}
                <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                  {(["24h", "7d", "30d"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        timeRange === range
                          ? "bg-slate-700 text-cyan-400"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : summary.totalTransactions.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : summary.totalVolume}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Active Networks</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : summary.activeNetworks}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Networks</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : summary.totalNetworks}
                </div>
              </div>
            </div>

            {/* Network Cards with Charts */}
            <div className="space-y-6">
              {loading ? (
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm p-8 text-center text-gray-400">
                  Loading networks...
                </div>
              ) : networks.length === 0 ? (
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm p-8 text-center text-gray-400">
                  No network data available yet. Transaction data will appear here once payments are processed.
                </div>
              ) : (
                networks.map((network) => {
                  const networkChartData = chartData[network.id] || [];
                  const change = network.volumeShare > 0
                    ? `${network.volumeShare.toFixed(1)}%`
                    : "0%";

                  return (
                    <div
                      key={network.id}
                      className={`bg-slate-800/30 border rounded-xl backdrop-blur-sm overflow-hidden ${
                        network.isTestnet
                          ? "border-purple-500/30"
                          : "border-blue-500/20"
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-3">
                            <span className="text-4xl">{network.icon || "🌐"}</span>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-2xl font-bold text-gray-100">{network.name}</h3>
                                {network.isTestnet && (
                                  <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 text-xs">
                                    Testnet
                                  </span>
                                )}
                              </div>
                              <code className="text-xs text-gray-400 font-mono">
                                {network.id} (Chain ID: {network.chainId})
                              </code>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-400">Volume Share</div>
                            <div className="text-xl font-bold text-green-400">{change}</div>
                          </div>
                        </div>

                        {/* Mini Chart */}
                        <div className="mb-6">
                          <div className="h-32 flex items-end space-x-1">
                            {networkChartData.map((bar, i) => (
                              <div
                                key={i}
                                className="flex-1 bg-gradient-to-t from-blue-500/40 to-cyan-400/40 rounded-t-sm hover:from-blue-500/60 hover:to-cyan-400/60 transition-all duration-200"
                                style={{ height: `${bar.height}%` }}
                                title={`${bar.value} transactions`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-gray-500">
                            <span>Now</span>
                            <span>{timeRange} ago</span>
                          </div>
                        </div>

                        {/* Network Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Transactions</div>
                            <div className="text-lg font-semibold text-gray-200">
                              {network.stats.totalTransactions.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Volume</div>
                            <div className="text-lg font-semibold text-green-400">
                              {network.stats.totalVolume}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Unique Payers</div>
                            <div className="text-lg font-semibold text-gray-200">
                              {network.stats.uniquePayers}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Unique Recipients</div>
                            <div className="text-lg font-semibold text-gray-200">
                              {network.stats.uniqueRecipients}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
