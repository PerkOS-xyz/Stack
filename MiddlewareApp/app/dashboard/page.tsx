'use client';

import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { useState, useEffect } from 'react';

interface SponsorWallet {
  id: string;
  network: string;
  sponsor_address: string;
  balance: string;
  created_at: string;
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
    alert('Address copied to clipboard!');
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
                PerkOS x402 Facilitator
              </h1>
              <p className="text-gray-300">
                Connect your wallet to access the gas sponsorship dashboard
              </p>
            </div>

            <ConnectButton
              client={client}
              chains={chains}
              wallets={supportedWallets}
              connectButton={{
                label: "Connect Wallet",
                className: "!w-full !bg-gradient-to-r !from-blue-500 !to-cyan-500 hover:!from-blue-600 hover:!to-cyan-600 !text-white !font-semibold !py-3 !px-6 !rounded-lg !transition-all !shadow-lg hover:!shadow-xl",
              }}
              connectModal={{
                size: "wide",
                title: "Sign In",
                welcomeScreen: {
                  title: "PerkOS x402 Facilitator",
                  subtitle: "Automated gas sponsorship for your Web3 agents",
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
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        {/* Header - Same as landing page */}
        <header className="border-b border-blue-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚡</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    PerkOS x402
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

          {/* Create Wallet Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => createWallet('avalanche')}
              disabled={loading || wallets.some(w => w.network === 'avalanche')}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center border border-red-500/20 disabled:border-slate-600"
            >
              <span className="mr-2">🔺</span>
              {wallets.some(w => w.network === 'avalanche') ? 'Avalanche Wallet Created' : 'Create Avalanche Wallet'}
            </button>

            <button
              onClick={() => createWallet('base')}
              disabled={loading || wallets.some(w => w.network === 'base')}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center border border-blue-500/20 disabled:border-slate-600"
            >
              <span className="mr-2">🔵</span>
              {wallets.some(w => w.network === 'base') ? 'Base Wallet Created' : 'Create Base Wallet'}
            </button>

            <button
              onClick={() => createWallet('celo')}
              disabled={loading || wallets.some(w => w.network === 'celo')}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center border border-green-500/20 disabled:border-slate-600"
            >
              <span className="mr-2">🟢</span>
              {wallets.some(w => w.network === 'celo') ? 'Celo Wallet Created' : 'Create Celo Wallet'}
            </button>
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
                      <h3 className="font-semibold text-gray-200 capitalize">
                        {wallet.network}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Created {new Date(wallet.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Balance</p>
                      <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {(Number(wallet.balance) / 1e18).toFixed(4)} {wallet.network === 'avalanche' ? 'AVAX' : wallet.network === 'base' ? 'ETH' : 'CELO'}
                      </p>
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
                    <button className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all border border-purple-500/20">
                      Configure Rules
                    </button>
                    <button className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-gray-300 text-sm font-medium py-2 px-4 rounded-lg transition-all">
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
              <span>Create a sponsor wallet for the network you want to support</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-cyan-400">2.</span>
              <span>Fund the wallet by sending native tokens to the sponsor address</span>
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
        </div>
        </main>
      </div>
    </div>
  );
}
