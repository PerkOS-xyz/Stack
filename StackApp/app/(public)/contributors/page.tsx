'use client';

import { useState, useEffect } from 'react';

export const dynamic = "force-dynamic";
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { QRCodeSVG } from 'qrcode.react';

interface Contributor {
  id: string;
  walletAddress: string; // Sponsor wallet address (for donations) or user wallet if no sponsor
  userWalletAddress: string; // Original user wallet address
  displayAddress: string;
  accountType: 'personal' | 'community' | 'organization' | 'vendor';
  displayName: string | null;
  description: string | null;
  website: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  hasSponsorWallet: boolean; // Whether the contributor has a public sponsor wallet
  socials: {
    twitter: string | null;
    github: string | null;
    discord: string | null;
    farcaster: string | null;
    telegram: string | null;
    instagram: string | null;
    tiktok: string | null;
    twitch: string | null;
    kick: string | null;
  };
  companyName: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  personal: number;
  community: number;
  organization: number;
  vendor: number;
}

interface NetworkConfig {
  name: string;
  symbol: string;
  icon: string;
  chainId: number;
  isTestnet?: boolean;
}

const networks: Record<string, NetworkConfig> = {
  // Mainnets
  'avalanche': { name: 'Avalanche', symbol: 'AVAX', icon: '🔺', chainId: 43114 },
  'base': { name: 'Base', symbol: 'ETH', icon: '🔵', chainId: 8453 },
  'celo': { name: 'Celo', symbol: 'CELO', icon: '🟢', chainId: 42220 },
  'ethereum': { name: 'Ethereum', symbol: 'ETH', icon: '💎', chainId: 1 },
  'polygon': { name: 'Polygon', symbol: 'POL', icon: '🟣', chainId: 137 },
  'arbitrum': { name: 'Arbitrum', symbol: 'ETH', icon: '🔷', chainId: 42161 },
  'optimism': { name: 'Optimism', symbol: 'ETH', icon: '🔴', chainId: 10 },
  'monad': { name: 'Monad', symbol: 'MON', icon: '🟡', chainId: 10142 },
  // Testnets
  'avalanche-fuji': { name: 'Avalanche Fuji', symbol: 'AVAX', icon: '🔺', chainId: 43113, isTestnet: true },
  'base-sepolia': { name: 'Base Sepolia', symbol: 'ETH', icon: '🔵', chainId: 84532, isTestnet: true },
  'celo-sepolia': { name: 'Celo Alfajores', symbol: 'CELO', icon: '🟢', chainId: 11142220, isTestnet: true },
  'sepolia': { name: 'Sepolia', symbol: 'ETH', icon: '💎', chainId: 11155111, isTestnet: true },
  'polygon-amoy': { name: 'Polygon Amoy', symbol: 'POL', icon: '🟣', chainId: 80002, isTestnet: true },
  'arbitrum-sepolia': { name: 'Arbitrum Sepolia', symbol: 'ETH', icon: '🔷', chainId: 421614, isTestnet: true },
  'optimism-sepolia': { name: 'OP Sepolia', symbol: 'ETH', icon: '🔴', chainId: 11155420, isTestnet: true },
  'monad-testnet': { name: 'Monad Testnet', symbol: 'MON', icon: '🟡', chainId: 10143, isTestnet: true },
};

const ACCOUNT_TYPE_CONFIG = {
  personal: { label: 'Personal', icon: '👤', color: 'blue' },
  community: { label: 'Community', icon: '🌐', color: 'green' },
  organization: { label: 'Organization', icon: '🏢', color: 'purple' },
  vendor: { label: 'Vendor', icon: '🏪', color: 'orange' },
} as const;

