"use client";

import { config } from "@/lib/utils/config";
import { SUPPORTED_NETWORKS } from "@/lib/utils/chains";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useActiveAccount } from "thirdweb/react";
import Link from "next/link";

// Types for API response
interface NetworkStats {
  name: string;
  network: string;
  icon: string;
  chainId: number;
  txCount: number;
  volume: string;
}

interface RecentTransaction {
  hash: string;
  fullHash: string;
  network: string;
  amount: string;
  scheme: string;
  time: string;
  timestamp: number;
}

interface DashboardStats {
  totalTransactions: number;
  totalVolume: string;
  activeAgents: number;
  networks: number;
  growth: {
    transactions: string;
    volume: string;
    agents: string;
  };
  networkStats: {
    mainnet: NetworkStats[];
    testnet: NetworkStats[];
  };
  chartData: Array<{ day: number; value: number; date: string }>;
  recentTransactions: RecentTransaction[];
}

// Block explorer URLs for transaction links
const blockExplorers: Record<string, string> = {
  avalanche: "https://snowtrace.io/tx/",
  "avalanche-fuji": "https://testnet.snowtrace.io/tx/",
  celo: "https://celoscan.io/tx/",
  "celo-sepolia": "https://alfajores.celoscan.io/tx/",
  base: "https://basescan.org/tx/",
  "base-sepolia": "https://sepolia.basescan.org/tx/",
  ethereum: "https://etherscan.io/tx/",
  sepolia: "https://sepolia.etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  "polygon-amoy": "https://amoy.polygonscan.com/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  "arbitrum-sepolia": "https://sepolia.arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  "optimism-sepolia": "https://sepolia-optimism.etherscan.io/tx/",
  monad: "https://explorer.monad.xyz/tx/",
  "monad-testnet": "https://testnet.explorer.monad.xyz/tx/",
};

const getExplorerUrl = (network: string, hash: string): string => {
  const baseUrl = blockExplorers[network] || "https://etherscan.io/tx/";
  return `${baseUrl}${hash}`;
};

