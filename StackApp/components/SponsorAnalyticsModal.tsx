'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AddressDisplay } from '@/components/AddressDisplay';
import type { Address } from 'viem';

// ============================================================================
// TYPES
// ============================================================================

interface SpendingTransaction {
  id: string;
  // Gas fee data (from sponsor spending)
  gas_fee_wei: string;
  agent_address: string | null;
  transaction_hash: string | null;
  server_domain: string | null;
  server_endpoint: string | null;
  chain_id: string | null;
  network_name: string | null;
  spent_at: string;
  sponsor_wallet_id: string;
  // Payment data (from x402 transactions)
  payment_amount_wei?: string;
  payment_amount_usd?: number;
  payer_address?: string;
  recipient_address?: string;
  asset_symbol?: string;
  scheme?: string;
  status?: string;
  // Legacy field mapping
  amount_wei?: string; // Maps to gas_fee_wei for backwards compat
}

interface AnalyticsSummary {
  totalGasPaidWei: string;
  totalPaymentVolumeWei?: string;
  totalPaymentVolumeUsd?: number;
  totalTransactions: number;
  period: string;
  chainId: string;
}

interface SponsorWallet {
  id: string;
  network: string;
  wallet_type?: "EVM" | "SOLANA" | "COSMOS";
  sponsor_address: string;
  balance: string;
  created_at: string;
  wallet_name?: string;
}

interface SponsorAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: SponsorWallet | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SUPPORTED_NETWORKS = [
  { chainId: 'all', name: 'All Networks', symbol: '', icon: '🌐' },
  // Mainnets
  { chainId: '1', name: 'Ethereum', symbol: 'ETH', icon: '⟠', testnet: false },
  { chainId: '8453', name: 'Base', symbol: 'ETH', icon: '🔵', testnet: false },
  { chainId: '137', name: 'Polygon', symbol: 'MATIC', icon: '💜', testnet: false },
  { chainId: '43114', name: 'Avalanche', symbol: 'AVAX', icon: '🔺', testnet: false },
  { chainId: '42161', name: 'Arbitrum', symbol: 'ETH', icon: '🔷', testnet: false },
  { chainId: '10', name: 'Optimism', symbol: 'ETH', icon: '🔴', testnet: false },
  { chainId: '42220', name: 'Celo', symbol: 'CELO', icon: '🟡', testnet: false },
  { chainId: '10143', name: 'Monad', symbol: 'MON', icon: '🟣', testnet: false },
  // Testnets
  { chainId: '11155111', name: 'Sepolia', symbol: 'ETH', icon: '⟠', testnet: true },
  { chainId: '84532', name: 'Base Sepolia', symbol: 'ETH', icon: '🔵', testnet: true },
  { chainId: '80002', name: 'Polygon Amoy', symbol: 'MATIC', icon: '💜', testnet: true },
  { chainId: '43113', name: 'Avalanche Fuji', symbol: 'AVAX', icon: '🔺', testnet: true },
  { chainId: '421614', name: 'Arbitrum Sepolia', symbol: 'ETH', icon: '🔷', testnet: true },
  { chainId: '11155420', name: 'Optimism Sepolia', symbol: 'ETH', icon: '🔴', testnet: true },
  { chainId: '44787', name: 'Celo Alfajores', symbol: 'CELO', icon: '🟡', testnet: true },
  { chainId: '10143', name: 'Monad Testnet', symbol: 'MON', icon: '🟣', testnet: true },
];

const TIME_PERIODS = [
  { value: '24h', label: 'Last 24 Hours', shortLabel: '24h' },
  { value: 'week', label: 'Last 7 Days', shortLabel: '7d' },
  { value: '30d', label: 'Last 30 Days', shortLabel: '30d' },
  { value: '3months', label: 'Last 90 Days', shortLabel: '90d' },
  { value: 'all', label: 'All Time', shortLabel: 'All' },
];

const PAGE_SIZES = [10, 25, 50, 100];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatAddress = (address: string | null | undefined): string => {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatGas = (weiAmount: string | undefined, chainId: string | null): { amount: string; symbol: string } => {
  const wei = BigInt(weiAmount || '0');
  const eth = Number(wei) / 1e18;
  const network = SUPPORTED_NETWORKS.find(n => n.chainId === chainId);
  return {
    amount: eth < 0.0001 ? eth.toExponential(2) : eth.toFixed(6),
    symbol: network?.symbol || 'ETH',
  };
};

const formatUsdc = (weiAmount: string | undefined): { amount: string; symbol: string } => {
  if (!weiAmount) return { amount: '-', symbol: 'USDC' };
  const wei = BigInt(weiAmount);
  // USDC has 6 decimals
  const usdc = Number(wei) / 1e6;
  return {
    amount: usdc < 0.01 ? usdc.toFixed(6) : usdc.toFixed(2),
    symbol: 'USDC',
  };
};

const formatUsd = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
};

