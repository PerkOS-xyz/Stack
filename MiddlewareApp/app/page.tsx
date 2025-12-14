"use client";

import { config } from "@/lib/utils/config";
import { SUPPORTED_NETWORKS } from "@/lib/utils/chains";
import { ConnectButton, useActiveAccount, darkTheme } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { useState, useEffect } from "react";

// Define wallets outside component to avoid hoisting issues
const supportedWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("app.phantom"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "facebook", "discord", "telegram", "phone"],
    },
  }),
].filter(wallet => wallet && typeof wallet === 'object');

export default function Home() {
  const account = useActiveAccount();
  const [activeTab, setActiveTab] = useState<"mainnet" | "testnet">("mainnet");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: "0",
    activeAgents: 0,
    networks: 8,
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate fetching real-time data
    setStats({
      totalTransactions: 22967,
      totalVolume: "$4.9M",
      activeAgents: 1247,
      networks: 8,
    });
  }, [timeRange]);

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
  ];

  const networks = {
    mainnet: [
      { name: "Avalanche", icon: "🔺", network: "avalanche", txCount: 5234, volume: "$1.2M" },
      { name: "Base", icon: "🔵", network: "base", txCount: 3490, volume: "$760K" },
      { name: "Ethereum", icon: "⟠", network: "ethereum", txCount: 4521, volume: "$980K" },
      { name: "Polygon", icon: "🟣", network: "polygon", txCount: 2876, volume: "$520K" },
      { name: "Arbitrum", icon: "🔷", network: "arbitrum", txCount: 3156, volume: "$680K" },
      { name: "Optimism", icon: "🔴", network: "optimism", txCount: 2234, volume: "$450K" },
      { name: "Celo", icon: "🟡", network: "celo", txCount: 1456, volume: "$280K" },
      { name: "Monad", icon: "🟢", network: "monad", txCount: 0, volume: "$0" },
    ],
    testnet: [
      { name: "Avalanche Fuji", icon: "🔺", network: "avalanche-fuji", txCount: 892, volume: "$234K" },
      { name: "Base Sepolia", icon: "🔵", network: "base-sepolia", txCount: 634, volume: "$145K" },
      { name: "Sepolia", icon: "⟠", network: "sepolia", txCount: 756, volume: "$178K" },
      { name: "Polygon Amoy", icon: "🟣", network: "polygon-amoy", txCount: 523, volume: "$98K" },
      { name: "Arbitrum Sepolia", icon: "🔷", network: "arbitrum-sepolia", txCount: 445, volume: "$87K" },
      { name: "OP Sepolia", icon: "🔴", network: "optimism-sepolia", txCount: 389, volume: "$72K" },
      { name: "Celo Sepolia", icon: "🟡", network: "celo-sepolia", txCount: 234, volume: "$45K" },
      { name: "Monad Testnet", icon: "🟢", network: "monad-testnet", txCount: 178, volume: "$32K" },
    ],
  };

  const activeNetworks = networks[activeTab];

  // Chart data - initialized in useEffect to avoid hydration mismatch
  const [chartData, setChartData] = useState<Array<{ day: number; height: number; value: number }>>([]);
  const [networkActivityData, setNetworkActivityData] = useState<number[]>([]);
  const [agentGrowthData, setAgentGrowthData] = useState<number[]>([]);
  const [volumeTrendData, setVolumeTrendData] = useState<number[]>([]);
  const [networkCharts, setNetworkCharts] = useState<Record<string, number[]>>({});

  // Generate chart data on client-side only
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

    // Pre-generate network charts for all networks
    const charts: Record<string, number[]> = {};
    [...networks.mainnet, ...networks.testnet].forEach((network) => {
      charts[network.network] = Array.from({ length: 24 }, () => Math.random() * 100);
    });
    setNetworkCharts(charts);
  }, []);

  // Small charts data
  const schemeDistributionData = [
    { name: "Exact", value: 65, color: "from-green-500/60 to-green-400/60" },
    { name: "Deferred", value: 35, color: "from-blue-500/60 to-blue-400/60" },
  ];

  // Recent transactions (mock)
  const recentTransactions = [
    { hash: "0xf3c4...a21b", network: "avalanche", amount: "$125.50", scheme: "exact", time: "2m ago" },
    { hash: "0x3e7f...9a8c", network: "base", amount: "$234.75", scheme: "exact", time: "8m ago" },
    { hash: "0xa1b2...4d5e", network: "avalanche", amount: "$56.30", scheme: "exact", time: "12m ago" },
    { hash: "0x5d8e...7b3f", network: "base", amount: "$189.40", scheme: "deferred", time: "18m ago" },
    { hash: "0x2c9a...1e6d", network: "avalanche", amount: "$98.75", scheme: "exact", time: "22m ago" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        {/* Header */}
        <header className="border-b border-blue-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Left Side - Hamburger Menu (mobile only) + Logo */}
              <div className="flex items-center space-x-3">
                {/* Hamburger Menu Button - visible on small screens */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>

                {/* Logo */}
                <img src="/logo.png" alt="Stack" className="w-10 h-10 rounded-lg" />
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Stack
                  </h1>
                  <p className="text-xs text-gray-400">Multi-Chain Payment Infrastructure</p>
                </div>
              </div>

              {/* Navigation Menu - Desktop only */}
              <nav className="hidden lg:flex items-center space-x-1">
                {account && (
                  <a
                    href="/dashboard"
                    className="px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2 font-medium"
                  >
                    <span>📊</span>
                    <span>Dashboard</span>
                  </a>
                )}
                <a
                  href="/networks"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2"
                >
                  <span>🌐</span>
                  <span>Networks</span>
                </a>
                <a
                  href="/transactions"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2"
                >
                  <span>💸</span>
                  <span>Transactions</span>
                </a>
                <a
                  href="/marketplace"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2"
                >
                  <span>🏪</span>
                  <span>Marketplace</span>
                </a>
                <a
                  href="/agents"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2"
                >
                  <span>👥</span>
                  <span>Agents</span>
                </a>
              </nav>

              {/* Right Side - Connect */}
              <ConnectButton
                client={client}
                chains={chains}
                wallets={supportedWallets}
                theme={darkTheme({
                  colors: {
                    primaryButtonBg: "linear-gradient(to right, #3b82f6, #06b6d4)",
                    primaryButtonText: "#ffffff",
                  },
                })}
                connectButton={{
                  label: "Sign In",
                  style: {
                    borderRadius: "8px",
                    fontWeight: "600",
                    padding: "8px 24px",
                  },
                }}
                connectModal={{
                  size: "wide",
                  title: "Sign In to Stack",
                  welcomeScreen: {
                    title: "Stack Middleware",
                    subtitle: "Multi-chain x402 payment infrastructure",
                  },
                  showThirdwebBranding: false,
                }}
              />
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <div className="lg:hidden mt-4 pt-4 border-t border-blue-500/20">
                <nav className="flex flex-col space-y-2">
                  {account && (
                    <a
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3 font-medium"
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </a>
                  )}
                  <a
                    href="/networks"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3"
                  >
                    <span>🌐</span>
                    <span>Networks</span>
                  </a>
                  <a
                    href="/transactions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3"
                  >
                    <span>💸</span>
                    <span>Transactions</span>
                  </a>
                  <a
                    href="/marketplace"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3"
                  >
                    <span>🏪</span>
                    <span>Marketplace</span>
                  </a>
                  <a
                    href="/agents"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-sm text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3"
                  >
                    <span>👥</span>
                    <span>Agents</span>
                  </a>
                </nav>
              </div>
            )}
          </div>
        </header>

        {/* Hero Section with Stats */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent leading-tight">
                Empowering Community
                <br />
                Web3 Agents
              </h2>
              <p className="text-lg md:text-xl text-gray-300 mb-6 max-w-2xl mx-auto">
                Multi-chain payment infrastructure built for communities. Supporting x402, service discovery, and gasless transactions across 8 networks including Ethereum, Avalanche, Base, Polygon, Arbitrum, and Optimism.
              </p>
            </div>

            {/* Main Stats Dashboard with Mini Charts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300">
                <div className="text-sm text-gray-400 mb-2">Total Transactions</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  {stats.totalTransactions.toLocaleString()}
                </div>
                <div className="text-xs text-green-400 mb-3">+12.5% vs last {timeRange}</div>
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
                <div className="text-xs text-green-400 mb-3">+8.3% vs last {timeRange}</div>
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
                <div className="text-xs text-green-400 mb-3">+15.7% vs last {timeRange}</div>
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
              {activeNetworks.map((network) => (
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
              ))}
            </div>
          </div>
        </section>

        {/* Analytics & Charts Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-8 text-gray-100">
              Network Analytics
            </h3>

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
                    <div className="text-lg font-bold text-green-400">+12.5%</div>
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
            <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-200">Recent Transactions</h3>
                <a href="/transactions" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                  View All →
                </a>
              </div>
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.hash}
                    className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg hover:border-blue-500/30 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="text-lg">
                        {networks.mainnet.find((n) => n.network === tx.network)?.icon ||
                          networks.testnet.find((n) => n.network === tx.network)?.icon}
                      </div>
                      <div>
                        <code className="text-cyan-400 text-sm">{tx.hash}</code>
                        <div className="text-xs text-gray-400 mt-0.5">{tx.network}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          tx.scheme === "exact"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {tx.scheme}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-200">{tx.amount}</div>
                        <div className="text-xs text-gray-400">{tx.time}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

            <div className="grid md:grid-cols-2 gap-6">
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
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-blue-500/20 backdrop-blur-sm bg-slate-950/50 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="text-gray-400 text-sm">
                  © 2025 Stack. Open Source.
                </div>
                <span className="flex px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-medium items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Operational</span>
                </span>
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
