"use client";

import { config } from "@/lib/utils/config";
import { SUPPORTED_NETWORKS } from "@/lib/utils/chains";
import { CHAIN_DATA, getChainIcon } from "@/components/chain-icons";
import { useState, useEffect, useCallback, useRef } from "react";

export const dynamic = "force-dynamic";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { useWalletContext } from "@/lib/wallet/client";
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
  // Additional fields for detailed view
  from: string;
  fullFrom: string;
  to: string;
  fullTo: string;
  vendorDomain: string | null;
  vendorEndpoint: string | null;
  status: string;
  datetime: string;
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
  const { isConnected } = useWalletContext();
  const [activeTab, setActiveTab] = useState<"mainnet" | "testnet">("mainnet");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
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

  // Mount effect for animations
  useEffect(() => {
    setMounted(true);
  }, []);

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
      description: "Payment facilitator supporting both exact and deferred schemes. Enable your Web3 agents to accept payments seamlessly.",
      icon: "⚡",
      features: ["Instant Settlement", "Deferred Payments", "Multi-Chain"],
      endpoint: "/api/v2/x402",
      color: "pink",
    },
    {
      title: "Agent Discovery",
      description: "Help your agents be discovered. Auto-discovery endpoints for seamless wallet and agent integration.",
      icon: "◉",
      features: ["Agent Registry", "Auto-Config", "Standards Compliant"],
      endpoint: "/.well-known/agent-card.json",
      color: "amber",
    },
    {
      title: "ERC-8004 Identity",
      description: "On-chain agent identity with reputation and validation registries. Build trust in your ecosystem.",
      icon: "◈",
      features: ["Identity NFTs", "Reputation System", "Validator Network"],
      endpoint: "/.well-known/erc-8004.json",
      color: "emerald",
    },
    {
      title: "Dynamic Pricing",
      description: "Vendor-defined pricing strategies with full control. Fixed, tiered, usage-based pricing.",
      icon: "◆",
      features: ["Tiered Discounts", "Usage-Based", "Idempotent"],
      endpoint: "/api/v2/pricing",
      color: "violet",
    },
  ];

  // Active networks based on tab selection (from API data)
  const activeNetworks = networks[activeTab] || [];

  // Chart data - initialized in useEffect to avoid hydration mismatch
  const [chartData, setChartData] = useState<Array<{ day: number; height: number; value: number }>>([]);
  const [networkCharts, setNetworkCharts] = useState<Record<string, number[]>>({});

  // Generate mini chart data on client-side only
  useEffect(() => {
    setChartData(
      Array.from({ length: 30 }, (_, i) => ({
        day: i,
        height: Math.random() * 80 + 20,
        value: Math.floor(Math.random() * 500 + 100),
      }))
    );
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

  return (
    <div className="min-h-screen bg-[#0E0716] text-white overflow-x-hidden">
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 via-transparent to-orange-950/10" />

        {/* Animated radar grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #EB1B69 1px, transparent 1px),
              linear-gradient(to bottom, #EB1B69 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial glow from top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pink-500/10 via-transparent to-transparent blur-3xl" />

        {/* Corner accents */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-orange-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent" />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Scan line effect */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
          }}
        />
      </div>

      <div className="relative">
        <Header />

        {/* === HERO SECTION === */}
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-20 pb-32">
          {/* Animated orbital rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`absolute w-[600px] h-[600px] rounded-full border border-pink-500/10 transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
              style={{ animationDelay: '0.2s' }} />
            <div className={`absolute w-[800px] h-[800px] rounded-full border border-pink-500/5 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} />
            <div className={`absolute w-[1000px] h-[1000px] rounded-full border border-orange-500/5 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto text-center">
            {/* Status indicator */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 mb-8 bg-emerald-500/10 border border-emerald-500/20 rounded-full transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 text-sm font-mono tracking-wide">SYSTEM OPERATIONAL</span>
            </div>

            {/* Main headline */}
            <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <span className="block text-white/90">PAYMENT</span>
              <span className="block bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 bg-clip-text text-transparent">
                INFRASTRUCTURE
              </span>
            </h1>

            {/* Subheadline */}
            <p className={`text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              Multi-chain x402 protocol, agent discovery, and ERC-8004 identity.
              <br className="hidden sm:block" />
              <span className="text-gray-500">Built for the next generation of Web3 agents.</span>
            </p>

            {/* CTA buttons */}
            <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {isConnected ? (
                <Link
                  href="/dashboard"
                  className="group relative px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-pink-500/25"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Open Dashboard
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Link>
              ) : (
                <Link
                  href="/subscription"
                  className="group relative px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-pink-500/25"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Link>
              )}
              <a
                href="#services"
                className="px-8 py-4 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium rounded-lg transition-all"
              >
                Explore Services
              </a>
            </div>

          </div>

          {/* Supported Networks Carousel */}
          <div className={`w-full mt-16 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-white mb-1">Supported Networks</h3>
              <p className="text-sm text-gray-500">Multi-chain by default</p>
            </div>
            <div className="relative marquee-fade overflow-hidden">
              <div className="flex animate-marquee">
                {/* First set of chains */}
                {CHAIN_DATA.map((chain, idx) => (
                  <div
                    key={`first-${idx}`}
                    className="flex items-center gap-3 px-6 py-3 mx-3 rounded-xl border border-white/5 hover:border-pink-500/30 transition-colors shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(27, 24, 51, 0.8), rgba(14, 7, 22, 0.8))' }}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1">
                      <chain.Icon className="w-full h-full" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">{chain.name}</span>
                  </div>
                ))}
                {/* Duplicate set for seamless loop */}
                {CHAIN_DATA.map((chain, idx) => (
                  <div
                    key={`second-${idx}`}
                    className="flex items-center gap-3 px-6 py-3 mx-3 rounded-xl border border-white/5 hover:border-pink-500/30 transition-colors shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(27, 24, 51, 0.8), rgba(14, 7, 22, 0.8))' }}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1">
                      <chain.Icon className="w-full h-full" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">{chain.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-6 h-10 border-2 border-gray-700 rounded-full flex justify-center">
              <div className="w-1.5 h-3 bg-pink-500 rounded-full mt-2 animate-bounce" />
            </div>
          </div>
        </section>

        {/* === STATS SECTION === */}
        <section className="relative py-24 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="flex items-center gap-4 mb-12">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
              <h2 className="text-xs font-mono text-gray-500 uppercase tracking-[0.3em]">Live Metrics</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
            </div>

            {/* Stats grid - asymmetric layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {/* Transactions - Large */}
              <div className="col-span-2 lg:col-span-1 group relative bg-gradient-to-br from-pink-500/5 to-transparent border border-pink-500/10 hover:border-pink-500/30 rounded-2xl p-6 lg:p-8 transition-all duration-300">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                <div className="text-xs font-mono text-pink-500/70 uppercase tracking-wider mb-3">Transactions</div>
                <div className="text-4xl lg:text-5xl font-black text-white mb-2 font-mono tabular-nums">
                  {stats.totalTransactions.toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm font-mono">{growth.transactions}</span>
                  <span className="text-gray-600 text-xs">vs last {timeRange}</span>
                </div>
                {/* Mini chart */}
                <div className="mt-6 h-12 flex items-end gap-0.5">
                  {chartData.slice(0, 20).map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-pink-500/40 to-pink-400/20 rounded-t transition-all group-hover:from-pink-500/60 group-hover:to-pink-400/40"
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div className="group relative bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 hover:border-amber-500/30 rounded-2xl p-6 transition-all duration-300">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <div className="text-xs font-mono text-amber-500/70 uppercase tracking-wider mb-3">Volume</div>
                <div className="text-3xl lg:text-4xl font-black text-white mb-2">{stats.totalVolume}</div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm font-mono">{growth.volume}</span>
                </div>
              </div>

              {/* Active Agents */}
              <div className="group relative bg-gradient-to-br from-violet-500/5 to-transparent border border-violet-500/10 hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <div className="text-xs font-mono text-violet-500/70 uppercase tracking-wider mb-3">Agents</div>
                <div className="text-3xl lg:text-4xl font-black text-white mb-2">{stats.activeAgents.toLocaleString()}</div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-sm font-mono">{growth.agents}</span>
                </div>
              </div>

              {/* Networks */}
              <div className="group relative bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 hover:border-emerald-500/30 rounded-2xl p-6 transition-all duration-300">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500" />
                <div className="text-xs font-mono text-emerald-500/70 uppercase tracking-wider mb-3">Networks</div>
                <div className="text-3xl lg:text-4xl font-black text-white mb-2">{stats.networks}</div>
                <div className="text-xs text-gray-500">Mainnet + Testnet</div>
              </div>
            </div>
          </div>
        </section>

        {/* === SERVICES SECTION === */}
        <section id="services" className="relative py-24 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="max-w-2xl mb-16">
              <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Core Services</div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
                Everything you need to
                <span className="block text-gray-500">power Web3 payments</span>
              </h2>
            </div>

            {/* Services grid - 2x2 with varied sizes */}
            <div className="grid md:grid-cols-2 gap-6">
              {services.map((service, idx) => {
                const colorClasses: Record<string, { border: string; bg: string; text: string; glow: string }> = {
                  pink: { border: 'border-pink-500/20 hover:border-pink-500/40', bg: 'from-pink-500/5', text: 'text-pink-400', glow: 'group-hover:shadow-pink-500/10' },
                  cyan: { border: 'border-pink-500/20 hover:border-pink-500/40', bg: 'from-pink-500/5', text: 'text-pink-400', glow: 'group-hover:shadow-pink-500/10' },
                  amber: { border: 'border-orange-500/20 hover:border-orange-500/40', bg: 'from-orange-500/5', text: 'text-orange-400', glow: 'group-hover:shadow-orange-500/10' },
                  emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', bg: 'from-emerald-500/5', text: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/10' },
                  violet: { border: 'border-violet-500/20 hover:border-violet-500/40', bg: 'from-violet-500/5', text: 'text-violet-400', glow: 'group-hover:shadow-violet-500/10' },
                };
                const colors = colorClasses[service.color];

                return (
                  <div
                    key={service.title}
                    className={`group relative bg-gradient-to-br ${colors.bg} to-transparent border ${colors.border} rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl ${colors.glow}`}
                  >
                    {/* Icon */}
                    <div className={`text-5xl mb-6 ${colors.text} font-light`}>{service.icon}</div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold text-white mb-3">{service.title}</h3>
                    <p className="text-gray-400 mb-6 leading-relaxed">{service.description}</p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {service.features.map((feature) => (
                        <span key={feature} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* Endpoint */}
                    <div className="flex items-center gap-2 pt-6 border-t border-white/5">
                      <span className="text-xs text-gray-600 uppercase tracking-wider">Endpoint</span>
                      <code className={`text-sm font-mono ${colors.text}`}>{service.endpoint}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* === SUBSCRIPTION PLANS === */}
        <SubscriptionPlans />

        {/* === NETWORKS SECTION === */}
        <section className="relative py-24 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Section header with tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-12">
              <div>
                <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Infrastructure</div>
                <h2 className="text-4xl font-black text-white">Supported Networks</h2>
              </div>

              {/* Network tabs */}
              <div className="inline-flex bg-white/5 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("mainnet")}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "mainnet"
                      ? "bg-pink-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Mainnet
                </button>
                <button
                  onClick={() => setActiveTab("testnet")}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === "testnet"
                      ? "bg-pink-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Testnet
                </button>
              </div>
            </div>

            {/* Network cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading && activeNetworks.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white/10 rounded-lg" />
                      <div>
                        <div className="h-4 w-20 bg-white/10 rounded mb-2" />
                        <div className="h-3 w-16 bg-white/10 rounded" />
                      </div>
                    </div>
                  </div>
                ))
              ) : activeNetworks.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No network data available
                </div>
              ) : (
                activeNetworks.map((network) => {
                  const chainData = getChainIcon(network.network);
                  const IconComponent = chainData?.Icon;
                  return (
                  <div
                    key={network.network}
                    className="group bg-white/[0.02] border border-white/10 hover:border-pink-500/30 rounded-xl p-5 transition-all duration-300 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {IconComponent ? (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-8 h-8" />
                        </div>
                      ) : (
                        <span className="text-3xl">{network.icon}</span>
                      )}
                      <div>
                        <div className="font-semibold text-white">{network.name}</div>
                        <div className="text-xs font-mono text-gray-500">{network.network}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">TX</div>
                        <div className="text-lg font-bold text-pink-400 font-mono">{network.txCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Volume</div>
                        <div className="text-lg font-bold text-orange-400">{network.volume}</div>
                      </div>
                    </div>
                  </div>
                )})
              )}
            </div>
          </div>
        </section>

        {/* === ANALYTICS SECTION === */}
        <section className="relative py-24 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <div className="flex items-center justify-between mb-12">
              <div>
                <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Analytics</div>
                <h2 className="text-4xl font-black text-white">Network Performance</h2>
              </div>

              {/* Time range + View All */}
              <div className="flex items-center gap-4">
                <div className="inline-flex bg-white/5 border border-white/10 rounded-lg p-1">
                  {(["24h", "7d", "30d"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-1.5 rounded-md text-xs font-mono uppercase transition-all ${
                        timeRange === range
                          ? "bg-pink-500 text-white"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <Link
                  href="/networks"
                  className="hidden sm:flex items-center gap-2 text-sm text-gray-400 hover:text-pink-400 transition-colors"
                >
                  View All
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Charts grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {/* Main volume chart */}
              <div className="md:col-span-2 lg:col-span-1 bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Transaction Volume</div>
                    <div className="text-2xl font-bold text-white">{stats.totalTransactions.toLocaleString()}</div>
                  </div>
                  <span className="text-emerald-400 text-sm font-mono">{growth.transactions}</span>
                </div>
                <div className="h-32 flex items-end gap-0.5">
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-pink-500/50 to-pink-400/20 rounded-t hover:from-pink-500/70 hover:to-pink-400/40 transition-all cursor-crosshair"
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Network cards */}
              {activeNetworks.slice(0, 2).map((network) => {
                const networkChart = networkCharts[network.network] || [];
                const chainData = getChainIcon(network.network);
                const IconComponent = chainData?.Icon;
                return (
                  <div
                    key={network.network}
                    className="bg-white/[0.02] border border-white/10 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {IconComponent ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-6 h-6" />
                        </div>
                      ) : (
                        <span className="text-2xl">{network.icon}</span>
                      )}
                      <div>
                        <div className="font-semibold text-white">{network.name}</div>
                        <div className="text-xs font-mono text-gray-500">{network.network}</div>
                      </div>
                    </div>
                    <div className="h-20 flex items-end gap-0.5 mb-4">
                      {networkChart.map((value, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-amber-500/40 to-amber-400/20 rounded-t"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Transactions</div>
                        <div className="text-lg font-bold text-pink-400">{network.txCount.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Volume</div>
                        <div className="text-lg font-bold text-orange-400">{network.volume}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent transactions */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 lg:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
                  <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 text-xs font-mono rounded">
                    {recentTransactions.length}
                  </span>
                </div>
                <Link
                  href="/transactions"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-pink-400 transition-colors"
                >
                  View All
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Transaction</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Amount</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">From / To</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Vendor</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Network</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Time</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentTransactions.map((tx) => {
                        const chainData = getChainIcon(tx.network);
                        const TxIconComponent = chainData?.Icon;
                        const explorerUrl = getExplorerUrl(tx.network, tx.fullHash);

                        return (
                          <tr
                            key={tx.fullHash}
                            className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                            onClick={() => window.open(explorerUrl, '_blank')}
                          >
                            {/* Transaction Hash & Scheme */}
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-1">
                                <code className="text-sm text-pink-400 font-mono group-hover:text-pink-300">{tx.hash}</code>
                                <span className={`inline-flex w-fit px-2 py-0.5 rounded-md text-xs font-medium ${
                                  tx.scheme === "exact"
                                    ? "bg-pink-500/20 text-pink-400"
                                    : "bg-violet-500/20 text-violet-400"
                                }`}>
                                  {tx.scheme}
                                </span>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="px-3 py-3">
                              <span className="text-sm font-semibold text-emerald-400">{tx.amount}</span>
                            </td>

                            {/* From / To */}
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-0.5 text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-600">From:</span>
                                  <code className="text-gray-400 font-mono">{tx.from || "-"}</code>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-600">To:</span>
                                  <code className="text-gray-400 font-mono">{tx.to || "-"}</code>
                                </div>
                              </div>
                            </td>

                            {/* Vendor */}
                            <td className="px-3 py-3">
                              {tx.vendorDomain || tx.vendorEndpoint ? (
                                <div className="flex flex-col gap-0.5">
                                  {tx.vendorDomain && (
                                    <span className="text-xs text-cyan-400 font-medium">{tx.vendorDomain}</span>
                                  )}
                                  {tx.vendorEndpoint && (
                                    <code className="text-xs text-gray-500 font-mono truncate max-w-[120px]" title={tx.vendorEndpoint}>
                                      {tx.vendorEndpoint}
                                    </code>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">-</span>
                              )}
                            </td>

                            {/* Network */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {TxIconComponent ? (
                                  <TxIconComponent className="w-5 h-5" />
                                ) : (
                                  <span className="text-base">🌐</span>
                                )}
                                <span className="text-xs text-gray-400 capitalize">{tx.network}</span>
                              </div>
                            </td>

                            {/* Time */}
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-gray-400">{tx.datetime}</span>
                                <span className="text-xs text-gray-600">{tx.time}</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  tx.status === "success"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : tx.status === "pending"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}>
                                  {tx.status}
                                </span>
                                <svg className="w-4 h-4 text-gray-600 group-hover:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* === CODE EXAMPLE === */}
        <section className="relative py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Developer Experience</div>
              <h2 className="text-4xl font-black text-white mb-4">Quick Integration</h2>
              <p className="text-gray-400">Start accepting x402 payments in minutes</p>
            </div>

            <div className="relative bg-[#1B1833] border border-white/10 rounded-2xl overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-orange-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="text-xs font-mono text-gray-500">verify-payment.ts</div>
                <div className="px-2 py-0.5 bg-pink-500/20 text-pink-400 text-xs font-mono rounded">v2.0</div>
              </div>

              {/* Code */}
              <pre className="p-6 overflow-x-auto text-sm leading-relaxed">
                <code>
                  <span className="text-violet-400">const</span> <span className="text-pink-400">response</span> <span className="text-gray-500">=</span> <span className="text-violet-400">await</span> <span className="text-amber-400">fetch</span><span className="text-gray-500">(</span><span className="text-emerald-400">&apos;/api/v2/x402/verify&apos;</span><span className="text-gray-500">, {`{`}</span>{"\n"}
                  {"  "}<span className="text-pink-400">method</span><span className="text-gray-500">:</span> <span className="text-emerald-400">&apos;POST&apos;</span><span className="text-gray-500">,</span>{"\n"}
                  {"  "}<span className="text-pink-400">headers</span><span className="text-gray-500">: {`{`}</span> <span className="text-emerald-400">&apos;Content-Type&apos;</span><span className="text-gray-500">:</span> <span className="text-emerald-400">&apos;application/json&apos;</span> <span className="text-gray-500">{`}`},</span>{"\n"}
                  {"  "}<span className="text-pink-400">body</span><span className="text-gray-500">:</span> <span className="text-amber-400">JSON</span><span className="text-gray-500">.</span><span className="text-amber-400">stringify</span><span className="text-gray-500">({`{`}</span>{"\n"}
                  {"    "}<span className="text-pink-400">x402Version</span><span className="text-gray-500">:</span> <span className="text-amber-400">1</span><span className="text-gray-500">,</span>{"\n"}
                  {"    "}<span className="text-pink-400">paymentPayload</span><span className="text-gray-500">: {`{`}</span>{"\n"}
                  {"      "}<span className="text-pink-400">network</span><span className="text-gray-500">:</span> <span className="text-emerald-400">&apos;avalanche&apos;</span><span className="text-gray-500">,</span>{"\n"}
                  {"      "}<span className="text-pink-400">scheme</span><span className="text-gray-500">:</span> <span className="text-emerald-400">&apos;exact&apos;</span><span className="text-gray-500">,</span>{"\n"}
                  {"      "}<span className="text-pink-400">payload</span><span className="text-gray-500">: {`{ ... }`}</span>{"\n"}
                  {"    "}<span className="text-gray-500">{`}`},</span>{"\n"}
                  {"    "}<span className="text-pink-400">paymentRequirements</span><span className="text-gray-500">: {`{ ... }`}</span>{"\n"}
                  {"  "}<span className="text-gray-500">{`}`})</span>{"\n"}
                  <span className="text-gray-500">{`}`});</span>{"\n"}
                  {"\n"}
                  <span className="text-violet-400">const</span> <span className="text-gray-500">{`{`}</span> <span className="text-pink-400">isValid</span><span className="text-gray-500">,</span> <span className="text-pink-400">payer</span> <span className="text-gray-500">{`}`}</span> <span className="text-gray-500">=</span> <span className="text-violet-400">await</span> <span className="text-pink-400">response</span><span className="text-gray-500">.</span><span className="text-amber-400">json</span><span className="text-gray-500">();</span>
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* === API REFERENCE === */}
        <section className="relative py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Documentation</div>
              <h2 className="text-4xl font-black text-white mb-4">API Reference</h2>
              <p className="text-gray-400">RESTful endpoints for all your integration needs</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* x402 Protocol */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 text-xl">⚡</div>
                  <div className="font-bold text-white">x402 Protocol</div>
                </div>
                <div className="space-y-3">
                  {[
                    { method: "POST", path: "/api/v2/x402/verify" },
                    { method: "POST", path: "/api/v2/x402/settle" },
                    { method: "GET", path: "/api/v2/x402/supported" },
                    { method: "GET", path: "/api/v2/x402/health" },
                  ].map((ep) => (
                    <div key={ep.path} className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        ep.method === "POST" ? "bg-pink-500/20 text-pink-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {ep.method}
                      </span>
                      <code className="text-gray-400 text-xs truncate">{ep.path}</code>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discovery */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xl">◉</div>
                  <div className="font-bold text-white">Discovery</div>
                </div>
                <div className="space-y-3">
                  {[
                    { method: "GET", path: "/.well-known/agent-card.json" },
                    { method: "GET", path: "/.well-known/x402-payment.json" },
                    { method: "GET", path: "/.well-known/erc-8004.json" },
                  ].map((ep) => (
                    <div key={ep.path} className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-400">
                        {ep.method}
                      </span>
                      <code className="text-gray-400 text-xs truncate">{ep.path}</code>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-xl">◆</div>
                  <div className="font-bold text-white">Pricing</div>
                </div>
                <div className="space-y-3">
                  {[
                    { method: "POST", path: "/api/v2/pricing/calculate" },
                    { method: "GET", path: "/api/v2/pricing/config" },
                    { method: "POST", path: "/api/v2/pricing/config" },
                    { method: "GET", path: "/api/v2/pricing/analytics" },
                  ].map((ep, i) => (
                    <div key={`${ep.method}-${ep.path}-${i}`} className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        ep.method === "POST" ? "bg-pink-500/20 text-pink-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {ep.method}
                      </span>
                      <code className="text-gray-400 text-xs truncate">{ep.path}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* === CONTACT SECTION === */}
        <section id="contact" className="relative py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="text-xs font-mono text-pink-500 uppercase tracking-[0.3em] mb-4">Contact</div>
              <h2 className="text-4xl font-black text-white mb-4">Get in Touch</h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Have questions about integrating PerkOS Stack? Need help with your implementation?
                We&apos;re here to help you build the future of Web3 payments.
              </p>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
              <ContactForm />
            </div>

            {/* Contact links */}
            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              <a
                href="mailto:contact@perkos.xyz"
                className="flex items-center justify-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl hover:border-pink-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-300 group-hover:text-white transition-colors">contact@perkos.xyz</span>
              </a>

              <a
                href="https://x.com/perk_os"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl hover:border-pink-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-gray-300 group-hover:text-white transition-colors">@perk_os</span>
              </a>

              <a
                href="https://github.com/orgs/PerkOS-xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl hover:border-pink-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-300 group-hover:text-white transition-colors">GitHub</span>
              </a>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