export default function Home() {
  const account = useActiveAccount();
  const [activeTab, setActiveTab] = useState<"mainnet" | "testnet">("mainnet");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: "$0",
    activeAgents: 0,
    networks: 8,
  });
  const [growth, setGrowth] = useState({
    transactions: "+0%",
    volume: "+0%",
    agents: "+0%",
  });
  const [networks, setNetworks] = useState<{ mainnet: NetworkStats[]; testnet: NetworkStats[] }>({
    mainnet: [],
    testnet: [],
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [apiChartData, setApiChartData] = useState<Array<{ day: number; value: number; date: string }>>([]);

  // Fetch dashboard stats from API
  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/stats?timeRange=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch stats");

      const data: DashboardStats = await response.json();

      setStats({
        totalTransactions: data.totalTransactions,
        totalVolume: data.totalVolume,
        activeAgents: data.activeAgents,
        networks: data.networks,
      });
      setGrowth(data.growth);
      setNetworks(data.networkStats);
      setRecentTransactions(data.recentTransactions);
      setApiChartData(data.chartData);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Fetch data when timeRange changes
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const services = [
    {
      title: "x402 Protocol",
      description: "Community-friendly payment facilitator supporting both exact and deferred schemes. Enable your Web3 agents to accept payments seamlessly.",
      icon: "💳",
      features: ["Community Focus", "Deferred Payments", "Multi-Chain"],
      endpoint: "/api/v2/x402",
    },
    {
      title: "Service Discovery",
      description: "Help your community agents be discovered easily. Auto-discovery endpoints for seamless wallet and agent integration.",
      icon: "🔍",
      features: ["Agent Discovery", "Community Registry", "Auto-Config"],
      endpoint: "/.well-known/agent-card.json",
    },
    {
      title: "ERC-8004",
      description: "Remove barriers for community adoption. Gasless transactions mean your users never worry about gas fees.",
      icon: "⚡",
      features: ["Zero Gas Fees", "Community UX", "Easy Onboarding"],
      endpoint: "/.well-known/erc-8004.json",
    },
    {
      title: "Dynamic Pricing",
      description: "Vendor-defined pricing strategies with full control. Fixed, tiered, usage-based pricing with idempotency guarantees.",
      icon: "💰",
      features: ["Tiered Discounts", "Usage-Based", "Idempotent"],
      endpoint: "/api/v2/pricing",
    },
  ];

  // Active networks based on tab selection (from API data)
  const activeNetworks = networks[activeTab] || [];

  // Chart data - initialized in useEffect to avoid hydration mismatch
  const [chartData, setChartData] = useState<Array<{ day: number; height: number; value: number }>>([]);
  const [networkActivityData, setNetworkActivityData] = useState<number[]>([]);
  const [agentGrowthData, setAgentGrowthData] = useState<number[]>([]);
  const [volumeTrendData, setVolumeTrendData] = useState<number[]>([]);
  const [networkCharts, setNetworkCharts] = useState<Record<string, number[]>>({});

  // Generate mini chart data on client-side only (for UI consistency before API loads)
  useEffect(() => {
    setChartData(
      Array.from({ length: 30 }, (_, i) => ({
        day: i,
        height: Math.random() * 80 + 20,
        value: Math.floor(Math.random() * 500 + 100),
      }))
    );
    setNetworkActivityData(Array.from({ length: 12 }, () => Math.random() * 100));
    setAgentGrowthData(Array.from({ length: 12 }, () => Math.random() * 100));
    setVolumeTrendData(Array.from({ length: 12 }, () => Math.random() * 100));
  }, []);

  // Generate network charts when API data loads
  useEffect(() => {
    if (networks.mainnet.length > 0 || networks.testnet.length > 0) {
      const charts: Record<string, number[]> = {};
      [...networks.mainnet, ...networks.testnet].forEach((network) => {
        charts[network.network] = Array.from({ length: 24 }, () => Math.random() * 100);
      });
      setNetworkCharts(charts);
    }
  }, [networks]);

  // Small charts data
  const schemeDistributionData = [
    { name: "Exact", value: 65, color: "from-green-500/60 to-green-400/60" },
    { name: "Deferred", value: 35, color: "from-blue-500/60 to-blue-400/60" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        <Header />

        {/* Hero Section with Stats */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-6xl font-bold mb-8 py-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">
                Empowering Community
                <br />
                Web3 Agents
              </h2>
              <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Multi-chain payment infrastructure built for communities. Supporting x402, service discovery, and gasless transactions across 8 networks including Ethereum, Avalanche, Base, Polygon, Arbitrum, and Optimism.
              </p>

              {/* Go to Dashboard button - shown when authenticated */}
              {account && (
                <div className="mb-8">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300"
                  >
                    <span>Go to Dashboard</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>

            {/* Main Stats Dashboard with Mini Charts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 mt-8">
              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="text-sm text-gray-400 mb-2">Total Transactions</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  {stats.totalTransactions.toLocaleString()}
                </div>
                <div className="text-xs text-green-400 mb-3">{growth.transactions} vs last {timeRange}</div>
                {/* Mini line chart */}
                <div className="h-8 flex items-end space-x-0.5">
                  {networkActivityData.map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-cyan-500/40 to-cyan-400/40 rounded-t-sm"
                      style={{ height: `${value}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="text-sm text-gray-400 mb-2">Total Volume</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {stats.totalVolume}
                </div>
                <div className="text-xs text-green-400 mb-3">{growth.volume} vs last {timeRange}</div>
                {/* Mini area chart */}
                <div className="h-8 flex items-end space-x-0.5">
                  {volumeTrendData.map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-500/40 to-purple-400/40 rounded-t-sm"
                      style={{ height: `${value}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="text-sm text-gray-400 mb-2">Active Agents</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {stats.activeAgents.toLocaleString()}
                </div>
                <div className="text-xs text-green-400 mb-3">{growth.agents} vs last {timeRange}</div>
                {/* Mini growth chart */}
                <div className="h-8 flex items-end space-x-0.5">
                  {agentGrowthData.map((value, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-purple-500/40 to-pink-400/40 rounded-t-sm"
                      style={{ height: `${value}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="text-sm text-gray-400 mb-2">Payment Schemes</div>
                <div className="flex items-baseline space-x-2 mb-2">
                  <div className="text-2xl font-bold text-green-400">65%</div>
                  <div className="text-sm text-gray-400">Exact</div>
                </div>
                <div className="text-xs text-blue-400 mb-3">35% Deferred</div>
                {/* Mini horizontal bar chart */}
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-slate-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: "65%" }} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-slate-900/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: "35%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Services Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">
              Supported Services
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="group p-6 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm hover:border-blue-400/50 hover:bg-slate-800/50 transition-all duration-300"
                >
                  <div className="text-5xl mb-4">{service.icon}</div>
                  <h4 className="text-xl font-semibold text-gray-100 mb-2">
                    {service.title}
                  </h4>
                  <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                    {service.description}
                  </p>

                  <div className="space-y-2 mb-4">
                    {service.features.map((feature) => (
                      <div key={feature} className="flex items-center space-x-2">
                        <span className="text-cyan-400 text-xs">✓</span>
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <code className="block mt-4 p-2 bg-slate-900/50 rounded text-xs text-cyan-400 font-mono border border-slate-700">
                    {service.endpoint}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Networks Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-8 text-gray-100">
              Supported Networks
            </h3>

            {/* Network Tabs */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab("mainnet")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === "mainnet"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Mainnet
                </button>
                <button
                  onClick={() => setActiveTab("testnet")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === "testnet"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Testnet
                </button>
              </div>
            </div>

            {/* Network Cards with Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading && activeNetworks.length === 0 ? (
                // Loading skeleton
                Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm animate-pulse"
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-slate-700 rounded w-24 mb-2" />
                        <div className="h-3 bg-slate-700 rounded w-16" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="h-3 bg-slate-700 rounded w-16 mb-1" />
                        <div className="h-5 bg-slate-700 rounded w-12" />
                      </div>
                      <div>
                        <div className="h-3 bg-slate-700 rounded w-12 mb-1" />
                        <div className="h-5 bg-slate-700 rounded w-14" />
                      </div>
                    </div>
                  </div>
                ))
              ) : activeNetworks.length === 0 ? (
                // No data state
                <div className="col-span-full text-center py-8 text-gray-400">
                  No network data available
                </div>
              ) : (
                activeNetworks.map((network) => (
                  <div
                    key={network.network}
                    className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 hover:bg-slate-800/70 transition-all duration-300"
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-3xl">{network.icon}</span>
                      <div>
                        <div className="text-base font-semibold text-gray-200">{network.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{network.network}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-gray-400">Transactions</div>
                        <div className="text-base font-bold text-cyan-400">{network.txCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Volume</div>
                        <div className="text-base font-bold text-blue-400">{network.volume}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Analytics & Charts Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-bold text-gray-100">
                Network Analytics
              </h3>
              <Link
                href="/networks"
                className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors group"
              >
                <span className="text-sm font-medium">View All</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Time Range Filter */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                {(["24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      timeRange === range
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Charts Grid - Transaction Volume + Network Performance */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Transaction Volume Chart */}
              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-5 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-base font-semibold text-gray-200">Transaction Volume</div>
                    <div className="text-xs text-gray-400">Last {timeRange}</div>
                  </div>
                </div>

                {/* Mini 30-day chart */}
                <div className="h-24 flex items-end space-x-0.5 mb-3">
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-500/50 to-cyan-400/50 rounded-t-sm hover:from-blue-500/70 hover:to-cyan-400/70 transition-all relative group"
                      style={{ height: `${bar.height}%` }}
                    >
                      <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-slate-900 text-cyan-400 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        ${bar.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">Total Transactions</div>
                    <div className="text-lg font-bold text-cyan-400">{stats.totalTransactions.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Growth</div>
                    <div className="text-lg font-bold text-green-400">{growth.transactions}</div>
                  </div>
                </div>
              </div>
              {/* Network Performance Charts */}
              {activeNetworks.map((network, idx) => {
                const networkChart = networkCharts[network.network] || [];
                return (
                  <div
                    key={network.network}
                    className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-5 backdrop-blur-sm hover:border-blue-400/50 hover:bg-slate-800/70 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-3xl">{network.icon}</span>
                        <div>
                          <div className="text-base font-semibold text-gray-200">{network.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{network.network}</div>
                        </div>
                      </div>
                    </div>

                    {/* Mini 24h activity chart */}
                    <div className="h-24 flex items-end space-x-0.5 mb-3">
                      {networkChart.map((value, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-cyan-500/50 to-cyan-400/50 rounded-t-sm hover:from-cyan-500/70 hover:to-cyan-400/70 transition-all"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400 text-xs">Transactions</div>
                        <div className="text-lg font-bold text-cyan-400">{network.txCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Volume</div>
                        <div className="text-lg font-bold text-blue-400">{network.volume}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Transactions */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-semibold text-gray-200">Recent Transactions</h3>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-full">
                    {recentTransactions.length}
                  </span>
                </div>
                <Link
                  href="/transactions"
                  className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors group"
                >
                  <span className="text-sm font-medium">View All</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
              {/* Card grid for 9 transactions */}
              {recentTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {recentTransactions.map((tx) => {
                    const networkIcon = networks.mainnet.find((n) => n.network === tx.network)?.icon ||
                      networks.testnet.find((n) => n.network === tx.network)?.icon ||
                      "🌐";
                    const explorerUrl = getExplorerUrl(tx.network, tx.fullHash);

                    return (
                      <a
                        key={tx.fullHash}
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-cyan-400/30 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{networkIcon}</span>
                            <span className="text-xs text-gray-400 capitalize">{tx.network}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                              success
                            </span>
                            <svg className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        </div>

                        {/* Transaction Hash */}
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 mb-1">Transaction Hash</div>
                          <code className="text-sm text-cyan-400 font-mono">{tx.hash}</code>
                        </div>

                        {/* Amount and Time */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Amount</div>
                            <div className="text-lg font-semibold text-green-400">{tx.amount}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Time</div>
                            <div className="text-sm text-gray-300">{tx.time}</div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            tx.scheme === "exact"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-purple-500/20 text-purple-400"
                          }`}>
                            {tx.scheme}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Code Example */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-8 text-gray-100">
              Quick Integration
            </h3>
            <div className="bg-slate-900/50 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">TypeScript Example</span>
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                  v2.0
                </span>
              </div>
              <pre className="text-sm overflow-x-auto">
                <code className="text-cyan-400">
{`// Verify x402 payment
const response = await fetch('/api/v2/x402/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    x402Version: 1,
    paymentPayload: {
      x402Version: 1,
      network: 'avalanche',
      scheme: 'exact',
      payload: { /* ... */ }
    },
    paymentRequirements: { /* ... */ }
  })
});

const { isValid, payer } = await response.json();`}
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* API Endpoints */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-100">
              API Reference
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* x402 Endpoints */}
              <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                  <span className="text-2xl mr-2">💳</span>
                  x402 Protocol
                </h4>
                <div className="space-y-2">
                  {[
                    { method: "POST", path: "/api/v2/x402/verify", desc: "Verify payment" },
                    { method: "POST", path: "/api/v2/x402/settle", desc: "Settle payment" },
                    { method: "GET", path: "/api/v2/x402/supported", desc: "Get capabilities" },
                    { method: "GET", path: "/api/v2/x402/health", desc: "Health check" },
                  ].map((endpoint) => (
                    <div key={endpoint.path} className="flex items-start space-x-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        endpoint.method === "POST" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                      }`}>
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <code className="text-cyan-400 text-xs">{endpoint.path}</code>
                        <p className="text-gray-400 text-xs mt-1">{endpoint.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discovery Endpoints */}
              <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                  <span className="text-2xl mr-2">🔍</span>
                  Service Discovery
                </h4>
                <div className="space-y-2">
                  {[
                    { method: "GET", path: "/.well-known/agent-card.json", desc: "Agent metadata" },
                    { method: "GET", path: "/.well-known/x402-payment.json", desc: "Payment config" },
                    { method: "GET", path: "/.well-known/erc-8004.json", desc: "Relay config" },
                  ].map((endpoint) => (
                    <div key={endpoint.path} className="flex items-start space-x-2 text-sm">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <code className="text-cyan-400 text-xs">{endpoint.path}</code>
                        <p className="text-gray-400 text-xs mt-1">{endpoint.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Pricing Endpoints */}
              <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                <h4 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                  <span className="text-2xl mr-2">💰</span>
                  Dynamic Pricing
                </h4>
                <div className="space-y-2">
                  {[
                    { method: "POST", path: "/api/v2/pricing/calculate", desc: "Calculate price" },
                    { method: "GET", path: "/api/v2/pricing/config", desc: "Get vendor config" },
                    { method: "POST", path: "/api/v2/pricing/config", desc: "Set pricing strategy" },
                    { method: "GET", path: "/api/v2/pricing/analytics", desc: "Pricing analytics" },
                  ].map((endpoint) => (
                    <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-start space-x-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        endpoint.method === "POST" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                      }`}>
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <code className="text-cyan-400 text-xs">{endpoint.path}</code>
                        <p className="text-gray-400 text-xs mt-1">{endpoint.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
