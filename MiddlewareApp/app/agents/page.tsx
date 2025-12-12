"use client";

import { useState, useEffect, useCallback } from "react";
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

  const networkIcons: Record<string, string> = {
    avalanche: "🔺",
    "avalanche-fuji": "🔺",
    celo: "🌿",
    "celo-sepolia": "🌿",
    base: "🔵",
    "base-sepolia": "🔵",
  };

  const statsDisplay = {
    total: stats.total,
    active: stats.active,
    newToday: stats.newToday,
    totalVolume: stats.totalVolume,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        {/* Header */}
        <header className="border-b border-blue-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <Link href="/" className="flex items-center space-x-3">
                  <img src="/logo.png" alt="Stack" className="w-10 h-10 rounded-lg" />
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      Stack
                    </h1>
                    <p className="text-xs text-gray-400">Multi-Chain Payment Infrastructure</p>
                  </div>
                </Link>

                <nav className="hidden md:flex items-center space-x-6">
                  <Link href="/networks" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Networks
                  </Link>
                  <Link href="/transactions" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Transactions
                  </Link>
                  <Link href="/marketplace" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Marketplace
                  </Link>
                  <Link href="/agents" className="text-sm text-cyan-400 font-semibold">
                    Agents
                  </Link>
                </nav>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-sm font-medium">
                  ● Operational
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
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
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Community Members
                </button>
                <button
                  onClick={() => setActiveTab("provider")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === "provider"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
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
                        ? "bg-slate-700 text-cyan-400"
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
                            <code className="text-sm text-cyan-400 font-mono">{agent.address}</code>
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

        {/* Footer */}
        <footer className="border-t border-blue-500/20 backdrop-blur-sm bg-slate-950/50 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="text-gray-400 text-sm">
                © 2025 Stack. Open Source.
              </div>
              <div className="flex space-x-6">
                <a
                  href="https://x402.gitbook.io/x402"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Documentation
                </a>
                <a
                  href="https://github.com/coinbase/x402"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  GitHub
                </a>
                <a
                  href="/api/v2/x402/health"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Status
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
