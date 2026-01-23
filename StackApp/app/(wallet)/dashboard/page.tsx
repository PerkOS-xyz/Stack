'use client';

import { useWalletContext, useWalletModal } from "@/lib/wallet/client";
import { useState, useEffect } from 'react';

export const dynamic = "force-dynamic";
import { toast, Toaster } from 'sonner';
import { AddressDisplay } from '@/components/AddressDisplay';
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NetworkBalanceGrid } from "@/components/NetworkBalanceGrid";
import { SponsorAnalyticsModal } from "@/components/SponsorAnalyticsModal";
import type { Address } from 'viem';
import Link from 'next/link';

interface UserProfile {
  wallet_address: string;
  display_name: string | null;
  account_type: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  github: string | null;
  created_at: string;
  updated_at: string;
}

interface SponsorWallet {
  id: string;
  network: string;
  wallet_type?: "EVM" | "SOLANA" | "COSMOS";
  sponsor_address: string;
  balance: string;
  created_at: string;
  wallet_name?: string;
  is_public?: boolean;
}

// Wallet type configuration for display
const WALLET_TYPE_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  networks: string;
}> = {
  evm: {
    label: 'EVM Multi-Chain',
    shortLabel: 'EVM',
    icon: '⟠',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/30',
    networks: 'Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad, Unichain & testnets',
  },
  solana: {
    label: 'Solana',
    shortLabel: 'SOL',
    icon: '◎',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    networks: 'Solana Mainnet & Devnet',
  },
  cosmos: {
    label: 'Cosmos',
    shortLabel: 'ATOM',
    icon: '⚛',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/30',
    networks: 'Cosmos Hub, Osmosis, and IBC-enabled chains',
  },
};

// Helper to get wallet type config
const getWalletTypeConfig = (network: string) => {
  return WALLET_TYPE_CONFIG[network] || WALLET_TYPE_CONFIG.evm;
};

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

