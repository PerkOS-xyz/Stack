'use client';

import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet } from "thirdweb/wallets";
import { useState, useEffect } from 'react';

interface SponsorWallet {
  id: string;
  network: string;
  sponsor_address: string;
  balance: string;
  created_at: string;
}

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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              PerkOS x402 Facilitator
            </h1>
            <p className="text-gray-600">
              Connect your wallet to access the gas sponsorship dashboard
            </p>
          </div>

          <ConnectButton
            client={client}
            chains={chains}
            wallets={[
              inAppWallet({
                auth: {
                  options: ["email", "google", "apple", "facebook", "discord", "telegram", "phone"],
                },
              }),
            ]}
            connectButton={{
              label: "Connect Wallet",
              className: "!w-full !bg-purple-600 hover:!bg-purple-700 !text-white !font-semibold !py-3 !px-6 !rounded-lg !transition-colors",
            }}
            connectModal={{
              size: "wide",
              title: "Sign In",
              welcomeScreen: {
                title: "PerkOS x402 Facilitator",
                subtitle: "Automated gas sponsorship for your Web3 agents",
              },
            }}
          />

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Connect with:</p>
            <div className="flex flex-wrap gap-2 justify-center text-xs text-gray-600">
              <span className="bg-gray-100 px-3 py-1 rounded-full">Email</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Google</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Apple</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Discord</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Telegram</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">Phone</span>
              <span className="bg-gray-100 px-3 py-1 rounded-full">350+ Wallets</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Gas Sponsorship Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <ConnectButton
              client={client}
              chains={chains}
              wallets={[
                inAppWallet({
                  auth: {
                    options: ["email", "google", "apple", "facebook", "discord", "telegram", "phone"],
                  },
                }),
              ]}
              detailsButton={{
                displayBalanceToken: {
                  [chains[0].id]: "AVAX", // Avalanche Fuji (default)
                  [chains[1].id]: "AVAX", // Avalanche Mainnet
                  [chains[2].id]: "ETH",  // Base Sepolia
                  [chains[3].id]: "ETH",  // Base Mainnet
                  [chains[4].id]: "CELO", // Celo Alfajores
                  [chains[5].id]: "CELO", // Celo Mainnet
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalTransactions.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Volume</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalVolume}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.activeAgents}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsor Wallets Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sponsor Wallets</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create wallets to sponsor gas fees for your endpoints
              </p>
            </div>
          </div>

          {/* Create Wallet Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => createWallet('avalanche')}
              disabled={loading || wallets.some(w => w.network === 'avalanche')}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🔺</span>
              {wallets.some(w => w.network === 'avalanche') ? 'Avalanche Wallet Created' : 'Create Avalanche Wallet'}
            </button>

            <button
              onClick={() => createWallet('base')}
              disabled={loading || wallets.some(w => w.network === 'base')}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🔵</span>
              {wallets.some(w => w.network === 'base') ? 'Base Wallet Created' : 'Create Base Wallet'}
            </button>

            <button
              onClick={() => createWallet('celo')}
              disabled={loading || wallets.some(w => w.network === 'celo')}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
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
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {wallet.network}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Created {new Date(wallet.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Balance</p>
                      <p className="text-lg font-bold text-gray-900">
                        {(Number(wallet.balance) / 1e18).toFixed(4)} {wallet.network === 'avalanche' ? 'AVAX' : wallet.network === 'base' ? 'ETH' : 'CELO'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded p-3 mb-3">
                    <p className="text-xs text-gray-500 mb-1">Sponsor Address</p>
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-gray-900">
                        {wallet.sponsor_address}
                      </code>
                      <button
                        onClick={() => copyToClipboard(wallet.sponsor_address)}
                        className="ml-2 text-purple-600 hover:text-purple-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors">
                      Configure Rules
                    </button>
                    <button className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium py-2 px-4 rounded transition-colors">
                      View Analytics
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No sponsor wallets created yet.</p>
              <p className="text-sm mt-2">Create a wallet to start sponsoring gas fees.</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Create a sponsor wallet for the network you want to support</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>Fund the wallet by sending native tokens to the sponsor address</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Configure rules to specify which domains/agents can use your wallet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Gas fees will be automatically paid from your sponsor wallet - no intervention needed!</span>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}
