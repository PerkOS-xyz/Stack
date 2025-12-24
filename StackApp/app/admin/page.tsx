"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AddressDisplay } from "@/components/AddressDisplay";

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

type TabType = "overview" | "users" | "agents" | "vendors" | "transactions" | "wallets";

export default function AdminPage() {
  const account = useActiveAccount();
  const address = account?.address;

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

  // Pagination
  const [usersPage, setUsersPage] = useState(0);
  const [agentsPage, setAgentsPage] = useState(0);
  const [vendorsPage, setVendorsPage] = useState(0);
  const [transactionsPage, setTransactionsPage] = useState(0);
  const [walletsPage, setWalletsPage] = useState(0);

  const [usersTotalPages, setUsersTotalPages] = useState(0);
  const [agentsTotalPages, setAgentsTotalPages] = useState(0);
  const [vendorsTotalPages, setVendorsTotalPages] = useState(0);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(0);
  const [walletsTotalPages, setWalletsTotalPages] = useState(0);

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
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [address, isAdmin, activeTab, usersPage, agentsPage, vendorsPage, transactionsPage, walletsPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Verifying admin access...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
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
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
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
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "users", label: "Users", icon: "👤" },
    { id: "agents", label: "Agents", icon: "🤖" },
    { id: "vendors", label: "Vendors", icon: "🏪" },
    { id: "transactions", label: "Transactions", icon: "💸" },
    { id: "wallets", label: "Sponsor Wallets", icon: "💰" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
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
                        <AddressDisplay address={user.wallet_address} skipEns />
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
                        <AddressDisplay address={agent.wallet_address} skipEns />
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
                    <div className="flex gap-2">
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
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Wallet</p>
                      <AddressDisplay address={vendor.wallet_address} skipEns />
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
                        <AddressDisplay address={tx.payer_address} skipEns />
                      </td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={tx.recipient_address} skipEns />
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
                        <AddressDisplay address={wallet.user_wallet_address} skipEns />
                      </td>
                      <td className="px-4 py-3">
                        <AddressDisplay address={wallet.sponsor_address} skipEns />
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
      </main>
      <Footer />
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
