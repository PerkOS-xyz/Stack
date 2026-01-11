"use client";

import { useState, useEffect } from "react";

export const dynamic = "force-dynamic";
import { useWallet } from "@getpara/react-sdk";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AddressDisplay } from "@/components/AddressDisplay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Address } from "@/lib/types/x402";

interface AdminStats {
  users: number;
  wallets: number;
  agents: number;
  vendors: number;
  endpoints: number;
  transactions: number;
  totalVolumeUsd: string;
}

interface User {
  id: string;
  wallet_address: string;
  account_type: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

interface Agent {
  id: string;
  wallet_address: string;
  agent_type: string;
  display_name: string | null;
  total_transactions: number;
  total_volume_usd: number;
  primary_network: string | null;
  last_active_at: string;
}

interface Vendor {
  id: string;
  name: string;
  url: string;
  wallet_address: string;
  network: string;
  status: string;
  category: string;
  total_transactions: number;
  total_volume: string;
  created_at: string;
  endpoints: VendorEndpoint[];
}

interface VendorEndpoint {
  id: string;
  path: string;
  method: string;
  price_usd: string;
  is_active: boolean;
}

interface Transaction {
  id: string;
  transaction_hash: string;
  payer_address: string;
  recipient_address: string;
  amount_usd: number;
  network: string;
  scheme: string;
  status: string;
  created_at: string;
}

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  wallet_name: string | null;
  sponsor_address: string;
  network: string;
  balance: string;
  is_public: boolean;
  created_at: string;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  assigned_wallet: string | null;
  max_redemptions: number;
  current_redemptions: number;
  applicable_tiers: string[] | null;
  min_amount: number;
  starts_at: string;
  expires_at: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CouponFormData {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  assigned_wallet: string;
  max_redemptions: number;
  applicable_tiers: string[];
  min_amount: number;
  starts_at: string;
  expires_at: string;
  enabled: boolean;
}

type TabType = "overview" | "users" | "agents" | "vendors" | "transactions" | "wallets" | "coupons";

export default function AdminPage() {
  const { data: wallet } = useWallet();
  const address = wallet?.address;

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Data for each tab
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<SponsorWallet[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Pagination
  const [usersPage, setUsersPage] = useState(0);
  const [agentsPage, setAgentsPage] = useState(0);
  const [vendorsPage, setVendorsPage] = useState(0);
  const [transactionsPage, setTransactionsPage] = useState(0);
  const [walletsPage, setWalletsPage] = useState(0);
  const [couponsPage, setCouponsPage] = useState(0);

  // Vendor delete state
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; name: string } | null>(null);

  // Cleanup state
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ success: boolean; message: string } | null>(null);

  const [usersTotalPages, setUsersTotalPages] = useState(0);
  const [agentsTotalPages, setAgentsTotalPages] = useState(0);
  const [vendorsTotalPages, setVendorsTotalPages] = useState(0);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(0);
  const [walletsTotalPages, setWalletsTotalPages] = useState(0);
  const [couponsTotalPages, setCouponsTotalPages] = useState(0);