export default function ContributorsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('base');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

  const LIMIT = 12;

  useEffect(() => {
    fetchContributors();
  }, [filterType, page]);

  const fetchContributors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: LIMIT.toString(),
        offset: (page * LIMIT).toString(),
      });

      if (filterType !== 'all') {
        params.set('type', filterType);
      }

      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/contributors?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContributors(data.contributors);
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
        setFilteredTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch contributors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchContributors();
  };

  const getSocialLinks = (socials: Contributor['socials']) => {
    const links = [];
    if (socials.twitter) links.push({ platform: 'x', handle: socials.twitter, url: `https://x.com/${socials.twitter}` });
    if (socials.github) links.push({ platform: 'github', handle: socials.github, url: `https://github.com/${socials.github}` });
    if (socials.farcaster) links.push({ platform: 'farcaster', handle: socials.farcaster, url: `https://farcaster.xyz/${socials.farcaster}` });
    if (socials.telegram) links.push({ platform: 'telegram', handle: socials.telegram, url: `https://t.me/${socials.telegram}` });
    if (socials.instagram) links.push({ platform: 'instagram', handle: socials.instagram, url: `https://instagram.com/${socials.instagram}` });
    if (socials.tiktok) links.push({ platform: 'tiktok', handle: socials.tiktok, url: `https://tiktok.com/@${socials.tiktok}` });
    if (socials.twitch) links.push({ platform: 'twitch', handle: socials.twitch, url: `https://twitch.tv/${socials.twitch}` });
    if (socials.kick) links.push({ platform: 'kick', handle: socials.kick, url: `https://kick.com/${socials.kick}` });
    return links;
  };

  const getTypeColor = (type: string) => {
    const config = ACCOUNT_TYPE_CONFIG[type as keyof typeof ACCOUNT_TYPE_CONFIG];
    switch (config?.color) {
      case 'blue': return 'bg-blue-500/20 text-blue-400 border-pink-500/30';
      case 'green': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'purple': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'orange': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentNetwork = networks[selectedNetwork];

  return (
    <div className="min-h-screen bg-[#0E0716] text-white overflow-x-hidden flex flex-col">
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 via-transparent to-amber-950/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #EB1B69 1px, transparent 1px), linear-gradient(to bottom, #EB1B69 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-pink-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative flex-1 flex flex-col">
        <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
              Contributors
            </h1>
            <p className="text-gray-400 mt-2">
              Discover community members, organizations, and service providers
            </p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <button
                onClick={() => { setFilterType('all'); setPage(0); }}
                className={`bg-slate-800/50 border backdrop-blur-sm rounded-xl p-4 text-center transition-all hover:border-pink-500/50 ${
                  filterType === 'all' ? 'border-pink-500' : 'border-pink-500/30'
                }`}
              >
                <div className="text-2xl font-bold text-pink-400">{stats.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </button>
              {Object.entries(ACCOUNT_TYPE_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => { setFilterType(type); setPage(0); }}
                  className={`bg-slate-800/50 border backdrop-blur-sm rounded-xl p-4 text-center transition-all hover:border-pink-500/50 ${
                    filterType === type ? 'border-pink-500' : 'border-pink-500/30'
                  }`}
                >
                  <div className="text-2xl font-bold text-gray-200">
                    {stats[type as keyof Stats]}
                  </div>
                  <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full bg-slate-800/50 border border-pink-500/30 rounded-xl px-4 py-3 pl-10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-pink-400 transition-colors"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700 text-white font-medium rounded-xl transition-all"
              >
                Search
              </button>
            </div>
          </form>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-pink-400 border-r-transparent"></div>
              <span className="ml-3 text-gray-400">Loading contributors...</span>
            </div>
          ) : contributors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No contributors found</h3>
              <p className="text-gray-500">
                {search ? 'Try a different search term' : 'Be the first to create a public profile!'}
              </p>
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="text-sm text-gray-500 mb-4">
                Showing {contributors.length} of {filteredTotal} contributors
                {filterType !== 'all' && stats && ` (${stats.total} total)`}
              </div>

              {/* Contributors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contributors.map((contributor) => {
                  const typeConfig = ACCOUNT_TYPE_CONFIG[contributor.accountType];
                  const socialLinks = getSocialLinks(contributor.socials);

                  return (
                    <div
                      key={contributor.id}
                      onClick={() => setSelectedContributor(contributor)}
                      className="bg-slate-800/50 border border-pink-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-pink-500/50 transition-all cursor-pointer"
                    >
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        {/* Avatar */}
                        {contributor.avatarUrl ? (
                          <img
                            src={contributor.avatarUrl}
                            alt={contributor.displayName || 'Avatar'}
                            className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/30"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-pink-500/30 flex items-center justify-center">
                            <span className="text-2xl">{typeConfig.icon}</span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-200 truncate">
                              {contributor.displayName || contributor.displayAddress}
                            </h3>
                            {contributor.isVerified && (
                              <span className="text-pink-400" title="Verified">✓</span>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(contributor.accountType)}`}>
                            <span>{typeConfig.icon}</span>
                            <span>{typeConfig.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {contributor.description && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                          {contributor.description}
                        </p>
                      )}

                      {/* Company Name (for vendors) */}
                      {contributor.companyName && (
                        <div className="text-sm text-gray-500 mb-3">
                          <span className="text-gray-400">Company:</span> {contributor.companyName}
                        </div>
                      )}

                      {/* Website */}
                      {contributor.website && (
                        <a
                          href={contributor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm text-pink-400 hover:text-pink-300 mb-3"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate">{new URL(contributor.website).hostname}</span>
                        </a>
                      )}

                      {/* Social Links */}
                      {socialLinks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-700/50">
                          {socialLinks.slice(0, 5).map((link) => (
                            <a
                              key={link.platform}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
                              title={`@${link.handle}`}
                            >
                              <SocialIcon platform={link.platform} />
                            </a>
                          ))}
                          {socialLinks.length > 5 && (
                            <span className="p-2 text-xs text-gray-500">
                              +{socialLinks.length - 5} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Wallet Address */}
                      <div className="mt-4 pt-3 border-t border-slate-700/50">
                        <code className="text-xs text-gray-500 font-mono">
                          {contributor.displayAddress}
                        </code>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 bg-slate-800/50 border border-pink-500/30 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-pink-500/50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-500">
                  Page {page + 1} of {Math.ceil(filteredTotal / LIMIT) || 1}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-4 py-2 bg-slate-800/50 border border-pink-500/30 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-pink-500/50 transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </main>

        <Footer />
      </div>

      {/* Contributor Detail Modal */}
      {selectedContributor && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSelectedContributor(null);
            setShowNetworkDropdown(false);
          }}
        >
          <div
            className="bg-slate-800/95 border border-pink-500/30 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 pb-0">
              <button
                onClick={() => {
                  setSelectedContributor(null);
                  setShowNetworkDropdown(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Avatar and Name */}
              <div className="flex flex-col items-center text-center mb-6">
                {selectedContributor.avatarUrl ? (
                  <img
                    src={selectedContributor.avatarUrl}
                    alt={selectedContributor.displayName || 'Avatar'}
                    className="w-24 h-24 rounded-full object-cover border-4 border-pink-500/30 mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-700 border-4 border-pink-500/30 flex items-center justify-center mb-4">
                    <span className="text-4xl">{ACCOUNT_TYPE_CONFIG[selectedContributor.accountType].icon}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-white">
                    {selectedContributor.displayName || selectedContributor.displayAddress}
                  </h2>
                  {selectedContributor.isVerified && (
                    <span className="text-pink-400 text-xl" title="Verified">✓</span>
                  )}
                </div>

                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(selectedContributor.accountType)}`}>
                  <span>{ACCOUNT_TYPE_CONFIG[selectedContributor.accountType].icon}</span>
                  <span>{ACCOUNT_TYPE_CONFIG[selectedContributor.accountType].label}</span>
                </span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 pt-0 space-y-6">
              {/* Description */}
              {selectedContributor.description && (
                <p className="text-gray-300 text-center">
                  {selectedContributor.description}
                </p>
              )}

              {/* Company Name */}
              {selectedContributor.companyName && (
                <div className="text-center">
                  <span className="text-gray-500">Company: </span>
                  <span className="text-gray-300">{selectedContributor.companyName}</span>
                </div>
              )}

              {/* Website */}
              {selectedContributor.website && (
                <a
                  href={selectedContributor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-pink-400 hover:text-pink-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>{selectedContributor.website}</span>
                </a>
              )}

              {/* Social Links */}
              {getSocialLinks(selectedContributor.socials).length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-slate-700/50">
                  {getSocialLinks(selectedContributor.socials).map((link) => (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl transition-colors"
                      title={`@${link.handle}`}
                    >
                      <SocialIcon platform={link.platform} />
                      <span className="text-sm text-gray-300">@{link.handle}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Donation Section */}
              <div className="pt-6 border-t border-slate-700/50">
                <h3 className="text-lg font-semibold text-white text-center mb-4">
                  💝 Support This Contributor
                </h3>

                {/* Network Selector */}
                <div className="relative mb-4">
                  <button
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-700/50 border border-pink-500/20 hover:border-pink-500/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{currentNetwork?.icon}</span>
                      <span className="text-white font-medium">{currentNetwork?.name}</span>
                      {currentNetwork?.isTestnet && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">TESTNET</span>
                      )}
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${showNetworkDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showNetworkDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-slate-800/95 border border-pink-500/20 rounded-2xl shadow-2xl shadow-black/50 z-10 max-h-60 overflow-y-auto backdrop-blur-xl">
                      <div className="px-4 py-2 text-xs text-pink-400 uppercase tracking-wider font-medium">Mainnets</div>
                      {Object.entries(networks).filter(([, n]) => !n.isTestnet).map(([key, net]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedNetwork(key);
                            setShowNetworkDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-blue-500/10 transition-colors ${selectedNetwork === key ? 'bg-blue-500/10' : ''}`}
                        >
                          <span className="text-lg">{net.icon}</span>
                          <span className="text-sm text-white flex-1 text-left">{net.name}</span>
                          {selectedNetwork === key && (
                            <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                      <div className="px-4 py-2 text-xs text-pink-400 uppercase tracking-wider font-medium border-t border-pink-500/10 mt-2">Testnets</div>
                      {Object.entries(networks).filter(([, n]) => n.isTestnet).map(([key, net]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedNetwork(key);
                            setShowNetworkDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-blue-500/10 transition-colors ${selectedNetwork === key ? 'bg-blue-500/10' : ''}`}
                        >
                          <span className="text-lg">{net.icon}</span>
                          <span className="text-sm text-white flex-1 text-left">{net.name}</span>
                          {selectedNetwork === key && (
                            <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/50 to-orange-500/50 rounded-2xl blur-sm" />
                    <div className="relative p-1 bg-gradient-to-br from-pink-500/30 via-orange-500/20 to-pink-500/30 rounded-2xl">
                      <div className="p-4 bg-white rounded-xl">
                        <QRCodeSVG
                          value={`ethereum:${selectedContributor.walletAddress}@${currentNetwork?.chainId || 1}`}
                          size={180}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet Address */}
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Wallet Address</p>
                  <code className="text-sm font-mono text-pink-400 break-all px-2">
                    {selectedContributor.walletAddress}
                  </code>
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(selectedContributor.walletAddress)}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Address</span>
                </button>

                {/* Sponsor Wallet Badge */}
                {selectedContributor.hasSponsorWallet && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Official Sponsor Wallet</span>
                    </div>
                  </div>
                )}

                {/* Info Notice */}
                <div className="mt-4 p-3 bg-slate-700/30 border border-amber-500/20 rounded-xl">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-gray-400">
                      Only send <span className="text-pink-400 font-medium">{currentNetwork?.symbol}</span> on <span className="text-pink-400 font-medium">{currentNetwork?.name}</span>.
                      Sending other assets may result in permanent loss.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Social Icon Component
function SocialIcon({ platform }: { platform: string }) {
  const iconClass = "w-4 h-4 text-gray-400";

  switch (platform) {
    case 'twitter':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'github':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'farcaster':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 1000 1000">
          <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
          <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
          <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      );
    case 'twitch':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
        </svg>
      );
    case 'kick':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.5 16.5l-3-3-3 3-1.5-1.5 3-3-3-3 1.5-1.5 3 3 3-3 1.5 1.5-3 3 3 3-1.5 1.5z"/>
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
  }
}
