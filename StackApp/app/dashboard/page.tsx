'use client';

import { ConnectButton, useActiveAccount, darkTheme } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { useState, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { AddressDisplay } from '@/components/AddressDisplay';
import type { Address } from 'viem';

interface SponsorWallet {
  id: string;
  network: string;
  sponsor_address: string;
  balance: string;
  created_at: string;
}

interface SpendingTransaction {
  id: string;
  amount_wei: string;
  agent_address: string | null;
  transaction_hash: string | null;
  server_domain: string | null;
  server_endpoint: string | null;
  chain_id: string | null;
  network_name: string | null;
  spent_at: string;
  sponsor_wallet_id: string;
}

interface AnalyticsSummary {
  totalGasPaidWei: string;
  totalTransactions: number;
  period: string;
  chainId: string;
}

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

export default function DashboardPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;

  const [wallets, setWallets] = useState<SponsorWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: '$0',
    activeAgents: 0,
  });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<SponsorWallet | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'24h' | 'week' | '3months' | 'all'>('all');
  const [filterChainId, setFilterChainId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [newAgentAddress, setNewAgentAddress] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [addingRule, setAddingRule] = useState(false);
  const [activeTab, setActiveTab] = useState<'agent' | 'vendor' | 'spending' | 'time' | 'multichain' | 'notifications'>('agent');

  useEffect(() => {
    if (isConnected && address) {
      loadWallets();
      loadStats();
    }
  }, [isConnected, address]);

  const loadWallets = async () => {
    try {
      const response = await fetch(`/api/sponsor/wallets?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets || []);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalTransactions: data.totalTransactions || 0,
          totalVolume: data.totalVolume || '$0',
          activeAgents: data.activeAgents || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const createWallet = async (network: string) => {
    if (!address) return;

    setLoading(true);
    try {
      const response = await fetch('/api/sponsor/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          network,
        }),
      });

      if (response.ok) {
        await loadWallets();
      } else {
        const error = await response.json();
        alert(`Failed to create wallet: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
      alert('Failed to create wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard!');
  };

  const refreshBalance = async (walletId: string) => {
    try {
      const response = await fetch(`/api/sponsor/wallets/${walletId}/balance`);
      if (response.ok) {
        await loadWallets(); // Reload all wallets to get updated balance
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  };

  const loadRules = async (walletId: string) => {
    try {
      const response = await fetch(`/api/sponsor/rules?walletId=${walletId}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const addAgentRule = async () => {
    if (!selectedWallet || !newAgentAddress.trim()) {
      toast.error('Please enter an agent wallet address');
      return;
    }

    setAddingRule(true);
    try {
      const response = await fetch('/api/sponsor/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          ruleType: 'agent_whitelist',
          agentAddress: newAgentAddress.trim().toLowerCase(),
          description: `Allow gas sponsorship for agent ${newAgentAddress.trim()}`,
        }),
      });

      if (response.ok) {
        toast.success('Agent added successfully');
        setNewAgentAddress('');
        await loadRules(selectedWallet.id);
      } else {
        const error = await response.json();
        toast.error(`Failed to add agent: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add agent:', error);
      toast.error('Failed to add agent');
    } finally {
      setAddingRule(false);
    }
  };

  const addDomainRule = async () => {
    if (!selectedWallet || !newDomain.trim()) {
      toast.error('Please enter a vendor domain');
      return;
    }

    // Basic domain validation
    const domainPattern = /^([a-zA-Z0-9-*]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
    if (!domainPattern.test(newDomain.trim())) {
      toast.error('Please enter a valid domain (e.g., api.vendor.com)');
      return;
    }

    setAddingRule(true);
    try {
      const response = await fetch('/api/sponsor/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          ruleType: 'domain_whitelist',
          domain: newDomain.trim().toLowerCase(),
          description: `Allow gas sponsorship for requests from ${newDomain.trim()}`,
        }),
      });

      if (response.ok) {
        toast.success('Domain added successfully');
        setNewDomain('');
        await loadRules(selectedWallet.id);
      } else {
        const error = await response.json();
        toast.error(`Failed to add domain: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
      toast.error('Failed to add domain');
    } finally {
      setAddingRule(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!selectedWallet) return;

    try {
      const response = await fetch(`/api/sponsor/rules?ruleId=${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Agent removed successfully');
        await loadRules(selectedWallet.id);
      } else {
        toast.error('Failed to remove agent');
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to remove agent');
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    if (!selectedWallet) return;

    try {
      const response = await fetch(`/api/sponsor/rules?ruleId=${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        toast.success(enabled ? 'Agent enabled' : 'Agent disabled');
        await loadRules(selectedWallet.id);
      } else {
        toast.error('Failed to update agent');
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error('Failed to update agent');
    }
  };

  const loadAnalytics = async (walletId: string, page: number = 0) => {
    setLoadingTransactions(true);
    try {
      const limit = 20;
      const offset = page * limit;
      const chainParam = filterChainId !== 'all' ? `&chain_id=${filterChainId}` : '';
      const response = await fetch(
        `/api/sponsor/analytics?wallet_id=${walletId}&period=${filterPeriod}${chainParam}&limit=${limit}&offset=${offset}`
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary);
        setTotalPages(Math.ceil((data.pagination.total || 0) / limit));
      } else {
        toast.error('Failed to load analytics');
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const openAnalyticsModal = async (wallet: SponsorWallet) => {
    setSelectedWallet(wallet);
    setShowAnalyticsModal(true);
    setCurrentPage(0);
    setFilterPeriod('all');
    setFilterChainId('all');
    await loadAnalytics(wallet.id, 0);
  };

  const handleFilterChange = async () => {
    if (selectedWallet) {
      setCurrentPage(0);
      await loadAnalytics(selectedWallet.id, 0);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (selectedWallet && newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      await loadAnalytics(selectedWallet.id, newPage);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        {/* Animated Background Grid */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

        <div className="relative flex items-center justify-center min-h-screen p-4">
          <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                Stack Middleware
              </h1>
              <p className="text-gray-300">
                Connect your wallet to access the gas sponsorship dashboard
              </p>
            </div>

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
                label: "Connect Wallet",
                style: {
                  width: "100%",
                  borderRadius: "8px",
                  fontWeight: "600",
                  padding: "12px 24px",
                },
              }}
              connectModal={{
                size: "wide",
                title: "Sign In",
                welcomeScreen: {
                  title: "Stack Middleware",
                  subtitle: "Multi-chain x402 payment infrastructure",
                },
                showThirdwebBranding: false,
              }}
            />

            <div className="mt-6 pt-6 border-t border-blue-500/20">
              <p className="text-sm text-gray-400 mb-3">Connect with:</p>
              <div className="flex flex-wrap gap-2 justify-center text-xs">
                <span className="bg-blue-500/20 text-cyan-400 px-3 py-1 rounded-full font-medium">MetaMask</span>
                <span className="bg-blue-500/20 text-cyan-400 px-3 py-1 rounded-full font-medium">Coinbase Wallet</span>
                <span className="bg-blue-500/20 text-cyan-400 px-3 py-1 rounded-full font-medium">Rainbow</span>
                <span className="bg-blue-500/20 text-cyan-400 px-3 py-1 rounded-full font-medium">Phantom</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Email</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Google</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Apple</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Discord</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Telegram</span>
                <span className="bg-slate-700/50 text-gray-300 px-3 py-1 rounded-full">Phone</span>
                <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full font-medium">350+ More</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <Toaster position="top-right" richColors />
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        {/* Header - Same as landing page */}
        <header className="border-b border-blue-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <img src="/logo.png" alt="Stack" className="w-10 h-10 rounded-lg" />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Stack
                  </h1>
                  <p className="text-xs text-gray-400">Multi-Chain Payment Infrastructure</p>
                </div>
              </div>

              {/* Navigation Menu - Centered */}
              <nav className="hidden lg:flex items-center space-x-1">
                <a
                  href="/dashboard"
                  className="px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2 font-medium"
                >
                  <span>📊</span>
                  <span>Dashboard</span>
                </a>
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

              {/* Right Side - Status & Connect */}
              <div className="flex items-center space-x-3">
                <span className="hidden sm:flex px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-medium items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  <span>Operational</span>
                </span>

                <ConnectButton
                  client={client}
                  chains={chains}
                  wallets={supportedWallets}
                  detailsButton={{
                    displayBalanceToken: {
                      [chains[0]?.id]: "AVAX",
                      [chains[1]?.id]: "AVAX",
                      [chains[2]?.id]: "ETH",
                      [chains[3]?.id]: "ETH",
                      [chains[4]?.id]: "CELO",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-blue-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Transactions</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mt-2">
                  {stats.totalTransactions.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-500/20 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-blue-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Volume</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mt-2">{stats.totalVolume}</p>
              </div>
              <div className="bg-blue-500/20 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-blue-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Agents</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mt-2">
                  {stats.activeAgents}
                </p>
              </div>
              <div className="bg-green-500/20 rounded-full p-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsor Wallets Section */}
        <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Sponsor Wallets</h2>
              <p className="text-sm text-gray-400 mt-1">
                Create wallets to sponsor gas fees for your endpoints
              </p>
            </div>
          </div>

          {/* Create Wallet Button - Multi-Chain EVM */}
          <div className="max-w-md mb-6">
            <button
              onClick={() => createWallet('evm')}
              disabled={loading || wallets.length > 0}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center border border-blue-500/20 disabled:border-slate-600"
            >
              <span className="mr-2">⛓️</span>
              {wallets.length > 0 ? 'EVM Wallet Created' : 'Create EVM Sponsor Wallet'}
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Works on all EVM networks: Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad & testnets
            </p>
          </div>

          {/* Wallet List */}
          {wallets.length > 0 ? (
            <div className="space-y-4">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="bg-slate-900/50 border border-blue-500/20 backdrop-blur-sm rounded-lg p-4 hover:border-blue-400/40 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-200">
                        {wallet.network === 'evm' ? 'EVM Multi-Chain Wallet' : wallet.network}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Created {new Date(wallet.created_at).toLocaleDateString()}
                      </p>
                      {wallet.network === 'evm' && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">🔺 AVAX</span>
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">🔵 Base</span>
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">⟠ ETH</span>
                          <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">🟣 Polygon</span>
                          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">🔷 Arbitrum</span>
                          <span className="text-xs bg-red-600/20 text-red-300 px-1.5 py-0.5 rounded">🔴 OP</span>
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">🟡 Celo</span>
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">🟢 Monad</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div>
                          <p className="text-sm text-gray-400">Balance</p>
                          <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                            {(Number(wallet.balance) / 1e18).toFixed(4)} {wallet.network === 'evm' ? 'Native' : wallet.network === 'avalanche' ? 'AVAX' : wallet.network === 'base' ? 'ETH' : 'CELO'}
                          </p>
                        </div>
                        <button
                          onClick={() => refreshBalance(wallet.id)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
                          title="Refresh balance"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/80 border border-blue-500/20 rounded p-3 mb-3">
                    <p className="text-xs text-gray-400 mb-1">Sponsor Address</p>
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-gray-300">
                        {wallet.sponsor_address}
                      </code>
                      <button
                        onClick={() => copyToClipboard(wallet.sponsor_address)}
                        className="ml-2 text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedWallet(wallet);
                        setShowRulesModal(true);
                        loadRules(wallet.id);
                      }}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all border border-purple-500/20"
                    >
                      Configure Rules
                    </button>
                    <button
                      onClick={() => openAnalyticsModal(wallet)}
                      className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-gray-300 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                      View Analytics
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>No sponsor wallets created yet.</p>
              <p className="text-sm mt-2 text-gray-500">Create a wallet to start sponsoring gas fees.</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
          <h3 className="font-semibold text-cyan-400 mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start">
              <span className="font-bold mr-2 text-cyan-400">1.</span>
              <span>Create an EVM sponsor wallet - <strong className="text-cyan-400">one wallet works on all EVM networks</strong></span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-cyan-400">2.</span>
              <span>Fund the wallet by sending native tokens (AVAX, ETH, etc.) on any supported network</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-cyan-400">3.</span>
              <span>Configure rules to specify which domains/agents can use your wallet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-cyan-400">4.</span>
              <span>Gas fees will be automatically paid from your sponsor wallet - no intervention needed!</span>
            </li>
          </ol>
          <div className="mt-4 pt-4 border-t border-blue-500/20">
            <p className="text-xs text-gray-400">
              <strong className="text-cyan-400">Supported Networks:</strong> Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad (+ all testnets)
            </p>
          </div>
        </div>
        </main>

        {/* Configure Rules Modal */}
        {showRulesModal && selectedWallet && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-blue-500/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-800 border-b border-blue-500/20 p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Configure Sponsorship Rules
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Wallet: {selectedWallet.sponsor_address.slice(0, 6)}...{selectedWallet.sponsor_address.slice(-4)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRulesModal(false);
                    setSelectedWallet(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Service Tabs - Responsive Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 border-b border-blue-500/20 pb-4">
                  <button
                    onClick={() => setActiveTab('agent')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'agent'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Agents</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('vendor')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all relative ${
                      activeTab === 'vendor'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>Vendors</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('spending')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all relative ${
                      activeTab === 'spending'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Limits</span>
                      <span className="absolute -top-1 -right-1 text-[10px] bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded-full font-bold">Soon</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('time')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all relative ${
                      activeTab === 'time'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Schedule</span>
                      <span className="absolute -top-1 -right-1 text-[10px] bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded-full font-bold">Soon</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('multichain')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all relative ${
                      activeTab === 'multichain'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>Chains</span>
                      <span className="absolute -top-1 -right-1 text-[10px] bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded-full font-bold">Soon</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('notifications')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all relative ${
                      activeTab === 'notifications'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span>Alerts</span>
                      <span className="absolute -top-1 -right-1 text-[10px] bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded-full font-bold">Soon</span>
                    </div>
                  </button>
                </div>

                {/* Agent Whitelist Tab */}
                {activeTab === 'agent' && (
                  <>
                    {/* Info Notice */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-500/20 rounded-full p-2 flex-shrink-0">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-cyan-400 mb-1">Agent Whitelist</h3>
                          <p className="text-sm text-gray-300">
                            Control which agent wallet addresses can use your sponsor wallet for gas fees.
                          </p>
                        </div>
                      </div>
                    </div>

                {/* Add Agent Form */}
                <div className="bg-slate-900/50 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="font-medium text-gray-200 mb-3">Add Agent Wallet</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAgentAddress}
                      onChange={(e) => setNewAgentAddress(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addAgentRule();
                        }
                      }}
                      placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono text-sm"
                    />
                    <button
                      onClick={addAgentRule}
                      disabled={addingRule || !newAgentAddress.trim()}
                      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-all"
                    >
                      {addingRule ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Enter the agent's wallet address (0x...) to allow sponsored gas for their transactions
                  </p>
                </div>

                {/* Agent List */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-200">Whitelisted Agents ({rules.filter(r => r.rule_type === 'agent_whitelist').length})</h4>

                  {rules.filter(r => r.rule_type === 'agent_whitelist').length === 0 ? (
                    <div className="bg-slate-900/30 border border-slate-600/30 rounded-lg p-6 text-center">
                      <p className="text-gray-400 text-sm">
                        No agents whitelisted yet. Add agent wallet addresses to enable sponsored transactions.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rules
                        .filter(r => r.rule_type === 'agent_whitelist')
                        .map((rule) => (
                          <div
                            key={rule.id}
                            className={`bg-slate-900/50 border ${
                              rule.enabled ? 'border-green-500/30' : 'border-slate-600/30'
                            } rounded-lg p-4 flex items-center justify-between`}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                              <div className="flex-1">
                                <div className="text-sm">
                                  <AddressDisplay address={rule.agent_address as Address} />
                                </div>
                                {rule.description && (
                                  <p className="text-xs text-gray-400 mt-1">{rule.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleRule(rule.id, !rule.enabled)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                  rule.enabled
                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                }`}
                              >
                                {rule.enabled ? 'Enabled' : 'Disabled'}
                              </button>
                              <button
                                onClick={() => deleteRule(rule.id)}
                                className="text-red-400 hover:text-red-300 transition-colors p-1"
                                title="Delete agent"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className={`${rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'} border rounded-lg p-4`}>
                  <div className="flex items-start space-x-3">
                    <div className={`${rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? 'bg-green-500/20' : 'bg-yellow-500/20'} rounded-full p-2 flex-shrink-0`}>
                      <svg className={`w-5 h-5 ${rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? 'text-green-400' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-1 ${rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0 ? 'Whitelist Active' : 'No Active Rules'}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length > 0
                          ? `Gas sponsorship enabled for ${rules.filter(r => r.rule_type === 'agent_whitelist' && r.enabled).length} agent(s)`
                          : 'Add and enable agent addresses to sponsor their gas fees'}
                      </p>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* Vendor API Whitelist Tab */}
                {activeTab === 'vendor' && (
                  <>
                {/* Add Domain Form */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="bg-cyan-500/20 rounded-full p-2 flex-shrink-0">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-cyan-400 mb-1">Vendor Domain Whitelist</h3>
                      <p className="text-sm text-gray-400">
                        Whitelist vendor server domains where x402 API services run. Your sponsor wallet will pay gas fees for requests from these domains.
                      </p>
                    </div>
                  </div>

                  {/* Domain Input */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="api.vendor.com or *.platform.io"
                        className="flex-1 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                        onKeyPress={(e) => e.key === 'Enter' && addDomainRule()}
                      />
                      <button
                        onClick={addDomainRule}
                        disabled={addingRule || !newDomain.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center space-x-2"
                      >
                        {addingRule ? (
                          <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Adding...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Add Domain</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Examples */}
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold">Examples:</span> api.vendor.com, *.platform.io, payments.saas.com
                    </div>
                  </div>
                </div>

                {/* Domain List */}
                <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-cyan-400">Whitelisted Domains</h3>
                    <span className="text-sm text-gray-400">
                      {rules.filter(r => r.rule_type === 'domain_whitelist').length} domain(s)
                    </span>
                  </div>

                  {rules.filter(r => r.rule_type === 'domain_whitelist').length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No domains whitelisted yet</p>
                      <p className="text-xs mt-1">Add a vendor domain above to start sponsoring gas fees</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rules
                        .filter(r => r.rule_type === 'domain_whitelist')
                        .map((rule) => (
                          <div key={rule.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-mono text-cyan-400 text-sm">{rule.domain}</p>
                                {rule.description && (
                                  <p className="text-xs text-gray-500 mt-1">{rule.description}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => toggleRule(rule.id, !rule.enabled)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    rule.enabled
                                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                      : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                  }`}
                                >
                                  {rule.enabled ? 'Enabled' : 'Disabled'}
                                </button>
                                <button
                                  onClick={() => deleteRule(rule.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                                  title="Delete domain"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className={`${rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'} border rounded-lg p-4`}>
                  <div className="flex items-start space-x-3">
                    <div className={`${rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? 'bg-green-500/20' : 'bg-yellow-500/20'} rounded-full p-2 flex-shrink-0`}>
                      <svg className={`w-5 h-5 ${rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? 'text-green-400' : 'text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-1 ${rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0 ? 'Domain Whitelist Active' : 'No Active Domains'}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length > 0
                          ? `Gas sponsorship enabled for ${rules.filter(r => r.rule_type === 'domain_whitelist' && r.enabled).length} domain(s)`
                          : 'Add and enable vendor domains to sponsor their gas fees'}
                      </p>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* Spending Limits Tab */}
                {activeTab === 'spending' && (
                  <div className="bg-slate-900/30 border border-yellow-500/30 rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-yellow-500/20 rounded-full p-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Spending Limits</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Set daily, monthly, and per-transaction spending limits for your sponsor wallet.
                        </p>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                          <p className="text-xs text-gray-400 mb-2">Available limits:</p>
                          <div className="space-y-2 text-sm text-gray-300">
                            <div className="flex items-center justify-between">
                              <span>Daily Limit</span>
                              <span className="font-mono text-cyan-400">10 USDC/day</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Monthly Limit</span>
                              <span className="font-mono text-cyan-400">300 USDC/month</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Per Transaction</span>
                              <span className="font-mono text-cyan-400">5 USDC/tx</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-400 font-medium">Coming Soon</span>
                    </div>
                  </div>
                )}

                {/* Time Restrictions Tab */}
                {activeTab === 'time' && (
                  <div className="bg-slate-900/30 border border-yellow-500/30 rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-yellow-500/20 rounded-full p-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Time Restrictions</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Set active hours and days when gas sponsorship is allowed.
                        </p>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                          <p className="text-xs text-gray-400 mb-2">Example restrictions:</p>
                          <div className="space-y-2 text-sm text-gray-300">
                            <div className="flex items-center justify-between">
                              <span>Active Hours</span>
                              <span className="font-mono text-cyan-400">9:00 AM - 5:00 PM</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Active Days</span>
                              <span className="font-mono text-cyan-400">Mon-Fri</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Timezone</span>
                              <span className="font-mono text-cyan-400">UTC</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-400 font-medium">Coming Soon</span>
                    </div>
                  </div>
                )}

                {/* Multi-Chain Rules Tab */}
                {activeTab === 'multichain' && (
                  <div className="bg-slate-900/30 border border-yellow-500/30 rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-yellow-500/20 rounded-full p-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Multi-Chain Rules</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Configure different sponsorship rules for each blockchain network.
                        </p>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                          <p className="text-xs text-gray-400 mb-2">Supported networks:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-red-400"></div>
                              <span>Avalanche C-Chain</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                              <span>Base</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                              <span>Celo</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                              <span>Testnets</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            Set network-specific agent whitelists, spending limits, and time restrictions.
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-400 font-medium">Coming Soon</span>
                    </div>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                  <div className="bg-slate-900/30 border border-yellow-500/30 rounded-lg p-8 text-center">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="bg-yellow-500/20 rounded-full p-4">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Notification Settings</h3>
                        <p className="text-gray-400 text-sm mb-4">
                          Get alerts when important events occur with your sponsor wallet.
                        </p>
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                          <p className="text-xs text-gray-400 mb-2">Available notifications:</p>
                          <div className="space-y-2 text-sm text-gray-300 text-left">
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Low balance warnings</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Spending limit alerts</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Suspicious activity detection</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Daily/weekly reports</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            Choose notification methods: Email, Telegram, Discord, Webhooks
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-yellow-400 font-medium">Coming Soon</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-800 border-t border-blue-500/20 p-6">
                <button
                  onClick={() => {
                    setShowRulesModal(false);
                    setSelectedWallet(null);
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3 px-6 rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Modal */}
        {showAnalyticsModal && selectedWallet && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-blue-500/30 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-blue-500/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      Gas Payment Analytics
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Network: <span className="text-cyan-400 font-medium">{selectedWallet.network}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAnalyticsModal(false);
                      setSelectedWallet(null);
                      setTransactions([]);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filters and Summary */}
              <div className="border-b border-blue-500/20 p-6 space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Time Period Filter */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Time Period</label>
                    <select
                      value={filterPeriod}
                      onChange={(e) => {
                        setFilterPeriod(e.target.value as any);
                        setTimeout(handleFilterChange, 100);
                      }}
                      className="w-full bg-slate-700 border border-slate-600 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="24h">Last 24 Hours</option>
                      <option value="week">Last Week</option>
                      <option value="3months">Last 3 Months</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {/* Chain Filter */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">Blockchain</label>
                    <select
                      value={filterChainId}
                      onChange={(e) => {
                        setFilterChainId(e.target.value);
                        setTimeout(handleFilterChange, 100);
                      }}
                      className="w-full bg-slate-700 border border-slate-600 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    >
                      <option value="all">All Chains</option>
                      <option value="43114">Avalanche C-Chain</option>
                      <option value="43113">Avalanche Fuji</option>
                      <option value="8453">Base</option>
                      <option value="84532">Base Sepolia</option>
                    </select>
                  </div>

                  {/* Summary Stats */}
                  <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Total Gas Paid</p>
                    {summary && (
                      <p className="text-lg font-bold text-cyan-400">
                        {(Number(summary.totalGasPaidWei) / 1e18).toFixed(8)} {selectedWallet?.network === 'avalanche' ? 'AVAX' : selectedWallet?.network === 'base' ? 'ETH' : selectedWallet?.network === 'celo' ? 'CELO' : 'ETH'}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {summary?.totalTransactions || 0} transaction{(summary?.totalTransactions || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingTransactions ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-400 border-r-transparent"></div>
                    <p className="text-gray-400 mt-4">Loading transactions...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">No transactions yet</p>
                    <p className="text-sm mt-2 text-gray-500">Sponsored transactions will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 hover:bg-slate-700/50 transition-all"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Agent Wallet */}
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Agent Wallet</p>
                            {tx.agent_address ? (
                              <AddressDisplay address={tx.agent_address as Address} />
                            ) : (
                              <p className="text-gray-500 text-sm">N/A</p>
                            )}
                          </div>

                          {/* Amount */}
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Gas Fee Paid</p>
                            <p className="text-cyan-400 font-mono text-sm">
                              {(Number(tx.amount_wei) / 1e18).toFixed(8)} {tx.network_name === 'avalanche' || tx.chain_id === '43114' ? 'AVAX' : tx.network_name === 'base' || tx.chain_id === '8453' ? 'ETH' : tx.network_name === 'celo' || tx.chain_id === '42220' ? 'CELO' : selectedWallet?.network === 'avalanche' ? 'AVAX' : 'ETH'}
                            </p>
                          </div>

                          {/* Vendor URL */}
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Vendor</p>
                            {tx.server_domain ? (
                              <a
                                href={`https://${tx.server_domain}${tx.server_endpoint || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 text-sm font-mono truncate block transition-colors"
                              >
                                {tx.server_domain}
                              </a>
                            ) : (
                              <p className="text-gray-500 text-sm">N/A</p>
                            )}
                            {tx.server_endpoint && (
                              <p className="text-gray-500 text-xs mt-1 truncate">{tx.server_endpoint}</p>
                            )}
                          </div>

                          {/* Chain & Time */}
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Chain & Time</p>
                            <p className="text-gray-200 text-sm">
                              {tx.network_name || `Chain ${tx.chain_id || 'Unknown'}`}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                              {new Date(tx.spent_at).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Transaction Hash */}
                        {tx.transaction_hash && (
                          <div className="mt-3 pt-3 border-t border-slate-600/30">
                            <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
                            <a
                              href={`https://snowtrace.io/tx/${tx.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 font-mono text-xs break-all transition-colors"
                            >
                              {tx.transaction_hash}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer with Pagination */}
              <div className="sticky bottom-0 bg-slate-800 border-t border-blue-500/20 p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* Pagination Info */}
                  <div className="flex items-center space-x-4">
                    <p className="text-sm text-gray-400">
                      Page <span className="text-cyan-400 font-medium">{currentPage + 1}</span> of <span className="text-cyan-400 font-medium">{totalPages || 1}</span>
                    </p>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 0}
                          className="px-3 py-1 bg-slate-700 border border-slate-600 text-gray-300 rounded-lg text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= totalPages - 1}
                          className="px-3 py-1 bg-slate-700 border border-slate-600 text-gray-300 rounded-lg text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowAnalyticsModal(false);
                      setSelectedWallet(null);
                      setTransactions([]);
                      setSummary(null);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3 px-8 rounded-lg transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
