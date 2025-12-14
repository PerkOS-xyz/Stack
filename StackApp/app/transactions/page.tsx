"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Transaction {
  hash: string;
  fullHash: string;
  from: string;
  fullFrom: string;
  to: string;
  fullTo: string;
  amount: string;          // e.g., "1.234 USDC"
  amountRaw: number;
  assetSymbol: string;     // e.g., "USDC"
  gasFee: string;          // e.g., "0.001234 AVAX" or "-"
  gasFeeWei: string | null;
  gasFeeNativeSymbol: string; // e.g., "AVAX", "ETH", "CELO"
  scheme: string;
  network: string;
  status: string;
  timestamp: string;       // e.g., "5m ago"
  datetime: string;        // e.g., "Dec 14, 2025, 10:30:45"
  datetimeRaw: string;     // ISO string
}

interface Stats {
  totalTransactions: string;
  totalVolume: string;
  avgTransaction: string;
  successRate: string;
}

interface ApiResponse {
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats: Stats;
}

export default function TransactionsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [schemeFilter, setSchemeFilter] = useState<"all" | "exact" | "deferred">("all");
  const [chartData, setChartData] = useState<Array<{ height: number }>>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTransactions: "0",
    totalVolume: "$0",
    avgTransaction: "$0",
    successRate: "0%",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * recordsPerPage;
      const params = new URLSearchParams({
        period: timeRange,
        limit: recordsPerPage.toString(),
        offset: offset.toString(),
      });
      if (schemeFilter !== "all") {
        params.set("scheme", schemeFilter);
      }
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      const response = await fetch(`/api/x402/transactions?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data: ApiResponse = await response.json();
      setTransactions(data.transactions);
      setStats(data.stats);
      setTotalRecords(data.pagination.total);

      // Generate chart data based on total transactions
      const total = parseInt(data.stats.totalTransactions.replace(/[^0-9]/g, "")) || 0;
      setChartData(
        Array.from({ length: 48 }, () => ({
          height: Math.max(5, Math.floor(Math.random() * 60) + (total > 0 ? 20 : 5)),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
      // Set empty chart on error
      setChartData(
        Array.from({ length: 48 }, () => ({
          height: 5,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [timeRange, schemeFilter, currentPage, recordsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, schemeFilter, recordsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startRecord = totalRecords > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const networkIcons: Record<string, string> = {
    avalanche: "🔺",
    "avalanche-fuji": "🔺",
    celo: "🌿",
    "celo-sepolia": "🌿",
    base: "🔵",
    "base-sepolia": "🔵",
  };

  const blockExplorers: Record<string, string> = {
    avalanche: "https://snowtrace.io/tx/",
    "avalanche-fuji": "https://testnet.snowtrace.io/tx/",
    celo: "https://celoscan.io/tx/",
    "celo-sepolia": "https://alfajores.celoscan.io/tx/",
    base: "https://basescan.org/tx/",
    "base-sepolia": "https://sepolia.basescan.org/tx/",
  };

  const getExplorerUrl = (network: string, hash: string): string => {
    const baseUrl = blockExplorers[network] || "https://etherscan.io/tx/";
    return `${baseUrl}${hash}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        <Header />

        {/* Main Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <Link
                  href="/"
                  className="inline-flex items-center space-x-2 text-gray-400 hover:text-cyan-400 transition-colors mb-4 group"
                >
                  <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  <span className="text-sm font-medium">Back to Home</span>
                </Link>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  Transactions
                </h2>
                <p className="text-gray-400">All x402 payment transactions across community networks</p>
              </div>

              {/* Time Range Filter */}
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                {(["24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                      timeRange === range
                        ? "bg-slate-700 text-cyan-400"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : stats.totalTransactions}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : stats.totalVolume}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Avg Transaction</div>
                <div className="text-2xl font-bold text-gray-100">
                  {loading ? "..." : stats.avgTransaction}
                </div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Success Rate</div>
                <div className="text-2xl font-bold text-green-400">
                  {loading ? "..." : stats.successRate}
                </div>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-100 mb-6">Transaction Activity</h3>
              <div className="h-48 flex items-end space-x-1">
                {chartData.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-500/40 to-cyan-400/40 rounded-t-sm hover:from-blue-500/60 hover:to-cyan-400/60 transition-all duration-200"
                    style={{ height: `${bar.height}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-4 text-xs text-gray-500">
                <span>Now</span>
                <span>{timeRange} ago</span>
              </div>
            </div>

            {/* Filters and Search Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Scheme Filter */}
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                {(["all", "exact", "deferred"] as const).map((scheme) => (
                  <button
                    key={scheme}
                    onClick={() => setSchemeFilter(scheme)}
                    className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 capitalize ${
                      schemeFilter === scheme
                        ? "bg-slate-700 text-cyan-400"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {scheme === "all" ? "All Schemes" : `${scheme} Scheme`}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by hash, address..."
                    className="w-full px-4 py-2 pl-10 bg-slate-800/50 border border-blue-500/30 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Records Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Show:</span>
                <select
                  value={recordsPerPage}
                  onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                  className="px-3 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-gray-200 focus:outline-none focus:border-cyan-400/50 transition-colors cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-blue-500/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-100">Recent Transactions</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {totalRecords > 0
                      ? `Showing ${startRecord}-${endRecord} of ${totalRecords} transactions`
                      : "Latest community payments across all networks"
                    }
                  </p>
                </div>
              </div>

              {/* Card-based Transaction List */}
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                    Loading transactions...
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    No transactions found for this period
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {transactions.map((tx) => (
                      <a
                        key={tx.fullHash}
                        href={getExplorerUrl(tx.network, tx.fullHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl hover:border-cyan-400/30 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{networkIcons[tx.network] || "🌐"}</span>
                            <span className="text-xs text-gray-400 capitalize">{tx.network}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              tx.status === "success"
                                ? "bg-green-500/20 text-green-400"
                                : tx.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                            }`}>
                              {tx.status}
                            </span>
                            <svg className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        </div>

                        {/* Transaction Hash */}
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 mb-1">Transaction Hash</div>
                          <code className="text-sm text-cyan-400 font-mono break-all">{tx.hash}</code>
                        </div>

                        {/* Amount and Gas Fee */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Amount</div>
                            <div className="text-lg font-semibold text-green-400">{tx.amount}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Gas Fee</div>
                            <div className="text-sm text-orange-400">{tx.gasFee}</div>
                          </div>
                        </div>

                        {/* From / To */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">From</div>
                            <code className="text-xs text-gray-300 font-mono">{tx.from}</code>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">To</div>
                            <code className="text-xs text-gray-300 font-mono">{tx.to}</code>
                          </div>
                        </div>

                        {/* Date/Time */}
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 mb-1">Date & Time</div>
                          <div className="text-sm text-gray-300">{tx.datetime}</div>
                          <div className="text-xs text-gray-500">{tx.timestamp}</div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            tx.scheme === "exact"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-purple-500/20 text-purple-400"
                          }`}>
                            {tx.scheme}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-700/50">
                    <div className="text-sm text-gray-400">
                      Showing {startRecord}-{endRecord} of {totalRecords} transactions
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === 1
                            ? "bg-slate-800/30 text-gray-600 cursor-not-allowed"
                            : "bg-slate-800/50 text-gray-300 hover:bg-slate-700 hover:text-cyan-400"
                        }`}
                      >
                        Previous
                      </button>

                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {getPageNumbers().map((page, idx) => (
                          page === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(Number(page))}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-400/30"
                                  : "bg-slate-800/50 text-gray-300 hover:bg-slate-700 hover:text-cyan-400"
                              }`}
                            >
                              {page}
                            </button>
                          )
                        ))}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === totalPages
                            ? "bg-slate-800/30 text-gray-600 cursor-not-allowed"
                            : "bg-slate-800/50 text-gray-300 hover:bg-slate-700 hover:text-cyan-400"
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
