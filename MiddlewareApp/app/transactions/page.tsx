"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function TransactionsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [schemeFilter, setSchemeFilter] = useState<"all" | "exact" | "deferred">("all");
  const [chartData, setChartData] = useState<Array<{ height: number }>>([]);

  useEffect(() => {
    setChartData(
      Array.from({ length: 48 }, () => ({
        height: Math.floor(Math.random() * 60) + 20,
      }))
    );
  }, []);

  // Mock data - replace with actual API calls
  const overallStats = {
    totalTransactions: "12.4K",
    totalVolume: "$2.8M",
    avgTransactionSize: "$226",
    successRate: "99.2%",
  };

  const recentTransactions = [
    { hash: "0xf3c4...a21b", from: "0x742d...35Ab", to: "0x123a...45Bc", amount: "$125.50", scheme: "exact", network: "avalanche", status: "success", timestamp: "2m ago" },
    { hash: "0x1b5e...4d3f", from: "0x1a2b...47Ef", to: "0x789g...01Hi", amount: "$234.00", scheme: "exact", network: "base", status: "success", timestamp: "8m ago" },
    { hash: "0x9a7c...2e1d", from: "0x5d6e...83Gh", to: "0xabc2...34Jk", amount: "$45.75", scheme: "exact", network: "avalanche", status: "success", timestamp: "12m ago" },
  ];

  const networkIcons: Record<string, string> = {
    avalanche: "🔺",
    celo: "🌿",
    base: "🔵",
  };

  const filteredTransactions = schemeFilter === "all"
    ? recentTransactions
    : recentTransactions.filter(tx => tx.scheme === schemeFilter);

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
                  <Link href="/networks" className="text-sm text-gray-300 hover:text-cyan-400 transition-colors">
                    Networks
                  </Link>
                  <Link href="/transactions" className="text-sm text-cyan-400 font-semibold">
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
                  Transactions
                </h2>
                <p className="text-gray-400">All x402 payment transactions across community networks</p>
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
                <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.totalTransactions}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.totalVolume}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Avg Transaction</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.avgTransactionSize}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Success Rate</div>
                <div className="text-2xl font-bold text-green-400">{overallStats.successRate}</div>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-100 mb-6">Transaction Activity</h3>
              <div className="h-48 flex items-end space-x-1">
                {chartData.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-500/40 to-cyan-400/40 rounded-t-sm hover:from-blue-500/60 hover:to-cyan-400/60 transition-all duration-200"
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-gray-500">
                <span>Now</span>
                <span>{timeRange} ago</span>
              </div>
            </div>

            {/* Scheme Filter */}
            <div className="mb-6">
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                {(["all", "exact", "deferred"] as const).map((scheme) => (
                  <button
                    key={scheme}
                    onClick={() => setSchemeFilter(scheme)}
                    className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 capitalize ${
                      schemeFilter === scheme
                        ? "bg-slate-700 text-cyan-400"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {scheme === "all" ? "All Schemes" : `${scheme} Scheme`}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-blue-500/20">
                <h3 className="text-xl font-semibold text-gray-100">Recent Transactions</h3>
                <p className="text-sm text-gray-400 mt-1">Latest community payments across all networks</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Hash
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        From
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Scheme
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Network
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.hash} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-sm text-cyan-400 font-mono">{tx.hash}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-xs text-gray-400 font-mono">{tx.from}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-xs text-gray-400 font-mono">{tx.to}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-green-400">{tx.amount}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                            tx.scheme === "exact"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-purple-500/20 text-purple-400"
                          }`}>
                            {tx.scheme}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{networkIcons[tx.network]}</span>
                            <span className="text-xs text-gray-400 capitalize">{tx.network}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs font-medium">
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-400">{tx.timestamp}</div>
                        </td>
                      </tr>
                    ))}
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
