'use client';

import { useState } from 'react';

// Network configuration with icons, colors, and stablecoin support
const NETWORK_CONFIG: Record<string, {
  name: string;
  icon: string;
  color: string;
  borderColor: string;
  bgGradient: string;
  stablecoins: string[];
}> = {
  'avalanche': {
    name: 'Avalanche C-Chain',
    icon: '🔺',
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
    bgGradient: 'from-red-500/10 to-red-600/5',
    stablecoins: ['USDC', 'EURC', 'AUSD'],
  },
  'base': {
    name: 'Base',
    icon: '🔵',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    stablecoins: ['USDC', 'EURC'],
  },
  'celo': {
    name: 'Celo',
    icon: '🟢',
    color: 'text-green-400',
    borderColor: 'border-green-500/30',
    bgGradient: 'from-green-500/10 to-green-600/5',
    stablecoins: ['USDC', 'USDT'],
  },
  'ethereum': {
    name: 'Ethereum',
    icon: '⟠',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgGradient: 'from-purple-500/10 to-purple-600/5',
    stablecoins: ['USDC', 'EURC', 'AUSD', 'PYUSD'],
  },
  'polygon': {
    name: 'Polygon',
    icon: '🟣',
    color: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgGradient: 'from-violet-500/10 to-violet-600/5',
    stablecoins: ['USDC', 'AUSD'],
  },
  'arbitrum': {
    name: 'Arbitrum',
    icon: '🔷',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    bgGradient: 'from-cyan-500/10 to-cyan-600/5',
    stablecoins: ['USDC', 'AUSD', 'USDT'],
  },
  'optimism': {
    name: 'Optimism',
    icon: '🔴',
    color: 'text-red-300',
    borderColor: 'border-red-400/30',
    bgGradient: 'from-red-400/10 to-red-500/5',
    stablecoins: ['USDC', 'USDT'],
  },
  'monad': {
    name: 'Monad',
    icon: '🟣',
    color: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/30',
    bgGradient: 'from-fuchsia-500/10 to-fuchsia-600/5',
    stablecoins: ['USDC', 'AUSD'],
  },
  // Testnets
  'avalanche-fuji': {
    name: 'Avalanche Fuji',
    icon: '🔺',
    color: 'text-red-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-red-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    icon: '🔵',
    color: 'text-blue-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-blue-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'celo-sepolia': {
    name: 'Celo Sepolia',
    icon: '🟢',
    color: 'text-green-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-green-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'sepolia': {
    name: 'Sepolia',
    icon: '⟠',
    color: 'text-purple-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-purple-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'polygon-amoy': {
    name: 'Polygon Amoy',
    icon: '🟣',
    color: 'text-violet-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-violet-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    icon: '🔷',
    color: 'text-cyan-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-cyan-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'optimism-sepolia': {
    name: 'OP Sepolia',
    icon: '🔴',
    color: 'text-red-300',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-red-400/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
  'monad-testnet': {
    name: 'Monad Testnet',
    icon: '🟣',
    color: 'text-fuchsia-400',
    borderColor: 'border-yellow-500/30',
    bgGradient: 'from-fuchsia-500/10 to-yellow-600/5',
    stablecoins: ['USDC'],
  },
};

interface NetworkBalance {
  network: string;
  success: boolean;
  balance?: string;
  balanceFormatted?: string;
  symbol?: string;
  chainId?: number;
  isTestnet?: boolean;
  error?: string;
}

interface NetworkBalanceGridProps {
  balances: {
    mainnets: NetworkBalance[];
    testnets: NetworkBalance[];
    errors?: NetworkBalance[];
  };
  isLoading: boolean;
  onRefresh: () => void;
}

function NetworkBalanceCard({ balance }: { balance: NetworkBalance }) {
  const config = NETWORK_CONFIG[balance.network] || {
    name: balance.network,
    icon: '🔗',
    color: 'text-gray-400',
    borderColor: 'border-slate-600/30',
    bgGradient: 'from-slate-500/10 to-slate-600/5',
    stablecoins: ['USDC'],
  };

  const balanceNum = parseFloat(balance.balanceFormatted || '0');
  const hasFunds = balanceNum > 0;

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border p-4
        bg-gradient-to-br ${config.bgGradient}
        ${hasFunds ? config.borderColor : 'border-slate-700/30'}
        hover:border-opacity-60 transition-all duration-200
        ${hasFunds ? 'shadow-lg shadow-black/20' : ''}
      `}
    >
      {/* Network Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{config.icon}</span>
        <h4 className={`font-semibold ${config.color}`}>
          {config.name}
        </h4>
      </div>

      {/* Balance Display */}
      <div className="mb-3">
        <p className={`text-2xl font-bold font-mono ${hasFunds ? 'text-white' : 'text-gray-500'}`}>
          {balanceNum > 0 ? balanceNum.toFixed(4) : '0.0000'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {balance.symbol} Balance
        </p>
      </div>

      {/* Supported Stablecoins */}
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
          Supported Stablecoins
        </p>
        <div className="flex flex-wrap gap-1">
          {config.stablecoins.map((coin) => (
            <span
              key={coin}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-600/30 text-gray-400"
            >
              {coin}
            </span>
          ))}
        </div>
      </div>

      {/* Funded Indicator */}
      {hasFunds && (
        <div className="absolute top-2 right-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse block" />
        </div>
      )}
    </div>
  );
}

export function NetworkBalanceGrid({ balances, isLoading, onRefresh }: NetworkBalanceGridProps) {
  const [activeTab, setActiveTab] = useState<'mainnets' | 'testnets'>('mainnets');

  const currentBalances = activeTab === 'mainnets' ? balances.mainnets : balances.testnets;

  // Calculate totals
  const mainnetCount = balances.mainnets.length;
  const testnetCount = balances.testnets.length;
  const fundedMainnets = balances.mainnets.filter(b => parseFloat(b.balanceFormatted || '0') > 0).length;
  const fundedTestnets = balances.testnets.filter(b => parseFloat(b.balanceFormatted || '0') > 0).length;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('mainnets')}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${activeTab === 'mainnets'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-800/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700/50'
              }
            `}
          >
            Mainnets
            {fundedMainnets > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                {fundedMainnets}/{mainnetCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('testnets')}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-all
              ${activeTab === 'testnets'
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg shadow-yellow-500/25'
                : 'bg-slate-800/50 text-gray-400 hover:text-gray-200 hover:bg-slate-700/50'
              }
            `}
          >
            Testnets
            {fundedTestnets > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                {fundedTestnets}/{testnetCount}
              </span>
            )}
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-cyan-400 hover:text-cyan-300
                     bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Section Title */}
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {activeTab === 'mainnets' ? 'MAINNETS' : 'TESTNETS'}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
      </div>

      {/* Network Grid */}
      {isLoading && currentBalances.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-4 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-slate-700" />
                <div className="h-4 w-24 bg-slate-700 rounded" />
              </div>
              <div className="h-8 w-20 bg-slate-700 rounded mb-2" />
              <div className="h-3 w-16 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : currentBalances.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {currentBalances.map((balance) => (
            <NetworkBalanceCard key={balance.network} balance={balance} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No {activeTab} configured</p>
        </div>
      )}
    </div>
  );
}
