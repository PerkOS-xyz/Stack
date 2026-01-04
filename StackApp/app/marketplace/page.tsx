"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Endpoint {
  id: string;
  path: string;
  method: string;
  description: string | null;
  price_usd: string;
  parameters: any;
}

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  url: string;
  wallet_address: string;
  network: string;
  category: string;
  tags: string[];
  status: string;
  total_transactions: number;
  total_volume: string;
  average_rating: number;
  icon_url: string | null;
  website_url: string | null;
  docs_url: string | null;
  price_usd: string | null;
  endpoints?: Endpoint[];
}

interface VendorsResponse {
  success: boolean;
  vendors: Vendor[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function MarketplacePage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [stats, setStats] = useState({
    activeProviders: 0,
    totalVolume: "$0",
  });

  const networkIcons: Record<string, string> = {
    avalanche: "🔺",
    "avalanche-fuji": "🔺",
    celo: "🌿",
    "celo-sepolia": "🌿",
    base: "🔵",
    "base-sepolia": "🔵",
  };

  const categoryIcons: Record<string, string> = {
    all: "🏪",
    api: "🔌",
    ai: "🤖",
    data: "📊",
    nft: "🎨",
    defi: "💰",
    gaming: "🎮",
    dao: "🏛️",
    other: "📦",
  };

  const fetchVendors = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }
      params.append("limit", "50");

      const response = await fetch(`/api/vendors?${params.toString()}`);
      const data: VendorsResponse = await response.json();

      if (data.success) {
        setVendors(data.vendors);

        // Calculate stats
        const totalVolume = data.vendors.reduce((sum, v) => sum + parseFloat(v.total_volume || "0"), 0);
        setStats({
          activeProviders: data.pagination.total,
          totalVolume: `$${(totalVolume / 1000000).toFixed(2)}M`,
        });
      } else {
        setError("Failed to load vendors");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVendorEndpoints = async (vendorId: string) => {
    if (selectedVendor?.endpoints) return; // Already loaded

    setLoadingEndpoints(true);
    try {
      const response = await fetch(`/api/vendors/${vendorId}`);
      const data = await response.json();
      if (data.success && data.endpoints) {
        setSelectedVendor(prev => prev ? { ...prev, endpoints: data.endpoints } : null);
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    } finally {
      setLoadingEndpoints(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [categoryFilter]);

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume || "0");
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
                <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  Marketplace
                </h2>
                <p className="text-gray-400">Discover and connect with X402 service providers</p>
              </div>

              <div className="flex items-center space-x-4">
                {/* Time Range Filter */}
                <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                  {(["24h", "7d", "30d"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-1 rounded-md text-xs font-medium transition-all duration-200 ${timeRange === range
                          ? "bg-slate-700 text-cyan-400"
                          : "text-gray-400 hover:text-gray-200"
                        }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Active Providers</div>
                <div className="text-2xl font-bold text-gray-100">{stats.activeProviders}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Services</div>
                <div className="text-2xl font-bold text-gray-100">{vendors.length}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Total Volume</div>
                <div className="text-2xl font-bold text-gray-100">{stats.totalVolume}</div>
              </div>
              <div className="p-4 bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm">
                <div className="text-sm text-gray-400 mb-1">Networks</div>
                <div className="text-2xl font-bold text-gray-100">
                  {new Set(vendors.map((v) => v.network)).size}
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryIcons).map(([category, icon]) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize flex items-center space-x-2 ${categoryFilter === category
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                        : "bg-slate-800/50 border border-blue-500/30 text-gray-400 hover:text-gray-200 hover:border-blue-400/50"
                      }`}
                  >
                    <span>{icon}</span>
                    <span>{category === "all" ? "All" : category.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                <p className="text-red-400">{error}</p>
                <button
                  onClick={fetchVendors}
                  className="mt-4 px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && vendors.length === 0 && (
              <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🔌</div>
                <h3 className="text-xl font-bold text-gray-200 mb-2">No Services Found</h3>
                <p className="text-gray-400">
                  Services register automatically via POST /api/register from their vendor API.
                </p>
              </div>
            )}

            {/* Service Provider Cards */}
            {!isLoading && !error && vendors.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                {vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm hover:border-blue-400/50 hover:bg-slate-800/50 transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6">
                      {/* Provider Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            {vendor.icon_url && (
                              <img
                                src={vendor.icon_url}
                                alt=""
                                className="w-8 h-8 rounded-lg"
                              />
                            )}
                            <h3 className="text-xl font-bold text-gray-100">{vendor.name}</h3>
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-md text-xs font-medium capitalize">
                              {categoryIcons[vendor.category] || "📦"} {vendor.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">
                            {vendor.description || "No description provided"}
                          </p>
                          <div className="flex items-center space-x-4">
                            <code className="text-xs text-gray-500 font-mono">
                              {truncateAddress(vendor.wallet_address)}
                            </code>
                            {vendor.price_usd && (
                              <span className="text-xs text-cyan-400">
                                ${vendor.price_usd}/call
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Provider Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Transactions</div>
                          <div className="text-lg font-semibold text-gray-200">
                            {vendor.total_transactions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Volume</div>
                          <div className="text-lg font-semibold text-green-400">
                            {formatVolume(vendor.total_volume)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-1">Rating</div>
                          <div className="flex items-center space-x-1">
                            <span className="text-lg font-semibold text-yellow-400">⭐</span>
                            <span className="text-lg font-semibold text-gray-200">
                              {vendor.average_rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      {vendor.tags && vendor.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {vendor.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-slate-700/50 text-gray-400 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Network Badge & Actions */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{networkIcons[vendor.network] || "🌐"}</span>
                          <span className="text-xs text-gray-400 capitalize">{vendor.network}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setShowEndpoints(true);
                              fetchVendorEndpoints(vendor.id);
                            }}
                            className="px-3 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 transition-colors flex items-center space-x-1"
                          >
                            <span>Endpoints</span>
                            {vendor.endpoints && (
                              <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">
                                {vendor.endpoints.length}
                              </span>
                            )}
                          </button>
                          {vendor.docs_url && (
                            <a
                              href={vendor.docs_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-slate-700 text-gray-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                            >
                              Docs
                            </a>
                          )}
                          <a
                            href={vendor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                          >
                            Connect
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Endpoints Modal */}
        {showEndpoints && selectedVendor && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEndpoints(false)}>
            <div className="bg-slate-900 border border-blue-500/30 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-100">{selectedVendor.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedVendor.endpoints?.length || 0} API Endpoints
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEndpoints(false)}
                    className="text-gray-400 hover:text-gray-200 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {loadingEndpoints ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                  </div>
                ) : selectedVendor.endpoints && selectedVendor.endpoints.length > 0 ? (
                  <div className="space-y-3">
                    {selectedVendor.endpoints.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                                {endpoint.method}
                              </span>
                              <code className="text-cyan-400 font-mono text-sm">
                                {endpoint.path}
                              </code>
                            </div>
                            <p className="text-gray-400 text-sm">
                              {endpoint.description || 'No description provided'}
                            </p>
                            {endpoint.parameters && Object.keys(endpoint.parameters).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                  Parameters →
                                </summary>
                                <pre className="mt-2 bg-slate-900/50 rounded p-2 text-xs text-gray-300 overflow-x-auto">
                                  {JSON.stringify(endpoint.parameters, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                          <div className="ml-4">
                            <span className="px-3 py-1 bg-green-600/20 text-green-400 text-sm font-semibold rounded-full border border-green-600/30">
                              ${endpoint.price_usd}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No endpoints registered</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
}