export default function DashboardPage() {
  const { address, isConnected } = useWalletContext();
  const { openModal } = useWalletModal();

  const [wallets, setWallets] = useState<SponsorWallet[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
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
  const [multiNetworkBalances, setMultiNetworkBalances] = useState<Record<string, any>>({});
  const [loadingMultiNetworkBalances, setLoadingMultiNetworkBalances] = useState<Record<string, boolean>>({});

  // New wallet creation state
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletIsPublic, setNewWalletIsPublic] = useState(false);
  const [newWalletType, setNewWalletType] = useState<'evm' | 'solana' | 'cosmos'>('evm');
  const [creatingWallet, setCreatingWallet] = useState(false);

  // Wallet deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingWallet, setDeletingWallet] = useState(false);

  // Wallet name editing state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editingWalletName, setEditingWalletName] = useState('');

  // Expanded wallets state for collapsible balance sections
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());

  // Check if profile is complete (has display_name and account_type)
  const isProfileComplete = profile?.display_name && profile?.account_type;

  useEffect(() => {
    if (isConnected && address) {
      loadProfile();
      loadWallets();
      loadStats();
    }
  }, [isConnected, address]);

  const loadProfile = async () => {
    if (!address) return;

    setProfileLoading(true);
    try {
      const response = await fetch(`/api/profile?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile || null);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadWallets = async () => {
    try {
      const response = await fetch(`/api/sponsor/wallets?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        const loadedWallets = data.wallets || [];
        setWallets(loadedWallets);
        // Note: Network balances are now lazy-loaded when user clicks to expand
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

  const createWallet = async (network: string, walletName?: string, isPublic?: boolean) => {
    if (!address) return;

    setCreatingWallet(true);
    try {
      const response = await fetch('/api/sponsor/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWalletAddress: address,
          network,
          walletName: walletName || undefined,
          isPublic: isPublic || false,
        }),
      });

      if (response.ok) {
        toast.success('Sponsor wallet created successfully!');
        setShowCreateWalletModal(false);
        setNewWalletName('');
        setNewWalletIsPublic(false);
        await loadWallets();
      } else {
        const error = await response.json();
        toast.error(`Failed to create wallet: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
      toast.error('Failed to create wallet. Please try again.');
    } finally {
      setCreatingWallet(false);
    }
  };

  const updateWallet = async (walletId: string, walletName?: string, isPublic?: boolean) => {
    if (!address) return;

    try {
      const response = await fetch('/api/sponsor/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          userWalletAddress: address,
          walletName,
          isPublic,
        }),
      });

      if (response.ok) {
        toast.success('Wallet updated successfully!');
        await loadWallets();
      } else {
        const error = await response.json();
        toast.error(`Failed to update wallet: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update wallet:', error);
      toast.error('Failed to update wallet. Please try again.');
    }
  };

  const deleteWallet = async (walletId: string) => {
    if (!address) return;

    setDeletingWallet(true);
    try {
      const response = await fetch('/api/sponsor/wallets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          userWalletAddress: address,
        }),
      });

      if (response.ok) {
        toast.success('Wallet deleted successfully!');
        setShowDeleteConfirm(null);
        await loadWallets();
      } else {
        const error = await response.json();
        toast.error(`Failed to delete wallet: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      toast.error('Failed to delete wallet. Please try again.');
    } finally {
      setDeletingWallet(false);
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

  const loadMultiNetworkBalances = async (sponsorAddress: string, walletType: string = "EVM", forceRefresh: boolean = false) => {
    if (!sponsorAddress) return;

    setLoadingMultiNetworkBalances(prev => ({ ...prev, [sponsorAddress]: true }));
    try {
      // Add forceRefresh parameter when manually refreshing to bypass cache
      const params = new URLSearchParams({
        address: sponsorAddress,
        walletType,
      });
      if (forceRefresh) {
        params.set("forceRefresh", "true");
      }
      const response = await fetch(`/api/sponsor/wallets/balance-all-networks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMultiNetworkBalances(prev => ({ ...prev, [sponsorAddress]: data }));
      }
    } catch (error) {
      console.error('Failed to load multi-network balances:', error);
    } finally {
      setLoadingMultiNetworkBalances(prev => ({ ...prev, [sponsorAddress]: false }));
    }
  };

  // Toggle wallet balance section expansion with lazy loading
  const toggleWalletExpanded = (walletId: string, sponsorAddress: string, walletType: string = "EVM") => {
    setExpandedWallets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(walletId)) {
        newSet.delete(walletId);
      } else {
        newSet.add(walletId);
        // Lazy load balances when expanding if not already loaded
        if (!multiNetworkBalances[sponsorAddress]) {
          loadMultiNetworkBalances(sponsorAddress, walletType);
        }
      }
      return newSet;
    });
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
    let domainToAdd = newDomain.trim();

    // Strip protocol if present (http://, https://)
    domainToAdd = domainToAdd.replace(/^https?:\/\//, '');
    // Strip trailing path/query
    domainToAdd = domainToAdd.split('/')[0];

    // Check if localhost/IP is allowed (controlled by env variable)
    const allowLocalhost = process.env.NEXT_PUBLIC_ALLOW_LOCALHOST_DOMAINS === 'true';
    const isLocalhost = /^(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?)$/.test(domainToAdd);

    if (isLocalhost && !allowLocalhost) {
      toast.error('Localhost and IP addresses are not allowed in production');
      return;
    }

    // Validate domain format
    const domainPattern = allowLocalhost
      ? /^(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?|([a-zA-Z0-9-*]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(:\d+)?)$/
      : /^([a-zA-Z0-9-*]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(:\d+)?$/;

    if (!domainPattern.test(domainToAdd)) {
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
          domain: domainToAdd.toLowerCase(),
          description: `Allow gas sponsorship for requests from ${domainToAdd}`,
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
      <div className="min-h-screen bg-[#0E0716] text-white overflow-x-hidden">
        {/* === ATMOSPHERIC BACKGROUND === */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 via-transparent to-amber-950/10" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #EB1B69 1px, transparent 1px), linear-gradient(to bottom, #EB1B69 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pink-500/10 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        </div>

        <div className="relative flex items-center justify-center min-h-screen p-4">
          <div className="bg-slate-900/60 border border-pink-500/20 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mb-2">
                Stack Middleware
              </h1>
              <p className="text-gray-300">
                Connect your wallet to access the gas sponsorship dashboard
              </p>
            </div>

            <button
              onClick={() => openModal()}
              className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              Connect Wallet
            </button>

            <div className="mt-6 pt-6 border-t border-pink-500/20">
              <p className="text-sm text-gray-400 mb-3">Connect with:</p>
              <div className="flex flex-wrap gap-2 justify-center text-xs">
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full font-medium">MetaMask</span>
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full font-medium">Coinbase Wallet</span>
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full font-medium">Rainbow</span>
                <span className="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full font-medium">Phantom</span>
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
    <div className="min-h-screen bg-[#0E0716] text-white overflow-x-hidden">
      <Toaster position="top-right" richColors />
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 via-transparent to-amber-950/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #EB1B69 1px, transparent 1px), linear-gradient(to bottom, #EB1B69 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pink-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative">
        <Header />

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Profile Completion Banner */}
        {!profileLoading && !isProfileComplete && (
          <div className="mb-8 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 backdrop-blur-sm rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="bg-amber-500/30 rounded-full p-3 flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-300">Complete Your Profile</h3>
                  <p className="text-sm text-amber-200/80 mt-1">
                    Please complete your profile to unlock all features. You need to add a display name and select your account type to create sponsor wallets.
                  </p>
                </div>
              </div>
              <Link
                href="/profile"
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-lg shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 flex-shrink-0"
              >
                <span>Complete Profile</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/50 border border-pink-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-pink-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Transactions</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mt-2">
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

          <div className="bg-slate-800/50 border border-pink-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-pink-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Volume</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent mt-2">{stats.totalVolume}</p>
              </div>
              <div className="bg-pink-500/20 rounded-full p-3">
                <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-pink-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-pink-400/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Active Agents</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-pink-400 bg-clip-text text-transparent mt-2">
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
        <div className={`relative bg-slate-800/50 border backdrop-blur-sm rounded-xl p-6 mb-8 transition-all ${
          !isProfileComplete && !profileLoading
            ? 'border-slate-600/30 opacity-60'
            : 'border-pink-500/30'
        }`}>
          {/* Disabled Overlay */}
          {!isProfileComplete && !profileLoading && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] rounded-xl z-10 flex items-center justify-center">
              <div className="text-center p-6">
                <div className="bg-slate-800/90 border border-amber-500/30 rounded-xl p-6 max-w-md">
                  <svg className="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-amber-300 mb-2">Profile Required</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Complete your profile to create and manage sponsor wallets.
                  </p>
                  <Link
                    href="/profile"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-lg transition-all"
                  >
                    <span>Complete Profile</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">Sponsor Wallets</h2>
              <p className="text-sm text-gray-400 mt-1">
                Create wallets to sponsor gas fees for your endpoints
              </p>
            </div>
          </div>

          {/* Create Wallet Button - Multi-Chain EVM */}
          <div className="max-w-md mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateWalletModal(true)}
                disabled={creatingWallet || !isProfileComplete}
                className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center border border-pink-500/20 disabled:border-slate-600"
              >
                <span className="mr-2 text-lg">⟠</span>
                {wallets.length > 0 ? 'Add Wallet' : 'Create Sponsor Wallet'}
              </button>
              {wallets.length > 0 && (
                <Link
                  href="/wallet"
                  className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-lg transition-all flex items-center justify-center border border-green-500/20"
                  title="Open Wallet"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </Link>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              <span className="text-blue-400">⟠ EVM</span> works on all networks: Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad, Unichain & testnets
            </p>
            <p className="text-xs text-gray-500 mt-1 text-center">
              <span className="text-purple-400/60">◎ Solana</span> coming soon
            </p>
          </div>

          {/* Wallet List */}
          {wallets.length > 0 ? (
            <div className="space-y-4">
              {wallets.map((wallet) => {
                const isExpanded = expandedWallets.has(wallet.id);
                const balanceData = multiNetworkBalances[wallet.sponsor_address];
                // Handle nested balance structure: { mainnets: [], testnets: [], errors: [] }
                const balances = [
                  ...(Array.isArray(balanceData?.balances?.mainnets) ? balanceData.balances.mainnets : []),
                  ...(Array.isArray(balanceData?.balances?.testnets) ? balanceData.balances.testnets : [])
                ];
                const fundedNetworks = balances.filter((b: { balance: string }) => parseFloat(b.balance) > 0).length;
                const totalNetworks = balances.length;

                return (
                <div
                  key={wallet.id}
                  className="bg-slate-900/50 border border-pink-500/20 backdrop-blur-sm rounded-xl overflow-hidden hover:border-pink-400/40 transition-all"
                >
                  {/* Compact Wallet Header */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Name, Badges, Address */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {editingWalletId === wallet.id ? (
                            // Inline edit mode
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingWalletName}
                                onChange={(e) => setEditingWalletName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateWallet(wallet.id, editingWalletName);
                                    setEditingWalletId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingWalletId(null);
                                  }
                                }}
                                className="bg-slate-800 border border-pink-500/50 rounded-lg px-3 py-1 text-lg font-bold text-pink-400 focus:outline-none focus:border-pink-400 w-48"
                                autoFocus
                                placeholder="Wallet name..."
                              />
                              <button
                                onClick={() => {
                                  updateWallet(wallet.id, editingWalletName);
                                  setEditingWalletId(null);
                                }}
                                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                title="Save"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingWalletId(null)}
                                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                title="Cancel"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            // Display mode with edit button
                            <div className="flex items-center gap-2 group">
                              <h3 className="text-lg font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                                {wallet.wallet_name || 'Sponsor Wallet'}
                              </h3>
                              <button
                                onClick={() => {
                                  setEditingWalletId(wallet.id);
                                  setEditingWalletName(wallet.wallet_name || '');
                                }}
                                className="p-1 text-gray-500 hover:text-pink-400 opacity-0 group-hover:opacity-100 transition-all"
                                title="Edit wallet name"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {/* Wallet Type Badge */}
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              getWalletTypeConfig(wallet.network).bgColor
                            } ${getWalletTypeConfig(wallet.network).color} border ${getWalletTypeConfig(wallet.network).borderColor}`}
                            title={getWalletTypeConfig(wallet.network).networks}
                          >
                            <span className="text-sm">{getWalletTypeConfig(wallet.network).icon}</span>
                            {getWalletTypeConfig(wallet.network).shortLabel}
                          </span>
                          {/* Public/Private Badge */}
                          <button
                            onClick={() => updateWallet(wallet.id, undefined, !wallet.is_public)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                              wallet.is_public
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                                : 'bg-slate-700/50 text-gray-400 border border-slate-600 hover:bg-slate-700'
                            }`}
                            title={wallet.is_public ? 'Click to make private' : 'Click to make public'}
                          >
                            {wallet.is_public ? (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                                </svg>
                                Public
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Private
                              </>
                            )}
                          </button>
                          {/* Funded Networks Indicator (when collapsed and data loaded) */}
                          {!isExpanded && balances.length > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              fundedNetworks > 0
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {fundedNetworks}/{totalNetworks} funded
                            </span>
                          )}
                        </div>
                        {/* Address Row */}
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-pink-400 font-semibold">
                            {wallet.sponsor_address.slice(0, 6)}...{wallet.sponsor_address.slice(-5)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(wallet.sponsor_address)}
                            className="flex-shrink-0 text-gray-500 hover:text-pink-400 transition-colors p-1"
                            title="Copy address"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {wallet.created_at && (
                            <>
                              <span className="text-xs text-gray-600">•</span>
                              <span className="text-xs text-gray-500">
                                {(() => {
                                  // Handle Firestore Timestamp (has seconds/nanoseconds) or ISO string
                                  const ts = wallet.created_at as { seconds?: number; _seconds?: number } | string;
                                  if (typeof ts === 'object' && ts !== null && 'seconds' in ts && ts.seconds) {
                                    return new Date(ts.seconds * 1000).toLocaleDateString();
                                  }
                                  if (typeof ts === 'object' && ts !== null && '_seconds' in ts && ts._seconds) {
                                    return new Date(ts._seconds * 1000).toLocaleDateString();
                                  }
                                  const date = new Date(ts as string);
                                  return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
                                })()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedWallet(wallet);
                            setShowRulesModal(true);
                            loadRules(wallet.id);
                          }}
                          className="hidden sm:flex bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-all border border-purple-500/20"
                        >
                          Rules
                        </button>
                        <button
                          onClick={() => openAnalyticsModal(wallet)}
                          className="hidden sm:flex bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-gray-300 text-xs font-medium py-1.5 px-3 rounded-lg transition-all"
                        >
                          Analytics
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(wallet.id)}
                          className="hidden sm:flex bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium py-1.5 px-3 rounded-lg transition-all"
                          title="Delete wallet"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        {/* Mobile menu button */}
                        <div className="sm:hidden flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedWallet(wallet);
                              setShowRulesModal(true);
                              loadRules(wallet.id);
                            }}
                            className="p-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30"
                            title="Configure Rules"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openAnalyticsModal(wallet)}
                            className="p-2 bg-slate-700/50 text-gray-400 rounded-lg hover:bg-slate-700"
                            title="View Analytics"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(wallet.id)}
                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                            title="Delete wallet"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Balance Section Toggle */}
                  <button
                    onClick={() => toggleWalletExpanded(wallet.id, wallet.sponsor_address, wallet.wallet_type || "EVM")}
                    className="w-full px-4 py-3 bg-slate-800/50 border-t border-pink-500/10 flex items-center justify-between hover:bg-slate-800/80 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-sm text-gray-400 group-hover:text-gray-300">
                        {isExpanded ? 'Hide Network Balances' : 'Show Network Balances'}
                      </span>
                      {loadingMultiNetworkBalances[wallet.sponsor_address] && (
                        <svg className="animate-spin h-4 w-4 text-pink-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                    </div>
                    {balances.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {fundedNetworks} of {totalNetworks} networks funded
                      </span>
                    )}
                  </button>

                  {/* Collapsible Network Balances */}
                  {isExpanded && (
                    <div className="border-t border-pink-500/10 p-4">
                      {balanceData?.balances ? (
                        <NetworkBalanceGrid
                          balances={{
                            mainnets: Array.isArray(balanceData.balances.mainnets) ? balanceData.balances.mainnets : [],
                            testnets: Array.isArray(balanceData.balances.testnets) ? balanceData.balances.testnets : [],
                            errors: Array.isArray(balanceData.balances.errors) ? balanceData.balances.errors : [],
                          }}
                          isLoading={loadingMultiNetworkBalances[wallet.sponsor_address] || false}
                          onRefresh={() => {
                            // Pass forceRefresh=true to bypass cache when manually refreshing
                            loadMultiNetworkBalances(wallet.sponsor_address, wallet.wallet_type || "EVM", true);
                            refreshBalance(wallet.id);
                          }}
                        />
                      ) : (
                        <div className="text-center py-6">
                          <svg className="animate-spin h-8 w-8 text-pink-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-sm text-gray-400">Loading network balances...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-lg font-medium">No sponsor wallets created yet</p>
              <p className="text-sm mt-2 text-gray-500">Create a wallet to start sponsoring gas fees for your agents</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-pink-500/10 border border-pink-500/30 backdrop-blur-sm rounded-xl p-6">
          <h3 className="font-semibold text-pink-400 mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start">
              <span className="font-bold mr-2 text-pink-400">1.</span>
              <span>Create an <span className="text-blue-400">⟠ EVM</span> sponsor wallet - <strong className="text-pink-400">One address works on all EVM networks</strong></span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-pink-400">2.</span>
              <span>Fund the wallet by sending native tokens (AVAX, ETH, SOL, etc.) on any supported network</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-pink-400">3.</span>
              <span>Configure rules to specify which domains/agents can use your wallet</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2 text-pink-400">4.</span>
              <span>Gas fees will be automatically paid from your sponsor wallet - no intervention needed!</span>
            </li>
          </ol>
          <div className="mt-4 pt-4 border-t border-pink-500/20">
            <p className="text-xs text-gray-400">
              <strong className="text-pink-400">Supported EVM Networks:</strong> Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad, Unichain (+ all testnets)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              <strong className="text-purple-400/60">Solana:</strong> Coming soon
            </p>
          </div>
        </div>
        </main>

        {/* Create Wallet Modal */}
        {showCreateWalletModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-pink-500/30 rounded-xl max-w-md w-full">
              {/* Modal Header */}
              <div className={`border-b ${newWalletType === 'evm' ? 'border-pink-500/20' : newWalletType === 'solana' ? 'border-purple-500/20' : 'border-indigo-500/20'} p-6 flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${
                    newWalletType === 'evm' ? 'bg-pink-500/20 border-pink-500/30' :
                    newWalletType === 'solana' ? 'bg-purple-500/20 border-purple-500/30' :
                    'bg-indigo-500/20 border-indigo-500/30'
                  } border flex items-center justify-center`}>
                    <span className="text-2xl">{newWalletType === 'evm' ? '⟠' : newWalletType === 'solana' ? '◎' : '⚛'}</span>
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold bg-gradient-to-r ${
                      newWalletType === 'evm' ? 'from-pink-400 to-orange-400' :
                      newWalletType === 'solana' ? 'from-purple-400 to-pink-400' :
                      'from-indigo-400 to-violet-400'
                    } bg-clip-text text-transparent`}>
                      Create {newWalletType === 'evm' ? 'EVM' : newWalletType === 'solana' ? 'Solana' : 'Cosmos'} Sponsor Wallet
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {newWalletType === 'evm' ? 'Multi-Chain • One wallet for all EVM networks' :
                       newWalletType === 'solana' ? 'Solana Mainnet & Devnet' :
                       'Cosmos Hub & IBC Networks'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCreateWalletModal(false);
                    setNewWalletName('');
                    setNewWalletIsPublic(false);
                    setNewWalletType('evm');
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
                {/* Wallet Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Wallet Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* EVM - Available */}
                    <button
                      onClick={() => setNewWalletType('evm')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        newWalletType === 'evm'
                          ? 'border-blue-500 bg-pink-500/10'
                          : 'border-slate-600 bg-slate-900/50 hover:border-pink-500/50'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">⟠</span>
                        <div className="text-center">
                          <p className={`font-medium text-sm ${newWalletType === 'evm' ? 'text-blue-400' : 'text-gray-300'}`}>EVM</p>
                          <p className="text-xs text-gray-500">Multi-Chain</p>
                        </div>
                      </div>
                    </button>
                    {/* Solana - Coming Soon */}
                    <div className="relative">
                      <div className="p-4 rounded-xl border-2 border-slate-700 bg-slate-900/30 opacity-50 cursor-not-allowed">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl">◎</span>
                          <div className="text-center">
                            <p className="font-medium text-sm text-gray-500">Solana</p>
                            <p className="text-xs text-gray-600">SOL Network</p>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-[10px] font-medium text-white shadow-lg">
                        Soon
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Solana wallet pregeneration coming soon
                  </p>
                </div>

                {/* Wallet Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Wallet Name / Tag
                  </label>
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="e.g., Production API, Testing, Marketing"
                    className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors"
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Give your wallet a name to easily identify its purpose
                  </p>
                </div>

                {/* Public/Private Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-gray-300">Make Wallet Public</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Public wallets appear in the community directory
                    </p>
                  </div>
                  <button
                    onClick={() => setNewWalletIsPublic(!newWalletIsPublic)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      newWalletIsPublic ? 'bg-green-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        newWalletIsPublic ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Info Box - Dynamic based on wallet type */}
                {newWalletType === 'evm' && (
                  <div className="p-4 bg-pink-500/10 border-pink-500/20 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">⟠</span>
                      <div className="text-sm text-gray-300">
                        <p className="font-medium mb-1 text-blue-400">EVM Multi-Chain Wallet</p>
                        <p className="text-gray-400">
                          One address works across all EVM networks: Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism, Celo, Monad, Unichain & testnets.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {newWalletType === 'solana' && (
                  <div className="p-4 bg-purple-500/10 border-purple-500/20 border rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">◎</span>
                      <div className="text-sm text-gray-300">
                        <p className="font-medium mb-1 text-purple-400">Solana Wallet</p>
                        <p className="text-gray-400">
                          Native Solana wallet for SPL tokens and Solana programs. Works on Mainnet-beta and Devnet.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create Button */}
                <button
                  onClick={() => createWallet(newWalletType, newWalletName, newWalletIsPublic)}
                  disabled={creatingWallet}
                  className={`w-full bg-gradient-to-r ${
                    newWalletType === 'solana'
                      ? 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                      : 'from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600'
                  } disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center`}
                >
                  {creatingWallet ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Wallet...
                    </>
                  ) : (
                    <>
                      <span className="mr-2 text-lg">{newWalletType === 'solana' ? '◎' : '⟠'}</span>
                      Create {newWalletType === 'solana' ? 'Solana' : 'EVM'} Wallet
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-red-500/30 rounded-xl max-w-sm w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Delete Wallet</h3>
                    <p className="text-sm text-gray-400">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-gray-300 mb-6">
                  Are you sure you want to delete this wallet? You will lose access to it permanently.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={deletingWallet}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => showDeleteConfirm && deleteWallet(showDeleteConfirm)}
                    disabled={deletingWallet}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {deletingWallet ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Delete Wallet'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configure Rules Modal */}
        {showRulesModal && selectedWallet && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-pink-500/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-800 border-b border-pink-500/20 p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                    Configure Sponsorship Rules
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Wallet: <code className="text-pink-400 font-semibold font-mono">{selectedWallet.sponsor_address.slice(0, 6)}...{selectedWallet.sponsor_address.slice(-5)}</code>
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 border-b border-pink-500/20 pb-4">
                  <button
                    onClick={() => setActiveTab('agent')}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                      activeTab === 'agent'
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                        ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
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
                    <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="bg-pink-500/20 rounded-full p-2 flex-shrink-0">
                          <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-pink-400 mb-1">Agent Whitelist</h3>
                          <p className="text-sm text-gray-300">
                            Control which agent wallet addresses can use your sponsor wallet for gas fees.
                          </p>
                        </div>
                      </div>
                    </div>

                {/* Add Agent Form */}
                <div className="bg-slate-900/50 border border-pink-500/20 rounded-lg p-4">
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
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-pink-400 transition-colors font-mono text-sm"
                    />
                    <button
                      onClick={addAgentRule}
                      disabled={addingRule || !newAgentAddress.trim()}
                      className="bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition-all"
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
                <div className="bg-slate-900/50 border border-pink-500/30 rounded-lg p-6">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="bg-pink-500/20 rounded-full p-2 flex-shrink-0">
                      <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-pink-400 mb-1">Vendor Domain Whitelist</h3>
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
                        className="flex-1 bg-slate-800/50 border border-pink-500/30 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-pink-400 transition-colors"
                        onKeyPress={(e) => e.key === 'Enter' && addDomainRule()}
                      />
                      <button
                        onClick={addDomainRule}
                        disabled={addingRule || !newDomain.trim()}
                        className="bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center space-x-2"
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
                <div className="bg-slate-900/50 border border-pink-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-pink-400">Whitelisted Domains</h3>
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
                          <div key={rule.id} className="bg-slate-800/50 border border-pink-500/20 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-mono text-pink-400 text-sm">{rule.domain}</p>
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
                              <span className="font-mono text-pink-400">10 USDC/day</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Monthly Limit</span>
                              <span className="font-mono text-pink-400">300 USDC/month</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Per Transaction</span>
                              <span className="font-mono text-pink-400">5 USDC/tx</span>
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
                              <span className="font-mono text-pink-400">9:00 AM - 5:00 PM</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Active Days</span>
                              <span className="font-mono text-pink-400">Mon-Fri</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Timezone</span>
                              <span className="font-mono text-pink-400">UTC</span>
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
                              <div className="w-2 h-2 rounded-full bg-pink-400"></div>
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
                              <svg className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Low balance warnings</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Spending limit alerts</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Suspicious activity detection</span>
                            </div>
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="sticky bottom-0 bg-slate-800 border-t border-pink-500/20 p-6">
                <button
                  onClick={() => {
                    setShowRulesModal(false);
                    setSelectedWallet(null);
                  }}
                  className="w-full bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 text-white font-medium py-3 px-6 rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Modal - Using new component */}
        <SponsorAnalyticsModal
          isOpen={showAnalyticsModal}
          onClose={() => {
            setShowAnalyticsModal(false);
            setSelectedWallet(null);
            setTransactions([]);
            setSummary(null);
          }}
          wallet={selectedWallet}
        />

        <Footer />
      </div>
    </div>
  );
}