  // Coupon management state
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponFormData, setCouponFormData] = useState<CouponFormData>({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    assigned_wallet: "",
    max_redemptions: 1,
    applicable_tiers: [],
    min_amount: 0,
    starts_at: new Date().toISOString().split("T")[0],
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    enabled: true,
  });

  // User search for coupon assignment
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Coupon code copy state
  const [copiedCouponId, setCopiedCouponId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    async function checkAdmin() {
      if (!address) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/admin/verify?address=${address}`);
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, [address]);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      if (!address || !isAdmin) return;

      try {
        const response = await fetch(`/api/admin/stats?address=${address}`);
        const data = await response.json();
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }

    if (isAdmin) {
      fetchStats();
    }
  }, [address, isAdmin]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!address || !isAdmin) return;

    const fetchData = async () => {
      try {
        switch (activeTab) {
          case "users":
            const usersRes = await fetch(`/api/admin/users?address=${address}&page=${usersPage}`);
            const usersData = await usersRes.json();
            setUsers(usersData.users || []);
            setUsersTotalPages(usersData.totalPages || 0);
            break;

          case "agents":
            const agentsRes = await fetch(`/api/admin/agents?address=${address}&page=${agentsPage}`);
            const agentsData = await agentsRes.json();
            setAgents(agentsData.agents || []);
            setAgentsTotalPages(agentsData.totalPages || 0);
            break;

          case "vendors":
            const vendorsRes = await fetch(`/api/admin/vendors?address=${address}&page=${vendorsPage}`);
            const vendorsData = await vendorsRes.json();
            setVendors(vendorsData.vendors || []);
            setVendorsTotalPages(vendorsData.totalPages || 0);
            break;

          case "transactions":
            const txRes = await fetch(`/api/admin/transactions?address=${address}&page=${transactionsPage}`);
            const txData = await txRes.json();
            setTransactions(txData.transactions || []);
            setTransactionsTotalPages(txData.totalPages || 0);
            break;

          case "wallets":
            const walletsRes = await fetch(`/api/admin/wallets?address=${address}&page=${walletsPage}`);
            const walletsData = await walletsRes.json();
            setWallets(walletsData.wallets || []);
            setWalletsTotalPages(walletsData.totalPages || 0);
            break;

          case "coupons":
            const couponsRes = await fetch(`/api/admin/coupons?address=${address}&page=${couponsPage}`);
            const couponsData = await couponsRes.json();
            setCoupons(couponsData.coupons || []);
            setCouponsTotalPages(couponsData.totalPages || 0);
            break;
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [address, isAdmin, activeTab, usersPage, agentsPage, vendorsPage, transactionsPage, walletsPage, couponsPage]);

  // Open delete confirmation dialog
  const handleDeleteVendor = (vendorId: string, vendorName: string) => {
    setVendorToDelete({ id: vendorId, name: vendorName });
  };

  // Execute vendor deletion
  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return;

    setDeletingVendorId(vendorToDelete.id);
    try {
      const response = await fetch(`/api/vendors/${vendorToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        // Remove vendor from local state
        setVendors((prev) => prev.filter((v) => v.id !== vendorToDelete.id));
        // Update stats
        if (stats) {
          setStats({ ...stats, vendors: stats.vendors - 1 });
        }
        setVendorToDelete(null);
      } else {
        alert(`Failed to delete vendor: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      alert("Failed to delete vendor. Please try again.");
    } finally {
      setDeletingVendorId(null);
    }
  };

  // Coupon form handlers
  const resetCouponForm = () => {
    setCouponFormData({
      code: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      assigned_wallet: "",
      max_redemptions: 1,
      applicable_tiers: [],
      min_amount: 0,
      starts_at: new Date().toISOString().split("T")[0],
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      enabled: true,
    });
    setEditingCoupon(null);
    setCouponError(null);
    setUserSearchQuery("");
    setUserSearchResults([]);
    setShowUserSearch(false);
  };

  const handleCreateCoupon = () => {
    resetCouponForm();
    setShowCouponForm(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponFormData({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      assigned_wallet: coupon.assigned_wallet || "",
      max_redemptions: coupon.max_redemptions,
      applicable_tiers: coupon.applicable_tiers || [],
      min_amount: coupon.min_amount,
      starts_at: coupon.starts_at.split("T")[0],
      expires_at: coupon.expires_at.split("T")[0],
      enabled: coupon.enabled,
    });
    setShowCouponForm(true);
  };

  const handleSaveCoupon = async () => {
    if (!address) return;
    setSavingCoupon(true);
    setCouponError(null);

    try {
      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : "/api/admin/coupons";

      const method = editingCoupon ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          ...couponFormData,
          assigned_wallet: couponFormData.assigned_wallet || null,
          applicable_tiers: couponFormData.applicable_tiers.length > 0 ? couponFormData.applicable_tiers : null,
          starts_at: new Date(couponFormData.starts_at).toISOString(),
          expires_at: new Date(couponFormData.expires_at).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save coupon");
      }

      // Refresh coupons list
      const couponsRes = await fetch(`/api/admin/coupons?address=${address}&page=${couponsPage}`);
      const couponsData = await couponsRes.json();
      setCoupons(couponsData.coupons || []);
      setCouponsTotalPages(couponsData.totalPages || 0);

      setShowCouponForm(false);
      resetCouponForm();
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "Failed to save coupon");
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!address || !confirm("Are you sure you want to delete this coupon?")) return;

    try {
      const response = await fetch(`/api/admin/coupons/${couponId}?address=${address}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete coupon");
        return;
      }

      if (data.disabled) {
        alert(data.message);
      }

      // Refresh coupons list
      const couponsRes = await fetch(`/api/admin/coupons?address=${address}&page=${couponsPage}`);
      const couponsData = await couponsRes.json();
      setCoupons(couponsData.coupons || []);
      setCouponsTotalPages(couponsData.totalPages || 0);
    } catch (error) {
      alert("Failed to delete coupon");
    }
  };

  const handleToggleCouponEnabled = async (coupon: Coupon) => {
    if (!address) return;

    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          enabled: !coupon.enabled,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update coupon");
        return;
      }

      // Refresh coupons list
      const couponsRes = await fetch(`/api/admin/coupons?address=${address}&page=${couponsPage}`);
      const couponsData = await couponsRes.json();
      setCoupons(couponsData.coupons || []);
    } catch (error) {
      alert("Failed to update coupon");
    }
  };

  // User search for coupon assignment
  const handleUserSearch = async (query: string) => {
    setUserSearchQuery(query);
    if (!query || query.length < 2 || !address) {
      setUserSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/admin/users?address=${address}&limit=10`);
      const data = await response.json();
      // Filter users by query (matching wallet or display_name)
      const filtered = (data.users || []).filter((user: User) =>
        user.wallet_address.toLowerCase().includes(query.toLowerCase()) ||
        (user.display_name && user.display_name.toLowerCase().includes(query.toLowerCase()))
      );
      setUserSearchResults(filtered);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const selectUserForCoupon = (user: User) => {
    setCouponFormData({ ...couponFormData, assigned_wallet: user.wallet_address });
    setUserSearchQuery(user.display_name || user.wallet_address);
    setShowUserSearch(false);
  };

  // Copy coupon code to clipboard
  const handleCopyCouponCode = async (couponId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCouponId(couponId);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedCouponId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy coupon code:", err);
    }
  };

  // Execute orphaned data cleanup
  const handleCleanupOrphans = async () => {
    if (!address) return;

    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      const response = await fetch(`/api/admin/cleanup?address=${address}`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setCleanupResult({
          success: true,
          message: `Cleaned up ${data.deletedCount} orphaned endpoints`,
        });
        // Refresh stats
        const statsResponse = await fetch(`/api/admin/stats?address=${address}`);
        const statsData = await statsResponse.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } else {
        setCleanupResult({
          success: false,
          message: data.error || "Cleanup failed",
        });
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      setCleanupResult({
        success: false,
        message: "Cleanup failed. Please try again.",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden flex flex-col">
        {/* === ATMOSPHERIC BACKGROUND === */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-amber-950/10" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        </div>
        <div className="relative flex flex-col flex-1">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Verifying admin access...</p>
          </div>
        </main>
        <Footer />
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden flex flex-col">
        {/* === ATMOSPHERIC BACKGROUND === */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-amber-950/10" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        </div>
        <div className="relative flex flex-col flex-1">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-gray-200 mb-2">Admin Access Required</h1>
            <p className="text-gray-400">Please connect your wallet to access the admin panel.</p>
          </div>
        </main>
        <Footer />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden flex flex-col">
        {/* === ATMOSPHERIC BACKGROUND === */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-amber-950/10" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
        </div>
        <div className="relative flex flex-col flex-1">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-gray-400">Your wallet is not authorized to access the admin panel.</p>
            <p className="text-gray-500 text-sm mt-4 font-mono">{address}</p>
          </div>
        </main>
        <Footer />
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "users", label: "Users", icon: "👤" },
    { id: "agents", label: "Agents", icon: "🤖" },
    { id: "vendors", label: "Vendors", icon: "🏪" },
    { id: "transactions", label: "Transactions", icon: "💸" },
    { id: "wallets", label: "Sponsor Wallets", icon: "💰" },
    { id: "coupons", label: "Coupons", icon: "🎟️" },
  ];

  return (
    <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden flex flex-col">
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-amber-950/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative flex flex-col flex-1">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Admin Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🛡️</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
          <p className="text-gray-400">Global overview of the PerkOS Stack platform</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-blue-500/20 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-blue-500/20 text-cyan-400 border border-blue-500/40"
                  : "text-gray-400 hover:text-gray-200 hover:bg-slate-800/50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <StatCard title="Users" value={stats.users} icon="👤" color="blue" />
              <StatCard title="Wallets" value={stats.wallets} icon="💰" color="green" />
              <StatCard title="Agents" value={stats.agents} icon="🤖" color="purple" />
              <StatCard title="Vendors" value={stats.vendors} icon="🏪" color="orange" />
              <StatCard title="Endpoints" value={stats.endpoints} icon="🔗" color="cyan" />
              <StatCard title="Transactions" value={stats.transactions} icon="💸" color="pink" />
              <StatCard
                title="Volume (USD)"
                value={`$${parseFloat(stats.totalVolumeUsd).toLocaleString()}`}
                icon="📈"
                color="yellow"
                isString
              />
            </div>

            {/* Admin Actions */}
            <div className="mt-6 p-4 bg-slate-900/50 border border-blue-500/20 rounded-xl">
              <h3 className="text-lg font-bold text-gray-200 mb-4">Admin Actions</h3>
              <div className="flex flex-wrap gap-4 items-center">
                <button
                  onClick={handleCleanupOrphans}
                  disabled={isCleaningUp}
                  className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:text-orange-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-orange-500/30 flex items-center gap-2"
                >
                  {isCleaningUp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      🧹 Cleanup Orphaned Data
                    </>
                  )}
                </button>
                {cleanupResult && (
                  <span
                    className={`text-sm ${
                      cleanupResult.success ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {cleanupResult.message}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Removes orphaned endpoints that are no longer associated with any vendor.
              </p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">All Users ({users.length})</h2>
            <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Wallet</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Name</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Type</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Verified</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-blue-500/10 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <AddressDisplay address={user.wallet_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3 text-gray-300">{user.display_name || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                          {user.account_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.is_verified ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={usersPage} totalPages={usersTotalPages} onPageChange={setUsersPage} />
          </div>
        )}

        {activeTab === "agents" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">All Agents ({agents.length})</h2>
            <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Wallet</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Type</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Transactions</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Volume (USD)</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Network</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-t border-blue-500/10 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <AddressDisplay address={agent.wallet_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            agent.agent_type === "provider"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {agent.agent_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{agent.total_transactions}</td>
                      <td className="px-4 py-3 text-gray-300">
                        ${(agent.total_volume_usd || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{agent.primary_network || "-"}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(agent.last_active_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No agents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={agentsPage} totalPages={agentsTotalPages} onPageChange={setAgentsPage} />
          </div>
        )}

        {activeTab === "vendors" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">All Vendors ({vendors.length})</h2>
            <div className="grid gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-slate-900/50 border border-blue-500/20 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-200">{vendor.name}</h3>
                      <p className="text-sm text-gray-400">{vendor.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          vendor.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {vendor.status}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                        {vendor.category}
                      </span>
                      <button
                        onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                        disabled={deletingVendorId === vendor.id}
                        className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
                      >
                        {deletingVendorId === vendor.id ? "Deleting..." : "🗑️ Delete"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Wallet</p>
                      <AddressDisplay address={vendor.wallet_address as Address} skipEns />
                    </div>
                    <div>
                      <p className="text-gray-500">Network</p>
                      <p className="text-gray-300">{vendor.network}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Transactions</p>
                      <p className="text-gray-300">{vendor.total_transactions}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Volume</p>
                      <p className="text-gray-300">${vendor.total_volume}</p>
                    </div>
                  </div>
                  {vendor.endpoints && vendor.endpoints.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-500/10">
                      <p className="text-sm text-gray-500 mb-2">
                        Endpoints ({vendor.endpoints.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {vendor.endpoints.map((ep) => (
                          <span
                            key={ep.id}
                            className={`px-2 py-1 text-xs rounded-lg ${
                              ep.is_active
                                ? "bg-slate-700 text-gray-300"
                                : "bg-slate-800 text-gray-500"
                            }`}
                          >
                            {ep.method} {ep.path} - ${ep.price_usd}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {vendors.length === 0 && (
                <div className="text-center py-8 text-gray-500">No vendors found</div>
              )}
            </div>
            <Pagination page={vendorsPage} totalPages={vendorsTotalPages} onPageChange={setVendorsPage} />
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">All Transactions ({transactions.length})</h2>
            <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Hash</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Payer</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Recipient</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Amount</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Network</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Scheme</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Status</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-blue-500/10 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-400">
                          {tx.transaction_hash.slice(0, 10)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={tx.payer_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={tx.recipient_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        ${(tx.amount_usd || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{tx.network}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400">
                          {tx.scheme}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            tx.status === "success"
                              ? "bg-green-500/20 text-green-400"
                              : tx.status === "failed"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={transactionsPage}
              totalPages={transactionsTotalPages}
              onPageChange={setTransactionsPage}
            />
          </div>
        )}

        {activeTab === "wallets" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-200">All Sponsor Wallets ({wallets.length})</h2>
            <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Name</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Owner</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Sponsor Address</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Balance</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Public</th>
                    <th className="text-left text-gray-400 text-sm px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.id} className="border-t border-blue-500/10 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-gray-300">{wallet.wallet_name || "Unnamed"}</td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={wallet.user_wallet_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={wallet.sponsor_address as Address} skipEns />
                      </td>
                      <td className="px-4 py-3 text-gray-300">{wallet.balance}</td>
                      <td className="px-4 py-3">
                        {wallet.is_public ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {new Date(wallet.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {wallets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No sponsor wallets found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={walletsPage} totalPages={walletsTotalPages} onPageChange={setWalletsPage} />
          </div>
        )}

        {activeTab === "coupons" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-200">All Coupons ({coupons.length})</h2>
              <button
                onClick={handleCreateCoupon}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all flex items-center gap-2"
              >
                + Create Coupon
              </button>
            </div>

            <div className="grid gap-4">
              {coupons.map((coupon) => {
                const isExpired = new Date(coupon.expires_at) < new Date();
                const isNotStarted = new Date(coupon.starts_at) > new Date();
                const isAtLimit = coupon.max_redemptions !== -1 && coupon.current_redemptions >= coupon.max_redemptions;

                return (
                  <div
                    key={coupon.id}
                    className={`bg-slate-900/50 border rounded-xl p-4 ${
                      !coupon.enabled ? "border-gray-600/30 opacity-60" : "border-blue-500/20"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-cyan-400 font-mono">{coupon.code}</span>
                          <button
                            onClick={() => handleCopyCouponCode(coupon.id, coupon.code)}
                            className="p-1 rounded hover:bg-slate-700/50 transition-all group"
                            title="Copy coupon code"
                          >
                            {copiedCouponId === coupon.id ? (
                              <span className="text-green-400 text-sm">✓</span>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-gray-400 group-hover:text-cyan-400 transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                          </button>
                          {coupon.assigned_wallet && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                              User-Specific
                            </span>
                          )}
                          {!coupon.assigned_wallet && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
                              Open
                            </span>
                          )}
                        </div>
                        {coupon.description && (
                          <p className="text-sm text-gray-400">{coupon.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!coupon.enabled && (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">Disabled</span>
                        )}
                        {coupon.enabled && isExpired && (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Expired</span>
                        )}
                        {coupon.enabled && isNotStarted && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Not Started</span>
                        )}
                        {coupon.enabled && !isExpired && !isNotStarted && isAtLimit && (
                          <span className="px-2 py-1 text-xs rounded-full bg-orange-500/20 text-orange-400">At Limit</span>
                        )}
                        {coupon.enabled && !isExpired && !isNotStarted && !isAtLimit && (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Active</span>
                        )}
                        <button
                          onClick={() => handleToggleCouponEnabled(coupon)}
                          className={`px-3 py-1 text-xs rounded-lg transition-all border ${
                            coupon.enabled
                              ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30"
                              : "bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30"
                          }`}
                        >
                          {coupon.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleEditCoupon(coupon)}
                          className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Discount</p>
                        <p className="text-gray-300 font-semibold">
                          {coupon.discount_type === "percentage"
                            ? `${coupon.discount_value}%`
                            : `$${coupon.discount_value.toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Usage</p>
                        <p className="text-gray-300">
                          {coupon.current_redemptions} / {coupon.max_redemptions === -1 ? "∞" : coupon.max_redemptions}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Start Date</p>
                        <p className="text-gray-300">{new Date(coupon.starts_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expires</p>
                        <p className="text-gray-300">{new Date(coupon.expires_at).toLocaleDateString()}</p>
                      </div>
                      {coupon.applicable_tiers && coupon.applicable_tiers.length > 0 && (
                        <div>
                          <p className="text-gray-500">Tiers</p>
                          <p className="text-gray-300">{coupon.applicable_tiers.join(", ")}</p>
                        </div>
                      )}
                      {coupon.assigned_wallet && (
                        <div>
                          <p className="text-gray-500">Assigned To</p>
                          <AddressDisplay address={coupon.assigned_wallet as Address} skipEns />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {coupons.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No coupons found. Create your first coupon to get started.
                </div>
              )}
            </div>
            <Pagination page={couponsPage} totalPages={couponsTotalPages} onPageChange={setCouponsPage} />
          </div>
        )}

        {/* Coupon Form Modal */}
        {showCouponForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-blue-500/20 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-200">
                    {editingCoupon ? "Edit Coupon" : "Create Coupon"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCouponForm(false);
                      resetCouponForm();
                    }}
                    className="text-gray-400 hover:text-gray-200 text-2xl"
                  >
                    &times;
                  </button>
                </div>

                {couponError && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {couponError}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Code */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Coupon Code *</label>
                    <input
                      type="text"
                      value={couponFormData.code}
                      onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., WINTER2026"
                      className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                      value={couponFormData.description}
                      onChange={(e) => setCouponFormData({ ...couponFormData, description: e.target.value })}
                      placeholder="Internal notes about this coupon"
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Discount Type & Value */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Discount Type *</label>
                      <select
                        value={couponFormData.discount_type}
                        onChange={(e) => setCouponFormData({ ...couponFormData, discount_type: e.target.value as "percentage" | "fixed" })}
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Discount Value * {couponFormData.discount_type === "percentage" ? "(1-100)" : "(USD)"}
                      </label>
                      <input
                        type="number"
                        value={couponFormData.discount_value}
                        onChange={(e) => setCouponFormData({ ...couponFormData, discount_value: parseFloat(e.target.value) || 0 })}
                        min={couponFormData.discount_type === "percentage" ? 1 : 0.01}
                        max={couponFormData.discount_type === "percentage" ? 100 : undefined}
                        step={couponFormData.discount_type === "percentage" ? 1 : 0.01}
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>

                  {/* User Assignment */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Assign to User (optional - leave empty for open coupon)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={userSearchQuery || couponFormData.assigned_wallet}
                        onChange={(e) => {
                          handleUserSearch(e.target.value);
                          setShowUserSearch(true);
                        }}
                        onFocus={() => setShowUserSearch(true)}
                        placeholder="Search by name or wallet address..."
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      />
                      {couponFormData.assigned_wallet && (
                        <button
                          onClick={() => {
                            setCouponFormData({ ...couponFormData, assigned_wallet: "" });
                            setUserSearchQuery("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                        >
                          &times;
                        </button>
                      )}
                      {showUserSearch && userSearchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-blue-500/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {userSearchResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => selectUserForCoupon(user)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
                            >
                              <span className="text-gray-200">{user.display_name || "Unnamed"}</span>
                              <span className="text-gray-500 text-xs font-mono">
                                {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Max Redemptions */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Max Redemptions (-1 for unlimited)
                    </label>
                    <input
                      type="number"
                      value={couponFormData.max_redemptions}
                      onChange={(e) => setCouponFormData({ ...couponFormData, max_redemptions: parseInt(e.target.value) || 1 })}
                      min={-1}
                      className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Applicable Tiers */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Applicable Tiers (leave empty for all)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["starter", "pro", "enterprise"].map((tier) => (
                        <label key={tier} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={couponFormData.applicable_tiers.includes(tier)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCouponFormData({
                                  ...couponFormData,
                                  applicable_tiers: [...couponFormData.applicable_tiers, tier],
                                });
                              } else {
                                setCouponFormData({
                                  ...couponFormData,
                                  applicable_tiers: couponFormData.applicable_tiers.filter((t) => t !== tier),
                                });
                              }
                            }}
                            className="rounded border-blue-500/30"
                          />
                          <span className="text-gray-300 capitalize">{tier}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Min Amount (for fixed discounts) */}
                  {couponFormData.discount_type === "fixed" && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Minimum Purchase Amount (USD)
                      </label>
                      <input
                        type="number"
                        value={couponFormData.min_amount}
                        onChange={(e) => setCouponFormData({ ...couponFormData, min_amount: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={0.01}
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={couponFormData.starts_at}
                        onChange={(e) => setCouponFormData({ ...couponFormData, starts_at: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Expiration Date *</label>
                      <input
                        type="date"
                        value={couponFormData.expires_at}
                        onChange={(e) => setCouponFormData({ ...couponFormData, expires_at: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-blue-500/20 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  </div>

                  {/* Enabled */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={couponFormData.enabled}
                        onChange={(e) => setCouponFormData({ ...couponFormData, enabled: e.target.checked })}
                        className="rounded border-blue-500/30"
                      />
                      <span className="text-gray-300">Enable coupon immediately</span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-blue-500/10">
                  <button
                    onClick={() => {
                      setShowCouponForm(false);
                      resetCouponForm();
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-gray-400 hover:text-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCoupon}
                    disabled={savingCoupon || !couponFormData.code}
                    className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingCoupon ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>{editingCoupon ? "Update Coupon" : "Create Coupon"}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
      </div>

      {/* Delete Vendor Confirmation Dialog */}
      <ConfirmDialog
        isOpen={vendorToDelete !== null}
        onClose={() => setVendorToDelete(null)}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${vendorToDelete?.name}"?\n\nThis will also delete all associated endpoints and cannot be undone.`}
        confirmText="Delete Vendor"
        cancelText="Cancel"
        variant="danger"
        isLoading={deletingVendorId !== null}
      />
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  color,
  isString = false,
}: {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  isString?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    green: "from-green-500/20 to-green-600/10 border-green-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    orange: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    pink: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
    yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4 text-center`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-200">
        {isString ? value : (value as number).toLocaleString()}
      </p>
      <p className="text-sm text-gray-400">{title}</p>
    </div>
  );
}

// Pagination Component
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-1 rounded-lg bg-slate-800 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      <span className="px-3 py-1 text-gray-400">
        Page {page + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-1 rounded-lg bg-slate-800 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}
