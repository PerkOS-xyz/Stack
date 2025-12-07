"use client";

import { useState } from "react";
import Link from "next/link";

export default function NetworksPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");

  // Mock data - replace with actual API calls from your server
  const overallStats = {
    transactions: "12.4K",
    volume: "$2.8M",
    facilitators: 8,
    activeUsers: 1403,
  };

  const networkStats = [
    {
      name: "Avalanche",
      icon: "🔺",
      network: "avalanche",
      transactions: 5234,
      volume: "$1.2M",
      facilitators: 3,
      activeUsers: 589,
      change: "+12.4%",
    },
    {
      name: "Base",
      icon: "🔵",
      network: "base",
      transactions: 3043,
      volume: "$650K",
      facilitators: 2,
      activeUsers: 336,
      change: "+15.2%",
    },
  ];

  // Mock chart data - bars for visual representation
  const generateChartBars = (count: number) => {
    return Array.from({ length: 48 }, (_, i) => ({
      height: Math.floor(Math.random() * 60) + 20,
      value: Math.floor((count / 48) * (0.8 + Math.random() * 0.4)),
    }));
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
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      PerkOS x402
                    </h1>
                    <p className="text-xs text-gray-400">Multi-Chain Payment Infrastructure</p>
                  </div>
                </Link>

                <nav className="hidden md:flex items-center space-x-6">
                  <Link href="/networks" className="text-sm text-cyan-400 font-semibold">
                    Networks
                  </Link>
                  <Link href="/transactions" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Transactions
                  </Link>
                  <Link href="/marketplace" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Marketplace
                  </Link>
                  <Link href="/agents" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
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
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  Networks
                </h2>
                <p className="text-gray-400">Multi-chain x402 payment processing statistics</p>
              </div>

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

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Transactions</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.transactions}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Volume</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.volume}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Facilitators</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.facilitators}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Active Users</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.activeUsers}</div>
              </div>
            </div>

            {/* Network Cards with Charts */}
            <div className="space-y-6">
              {networkStats.map((network) => {
                const chartData = generateChartBars(network.transactions);
                return (
                  <div
                    key={network.network}
                    className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <span className="text-4xl">{network.icon}</span>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-100">{network.name}</h3>
                            <code className="text-xs text-gray-400 font-mono">{network.network}</code>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">Change ({timeRange})</div>
                          <div className="text-xl font-bold text-green-400">{network.change}</div>
                        </div>
                      </div>

                      {/* Mini Chart */}
                      <div className="mb-6">
                        <div className="h-32 flex items-end space-x-1">
                          {chartData.map((bar, i) => (
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
                            {network.transactions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Volume</div>
                          <div className="text-lg font-semibold text-green-400">{network.volume}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Facilitators</div>
                          <div className="text-lg font-semibold text-gray-200">{network.facilitators}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Active Users</div>
                          <div className="text-lg font-semibold text-gray-200">{network.activeUsers}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-blue-500/20 backdrop-blur-sm bg-slate-950/50 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="text-gray-400 text-sm">
                © 2025 PerkOS x402. Open Source.
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