const formatDate = (dateStr: string): { date: string; time: string } => {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
};

const getBlockExplorerUrl = (chainId: string | null, txHash: string): string => {
  const explorers: Record<string, string> = {
    '1': 'https://etherscan.io',
    '11155111': 'https://sepolia.etherscan.io',
    '8453': 'https://basescan.org',
    '84532': 'https://sepolia.basescan.org',
    '137': 'https://polygonscan.com',
    '80002': 'https://amoy.polygonscan.com',
    '43114': 'https://snowtrace.io',
    '43113': 'https://testnet.snowtrace.io',
    '42161': 'https://arbiscan.io',
    '421614': 'https://sepolia.arbiscan.io',
    '10': 'https://optimistic.etherscan.io',
    '11155420': 'https://sepolia-optimism.etherscan.io',
    '42220': 'https://celoscan.io',
    '44787': 'https://alfajores.celoscan.io',
  };
  const base = explorers[chainId || ''] || 'https://etherscan.io';
  return `${base}/tx/${txHash}`;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Copy Button Component
const CopyButton = ({ text, className = '' }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 hover:bg-white/10 rounded transition-all ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status?: string }) => {
  const config = {
    success: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Success' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Failed' },
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pending' },
  };
  const c = config[status as keyof typeof config] || config.success;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.text.replace('text-', 'bg-')} mr-1.5`}></span>
      {c.label}
    </span>
  );
};

// Network Badge Component
const NetworkBadge = ({ chainId, networkName }: { chainId: string | null; networkName: string | null }) => {
  const network = SUPPORTED_NETWORKS.find(n => n.chainId === chainId) ||
                  SUPPORTED_NETWORKS.find(n => n.name.toLowerCase() === networkName?.toLowerCase());

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-700/50 border border-slate-600/50`}>
      <span className="mr-1.5">{network?.icon || '🔗'}</span>
      {network?.name || networkName || `Chain ${chainId}`}
      {network?.testnet && <span className="ml-1 text-[10px] text-gray-500">(testnet)</span>}
    </span>
  );
};

