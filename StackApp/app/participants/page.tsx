'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface Participant {
  id: string;
  walletAddress: string;
  displayAddress: string;
  accountType: 'personal' | 'community' | 'organization' | 'vendor';
  displayName: string | null;
  description: string | null;
  website: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
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

const ACCOUNT_TYPE_CONFIG = {
  personal: { label: 'Personal', icon: '👤', color: 'blue' },
  community: { label: 'Community', icon: '🌐', color: 'green' },
  organization: { label: 'Organization', icon: '🏢', color: 'purple' },
  vendor: { label: 'Vendor', icon: '🏪', color: 'orange' },
} as const;

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const LIMIT = 12;

  useEffect(() => {
    fetchParticipants();
  }, [filterType, page]);

  const fetchParticipants = async () => {
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

      const response = await fetch(`/api/participants?${params}`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants);
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchParticipants();
  };

  const getSocialLinks = (socials: Participant['socials']) => {
    const links = [];
    if (socials.twitter) links.push({ platform: 'twitter', handle: socials.twitter, url: `https://twitter.com/${socials.twitter}` });
    if (socials.github) links.push({ platform: 'github', handle: socials.github, url: `https://github.com/${socials.github}` });
    if (socials.farcaster) links.push({ platform: 'farcaster', handle: socials.farcaster, url: `https://warpcast.com/${socials.farcaster}` });
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
      case 'blue': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'green': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'purple': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'orange': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="relative">
        <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Participants
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
                className={`bg-slate-800/50 border backdrop-blur-sm rounded-xl p-4 text-center transition-all hover:border-cyan-500/50 ${
                  filterType === 'all' ? 'border-cyan-500' : 'border-blue-500/30'
                }`}
              >
                <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
                <div className="text-sm text-gray-400">Total</div>
              </button>
              {Object.entries(ACCOUNT_TYPE_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => { setFilterType(type); setPage(0); }}
                  className={`bg-slate-800/50 border backdrop-blur-sm rounded-xl p-4 text-center transition-all hover:border-cyan-500/50 ${
                    filterType === type ? 'border-cyan-500' : 'border-blue-500/30'
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
                  className="w-full bg-slate-800/50 border border-blue-500/30 rounded-xl px-4 py-3 pl-10 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all"
              >
                Search
              </button>
            </div>
          </form>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-400 border-r-transparent"></div>
              <span className="ml-3 text-gray-400">Loading participants...</span>
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No participants found</h3>
              <p className="text-gray-500">
                {search ? 'Try a different search term' : 'Be the first to create a public profile!'}
              </p>
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="text-sm text-gray-500 mb-4">
                Showing {participants.length} of {total} participants
              </div>

              {/* Participants Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {participants.map((participant) => {
                  const typeConfig = ACCOUNT_TYPE_CONFIG[participant.accountType];
                  const socialLinks = getSocialLinks(participant.socials);

                  return (
                    <div
                      key={participant.id}
                      className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6 hover:border-cyan-500/50 transition-all"
                    >
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        {/* Avatar */}
                        {participant.avatarUrl ? (
                          <img
                            src={participant.avatarUrl}
                            alt={participant.displayName || 'Avatar'}
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/30"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-blue-500/30 flex items-center justify-center">
                            <span className="text-2xl">{typeConfig.icon}</span>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-200 truncate">
                              {participant.displayName || participant.displayAddress}
                            </h3>
                            {participant.isVerified && (
                              <span className="text-cyan-400" title="Verified">✓</span>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(participant.accountType)}`}>
                            <span>{typeConfig.icon}</span>
                            <span>{typeConfig.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {participant.description && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                          {participant.description}
                        </p>
                      )}

                      {/* Company Name (for vendors) */}
                      {participant.companyName && (
                        <div className="text-sm text-gray-500 mb-3">
                          <span className="text-gray-400">Company:</span> {participant.companyName}
                        </div>
                      )}

                      {/* Website */}
                      {participant.website && (
                        <a
                          href={participant.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 mb-3"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate">{new URL(participant.website).hostname}</span>
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
                          {participant.displayAddress}
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
                  className="px-4 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-500/50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-gray-500">
                  Page {page + 1} of {Math.ceil(total / LIMIT) || 1}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-4 py-2 bg-slate-800/50 border border-blue-500/30 rounded-lg text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyan-500/50 transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </main>

        <Footer />
      </div>
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
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.24 6.27H5.76v11.46h12.48V6.27zM12 2.64L2.64 6.27v11.46L12 21.36l9.36-3.63V6.27L12 2.64z"/>
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
