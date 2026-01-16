"use client";

import { useState, useEffect, useCallback } from "react";

export const dynamic = "force-dynamic";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

interface Agent {
  address: string;
  fullAddress: string;
  name: string | null;
  transactions: number;
  volume: string;
  network: string;
}

interface Stats {
  total: number;
  active: number;
  newToday: number;
  totalVolume: string;
}

interface ApiResponse {
  agents: Agent[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats: Stats;
}

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState<"member" | "provider">("member");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    newToday: 0,
    totalVolume: "$0",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period: timeRange,
        type: activeTab,
        limit: "50",
        offset: "0",
      });

      const response = await fetch(`/api/x402/agents?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }

      const data: ApiResponse = await response.json();
      setAgents(data.agents);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [timeRange, activeTab]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Network icons for all 16 supported networks (8 mainnet + 8 testnet)
  const networkIcons: Record<string, string> = {
    // Mainnet
    avalanche: "🔺",
    base: "🔵",
    ethereum: "⟠",
    polygon: "🟣",
    arbitrum: "🔷",
    optimism: "🔴",
    celo: "🟡",
    monad: "🟢",
    // Testnet
    "avalanche-fuji": "🔺",
    "base-sepolia": "🔵",
    sepolia: "⟠",
    "polygon-amoy": "🟣",
    "arbitrum-sepolia": "🔷",
    "optimism-sepolia": "🔴",
    "celo-sepolia": "🟡",
    "monad-testnet": "🟢",
  };

  const statsDisplay = {
    total: stats.total,
    active: stats.active,
    newToday: stats.newToday,
    totalVolume: stats.totalVolume,
  };

  return (
    <div className="min-h-screen bg-[#0E0716] text-white overflow-x-hidden flex flex-col">
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 via-transparent to-amber-950/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #EB1B69 1px, transparent 1px), linear-gradient(to bottom, #EB1B69 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pink-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative flex flex-col flex-1">
        <Header />

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12 flex-1">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mb-2">
                Community Web3 Agents
              </h2>
              <p className="text-gray-400">Track community members and service providers across all networks</p>
            </div>

            {/* Tabs and Time Range */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              {/* Agent Type Tabs */}
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("member")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === "member"
                      ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Community Members
                </button>
                <button
                  onClick={() => setActiveTab("provider")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === "provider"
                      ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Service Providers
                </button>
              </div>

              {/* Time Range Filter */}
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                {(["24h", "7d", "30d", "all"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                      timeRange === range
                        ? "bg-slate-700 text-pink-400"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 capitalize mb-1">Total</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : statsDisplay.total.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 capitalize mb-1">Active (24h)</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : statsDisplay.active.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 capitalize mb-1">New Today</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : statsDisplay.newToday.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 capitalize mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : statsDisplay.totalVolume}
                </div>
              </div>
            </div>

            {/* Top Agents Table */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-blue-500/20">
                <h3 className="text-xl font-semibold text-gray-100">
                  Top {activeTab === "member" ? "Community Members" : "Service Providers"}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Ranked by transaction volume {timeRange !== "all" ? `in the last ${timeRange}` : "(all time)"}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Rank
                      </th>
                      {activeTab === "provider" && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Volume
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Network
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {loading ? (
                      <tr>
                        <td colSpan={activeTab === "provider" ? 6 : 5} className="px-6 py-8 text-center text-gray-400">
                          Loading agents...
                        </td>
                      </tr>
                    ) : agents.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === "provider" ? 6 : 5} className="px-6 py-8 text-center text-gray-400">
                          No {activeTab === "member" ? "members" : "providers"} found for this period
                        </td>
                      </tr>
                    ) : (
                      agents.map((agent, index) => (
                        <tr
                          key={agent.fullAddress}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-300">#{index + 1}</div>
                          </td>
                          {activeTab === "provider" && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-200">
                                {agent.name || "Unknown"}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <code className="text-sm text-pink-400 font-mono">{agent.address}</code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-300">{agent.transactions.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-green-400">{agent.volume}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{networkIcons[agent.network] || "🌐"}</span>
                              <span className="text-xs text-gray-400 capitalize">{agent.network}</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