// Summary Card Component
const SummaryCard = ({
  title,
  value,
  subValue,
  icon,
  gradient
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  gradient: string;
}) => (
  <div className={`relative overflow-hidden rounded-xl border border-slate-700/50 ${gradient} p-4`}>
    <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
      <div className="w-full h-full rounded-full bg-white/5"></div>
    </div>
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="text-gray-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subValue && <div className="text-xs text-gray-400">{subValue}</div>}
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SponsorAnalyticsModal({ isOpen, onClose, wallet }: SponsorAnalyticsModalProps) {
  // State
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterChainId, setFilterChainId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState<string>('spent_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Export state
  const [exporting, setExporting] = useState(false);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        wallet_id: wallet.id,
        period: filterPeriod,
        limit: String(pageSize),
        offset: String(currentPage * pageSize),
      });

      if (filterChainId !== 'all') {
        params.append('chain_id', filterChainId);
      }

      const response = await fetch(`/api/sponsor/analytics?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        setTotalCount(data.pagination?.total || 0);
      } else {
        console.error('Failed to fetch analytics:', data.error);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [wallet, filterPeriod, filterChainId, pageSize, currentPage]);

  // Effects
  useEffect(() => {
    if (isOpen && wallet) {
      fetchAnalytics();
    }
  }, [isOpen, wallet, fetchAnalytics]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filterPeriod, filterChainId, pageSize]);

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tx =>
        tx.transaction_hash?.toLowerCase().includes(query) ||
        tx.agent_address?.toLowerCase().includes(query) ||
        tx.payer_address?.toLowerCase().includes(query) ||
        tx.recipient_address?.toLowerCase().includes(query) ||
        tx.server_domain?.toLowerCase().includes(query)
      );
    }

    // Apply sorting (client-side for search results)
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof SpendingTransaction];
      let bVal: any = b[sortField as keyof SpendingTransaction];

      // Handle BigInt comparisons for wei amounts
      if (sortField === 'gas_fee_wei' || sortField === 'payment_amount_wei' || sortField === 'amount_wei') {
        aVal = BigInt(aVal || '0');
        bVal = BigInt(bVal || '0');
        return sortDirection === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
      }

      if (sortField === 'spent_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [transactions, searchQuery, sortField, sortDirection]);

  // Export to CSV
  const exportToCSV = async () => {
    setExporting(true);
    try {
      // Fetch all data for export
      const params = new URLSearchParams({
        wallet_id: wallet!.id,
        period: filterPeriod,
        limit: '10000',
        offset: '0',
      });
      if (filterChainId !== 'all') {
        params.append('chain_id', filterChainId);
      }

      const response = await fetch(`/api/sponsor/analytics?${params}`);
      const data = await response.json();

      if (!data.transactions?.length) {
        alert('No transactions to export');
        return;
      }

      // Build CSV
      const headers = [
        'Date',
        'Time',
        'Transaction Hash',
        'Network',
        'Chain ID',
        'Payment (USDC)',
        'Payment (USD)',
        'Gas Fee (Wei)',
        'Gas Fee (Native)',
        'Payer Address',
        'Recipient Address',
        'Agent Address',
        'Vendor Domain',
        'Status'
      ];

      const rows = data.transactions.map((tx: SpendingTransaction) => {
        const { date, time } = formatDate(tx.spent_at);
        const gasWei = tx.gas_fee_wei || tx.amount_wei || '0';
        const gas = formatGas(gasWei, tx.chain_id);
        const payment = formatUsdc(tx.payment_amount_wei);
        const network = SUPPORTED_NETWORKS.find(n => n.chainId === tx.chain_id);

        return [
          date,
          time,
          tx.transaction_hash || '',
          network?.name || tx.network_name || '',
          tx.chain_id || '',
          tx.payment_amount_wei ? `${payment.amount} ${payment.symbol}` : '',
          tx.payment_amount_usd ? formatUsd(tx.payment_amount_usd) : '',
          gasWei,
          `${gas.amount} ${gas.symbol}`,
          tx.payer_address || tx.agent_address || '',
          tx.recipient_address || '',
          tx.agent_address || '',
          tx.server_domain || '',
          tx.status || 'success'
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: string[]) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sponsor-analytics-${wallet!.id}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalGasWei = BigInt(summary?.totalGasPaidWei || '0');
    const totalGasEth = Number(totalGasWei) / 1e18;
    const avgGas = summary?.totalTransactions ? totalGasEth / summary.totalTransactions : 0;

    // Payment volume from x402 transactions
    const totalPaymentWei = BigInt(summary?.totalPaymentVolumeWei || '0');
    const totalPaymentUsdc = Number(totalPaymentWei) / 1e6; // USDC has 6 decimals

    return {
      totalGas: totalGasEth < 0.0001 ? totalGasEth.toExponential(2) : totalGasEth.toFixed(6),
      totalTx: summary?.totalTransactions || 0,
      avgGas: avgGas < 0.000001 ? avgGas.toExponential(2) : avgGas.toFixed(8),
      totalPaymentUsdc: totalPaymentUsdc,
      totalPaymentVolumeUsd: summary?.totalPaymentVolumeUsd || 0,
    };
  }, [summary]);

  if (!isOpen || !wallet) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/50 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">

        {/* ============== HEADER ============== */}
        <div className="relative overflow-hidden border-b border-slate-700/50">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-blue-600/10 to-purple-600/10"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent"></div>

          <div className="relative px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Gas Payment Analytics
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {wallet.wallet_name || 'Sponsor Wallet'}
                      <span className="mx-2 text-gray-600">|</span>
                      <span className="text-cyan-400 font-mono text-xs">{formatAddress(wallet.sponsor_address)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ============== SUMMARY CARDS ============== */}
        <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Payment Volume"
              value={`${summaryStats.totalPaymentUsdc > 0 ? summaryStats.totalPaymentUsdc.toFixed(2) : '0.00'} USDC`}
              subValue={summaryStats.totalPaymentVolumeUsd > 0 ? formatUsd(summaryStats.totalPaymentVolumeUsd) : 'x402 payments'}
              gradient="bg-gradient-to-br from-blue-900/30 to-blue-800/10"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <SummaryCard
              title="Total Gas Paid"
              value={`${summaryStats.totalGas} ETH`}
              subValue="Sponsored gas fees"
              gradient="bg-gradient-to-br from-cyan-900/30 to-cyan-800/10"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
            <SummaryCard
              title="Total Transactions"
              value={summaryStats.totalTx.toLocaleString()}
              subValue={`${TIME_PERIODS.find(p => p.value === filterPeriod)?.label || 'All Time'}`}
              gradient="bg-gradient-to-br from-purple-900/30 to-purple-800/10"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <SummaryCard
              title="Active Networks"
              value={filterChainId === 'all' ? 'Multi-chain' : SUPPORTED_NETWORKS.find(n => n.chainId === filterChainId)?.name || 'Unknown'}
              subValue={wallet.network.toUpperCase()}
              gradient="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ============== FILTERS & CONTROLS ============== */}
        <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Time Period */}
              <div className="relative">
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-600 text-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer hover:bg-slate-700 transition-colors"
                >
                  {TIME_PERIODS.map(period => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Network Filter */}
              <div className="relative">
                <select
                  value={filterChainId}
                  onChange={(e) => setFilterChainId(e.target.value)}
                  className="appearance-none bg-slate-800 border border-slate-600 text-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent cursor-pointer hover:bg-slate-700 transition-colors min-w-[180px]"
                >
                  <optgroup label="All">
                    <option value="all">🌐 All Networks</option>
                  </optgroup>
                  <optgroup label="Mainnets">
                    {SUPPORTED_NETWORKS.filter(n => !n.testnet && n.chainId !== 'all').map(network => (
                      <option key={network.chainId} value={network.chainId}>
                        {network.icon} {network.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Testnets">
                    {SUPPORTED_NETWORKS.filter(n => n.testnet).map(network => (
                      <option key={network.chainId} value={network.chainId}>
                        {network.icon} {network.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tx hash, address..."
                  className="bg-slate-800 border border-slate-600 text-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-64 placeholder-gray-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-gray-200 transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                disabled={exporting || !transactions.length}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-sm text-white font-medium transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* ============== TRANSACTIONS TABLE ============== */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-1">No transactions found</p>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Try adjusting your search criteria' : 'Sponsored transactions will appear here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0 z-10">
                  <tr>
                    <th
                      className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('spent_at')}
                    >
                      <div className="flex items-center gap-1">
                        Date/Time
                        {sortField === 'spent_at' && (
                          <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                      Transaction
                    </th>
                    <th
                      className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('payment_amount_wei')}
                    >
                      <div className="flex items-center gap-1">
                        Payment
                        {sortField === 'payment_amount_wei' && (
                          <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3 cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort('gas_fee_wei')}
                    >
                      <div className="flex items-center gap-1">
                        Gas Fee
                        {sortField === 'gas_fee_wei' && (
                          <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                      Payer
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                      Recipient
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                      Network
                    </th>
                    <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredTransactions.map((tx, index) => {
                    const { date, time } = formatDate(tx.spent_at);
                    const gas = formatGas(tx.gas_fee_wei || tx.amount_wei, tx.chain_id);
                    const payment = formatUsdc(tx.payment_amount_wei);

                    return (
                      <tr
                        key={tx.id || index}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        {/* Date/Time */}
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-200">{date}</div>
                          <div className="text-xs text-gray-500">{time}</div>
                        </td>

                        {/* Transaction Hash */}
                        <td className="px-4 py-3">
                          {tx.transaction_hash ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={getBlockExplorerUrl(tx.chain_id, tx.transaction_hash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                {formatAddress(tx.transaction_hash)}
                              </a>
                              <CopyButton text={tx.transaction_hash} />
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">N/A</span>
                          )}
                        </td>

                        {/* Payment Amount (USDC) */}
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-blue-400">
                            {payment.amount} {payment.symbol}
                          </div>
                          {tx.payment_amount_usd && (
                            <div className="text-xs text-gray-500">
                              {formatUsd(tx.payment_amount_usd)}
                            </div>
                          )}
                        </td>

                        {/* Gas Fee */}
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm text-emerald-400">
                            {gas.amount} {gas.symbol}
                          </div>
                        </td>

                        {/* Payer */}
                        <td className="px-4 py-3">
                          {(tx.payer_address || tx.agent_address) ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-300">
                                {formatAddress(tx.payer_address || tx.agent_address)}
                              </span>
                              <CopyButton text={tx.payer_address || tx.agent_address || ''} />
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">N/A</span>
                          )}
                        </td>

                        {/* Recipient */}
                        <td className="px-4 py-3">
                          {tx.recipient_address ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-300">
                                {formatAddress(tx.recipient_address)}
                              </span>
                              <CopyButton text={tx.recipient_address} />
                            </div>
                          ) : tx.server_domain ? (
                            <div>
                              <a
                                href={`https://${tx.server_domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                {tx.server_domain}
                              </a>
                              {tx.server_endpoint && (
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                  {tx.server_endpoint}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">N/A</span>
                          )}
                        </td>

                        {/* Network */}
                        <td className="px-4 py-3">
                          <NetworkBadge chainId={tx.chain_id} networkName={tx.network_name} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============== FOOTER / PAGINATION ============== */}
        <div className="border-t border-slate-700/50 bg-slate-900/50 px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Page Info & Size Selector */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-600 text-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-400">
                Showing <span className="text-cyan-400 font-medium">{currentPage * pageSize + 1}</span> - <span className="text-cyan-400 font-medium">{Math.min((currentPage + 1) * pageSize, totalCount)}</span> of <span className="text-cyan-400 font-medium">{totalCount}</span>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                className="p-2 bg-slate-800 border border-slate-600 rounded-lg text-gray-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="First page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-gray-300 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (currentPage < 3) {
                    pageNum = i;
                  } else if (currentPage > totalPages - 4) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 border border-slate-600 text-gray-300 hover:bg-slate-700'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-gray-300 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-2 bg-slate-800 border border-slate-600 rounded-lg text-gray-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Last page"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SponsorAnalyticsModal;
