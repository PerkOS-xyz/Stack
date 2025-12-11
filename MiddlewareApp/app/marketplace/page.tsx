"use client";

import { useState } from "react";
import Link from "next/link";

export default function MarketplacePage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "nft" | "defi" | "gaming" | "dao">("all");

  // Mock data - replace with actual API calls
  const overallStats = {
    activeProviders: "156",
    totalServices: "342",
    totalVolume: "$2.8M",
    communityMembers: "1.2K",
  };

  const serviceProviders = [
    {
      name: "Community DAO",
      description: "Decentralized governance and treasury management",
      address: "0x123a...45Bc",
      transactions: 1234,
      volume: "$234.5K",
      network: "avalanche",
      category: "dao",
      rating: 4.8,
      members: 450
    },
    {
      name: "Local NFT Hub",
      description: "Community-owned NFT marketplace and gallery",
      address: "0x456d...78Ef",
      transactions: 987,
      volume: "$189.2K",
      network: "base",
      category: "nft",
      rating: 4.9,
      members: 320
    },
    {
      name: "GameFi Guild",
      description: "Play-to-earn gaming community and rewards",
      address: "0xabc2...34Jk",
      transactions: 743,
      volume: "$142.3K",
      network: "avalanche",
      category: "gaming",
      rating: 4.6,
      members: 210
    },
    {
      name: "Community Swap",
      description: "Decentralized token exchange for local communities",
      address: "0xdef5...67Lm",
      transactions: 621,
      volume: "$118.9K",
      network: "base",
      category: "defi",
      rating: 4.5,
      members: 180
    },
  ];

  const networkIcons: Record<string, string> = {
    avalanche: "🔺",
    celo: "🌿",
    base: "🔵",
  };

  const categoryIcons: Record<string, string> = {
    all: "🏪",
    nft: "🎨",
    defi: "💰",
    gaming: "🎮",
    dao: "🏛️",
  };

  const filteredProviders = categoryFilter === "all"
    ? serviceProviders
    : serviceProviders.filter(p => p.category === categoryFilter);

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
                  <Link href="/marketplace" className="text-sm text-cyan-400 font-semibold">
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
                  Marketplace
                </h2>
                <p className="text-gray-400">Discover and connect with community service providers</p>
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
                <div className="text-sm text-gray-400 mb-1">Active Providers</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.activeProviders}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Services</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.totalServices}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.totalVolume}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Community Members</div>
                <div className="text-2xl font-bold text-gray-100">{overallStats.communityMembers}</div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {(["all", "nft", "defi", "gaming", "dao"] as const).map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize flex items-center space-x-2 ${
                      categoryFilter === category
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                        : "bg-slate-800/50 border border-blue-500/30 text-gray-400 hover:text-gray-200 hover:border-blue-400/50"
                    }`}
                  >
                    <span>{categoryIcons[category]}</span>
                    <span>{category === "all" ? "All Categories" : category.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Service Provider Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {filteredProviders.map((provider) => (
                <div
                  key={provider.address}
                  className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm hover:border-blue-400/50 hover:bg-slate-800/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6">
                    {/* Provider Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-100">{provider.name}</h3>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-md text-xs font-medium capitalize">
                            {categoryIcons[provider.category]} {provider.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{provider.description}</p>
                        <code className="text-xs text-gray-500 font-mono">{provider.address}</code>
                      </div>
                    </div>

                    {/* Provider Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Transactions</div>
                        <div className="text-lg font-semibold text-gray-200">
                          {provider.transactions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Volume</div>
                        <div className="text-lg font-semibold text-green-400">{provider.volume}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Members</div>
                        <div className="text-lg font-semibold text-gray-200">{provider.members}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Rating</div>
                        <div className="flex items-center space-x-1">
                          <span className="text-lg font-semibold text-yellow-400">⭐</span>
                          <span className="text-lg font-semibold text-gray-200">{provider.rating}</span>
                        </div>
                      </div>
                    </div>

                    {/* Network Badge */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{networkIcons[provider.network]}</span>
                        <span className="text-xs text-gray-400 capitalize">{provider.network}</span>
                      </div>
                      <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-200">
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
