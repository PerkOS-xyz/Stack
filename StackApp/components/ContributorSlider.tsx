'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Contributor {
  id: string;
  walletAddress: string;
  userWalletAddress: string;
  displayAddress: string;
  accountType: 'personal' | 'community' | 'organization' | 'vendor';
  displayName: string | null;
  description: string | null;
  website: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  hasSponsorWallet: boolean;
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

const ACCOUNT_TYPE_CONFIG = {
  personal: {
    label: 'PERSONAL',
    color: 'from-pink-500 to-rose-500',
    borderColor: 'border-pink-500/50',
    glowColor: 'shadow-pink-500/20',
    bgGlow: 'from-pink-500/10'
  },
  community: {
    label: 'COMMUNITY',
    color: 'from-emerald-400 to-teal-500',
    borderColor: 'border-emerald-500/50',
    glowColor: 'shadow-emerald-500/20',
    bgGlow: 'from-emerald-500/10'
  },
  organization: {
    label: 'ORGANIZATION',
    color: 'from-violet-400 to-purple-500',
    borderColor: 'border-violet-500/50',
    glowColor: 'shadow-violet-500/20',
    bgGlow: 'from-violet-500/10'
  },
  vendor: {
    label: 'VENDOR',
    color: 'from-amber-400 to-orange-500',
    borderColor: 'border-amber-500/50',
    glowColor: 'shadow-amber-500/20',
    bgGlow: 'from-amber-500/10'
  },
} as const;

// Social Icon Component
function SocialIcon({ platform, className = "w-5 h-5" }: { platform: string; className?: string }) {
  const iconClass = `${className} text-gray-400 hover:text-white transition-colors`;

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
    case 'website':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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

// Contributor Card - clean design with visible background
function ContributorCard({ contributor, index }: { contributor: Contributor; index: number }) {
  const typeConfig = ACCOUNT_TYPE_CONFIG[contributor.accountType];

  const getSocialLinks = () => {
    const links = [];
    if (contributor.socials.github) links.push({ platform: 'github', url: `https://github.com/${contributor.socials.github}` });
    if (contributor.socials.twitter) links.push({ platform: 'twitter', url: `https://x.com/${contributor.socials.twitter}` });
    if (contributor.socials.farcaster) links.push({ platform: 'farcaster', url: `https://warpcast.com/${contributor.socials.farcaster}` });
    if (contributor.socials.telegram) links.push({ platform: 'telegram', url: `https://t.me/${contributor.socials.telegram}` });
    if (contributor.socials.instagram) links.push({ platform: 'instagram', url: `https://instagram.com/${contributor.socials.instagram}` });
    if (contributor.website) links.push({ platform: 'website', url: contributor.website });
    return links;
  };

  const socialLinks = getSocialLinks();

  return (
    <div
      className="group relative flex-shrink-0 w-[280px] sm:w-[300px] h-[420px]"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Card container */}
      <div className={`
        relative overflow-hidden rounded-[24px] h-full
        border-2 ${typeConfig.borderColor}
        shadow-xl ${typeConfig.glowColor}
        transition-all duration-500 ease-out
        hover:scale-[1.02] hover:shadow-2xl
      `}>
        {/* Card background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/card-background.png)',
            opacity: 0.25
          }}
        />

        {/* Gradient overlay for text readability - darker at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E0716]/40 via-[#0E0716]/50 to-[#0E0716]/80" />

        {/* Animated holographic overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
        </div>

        {/* Background glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-b ${typeConfig.bgGlow} to-transparent opacity-30`} />

        {/* Card content wrapper */}
        <div className="relative h-full flex flex-col">
          {/* Top badges row */}
          <div className="flex items-center justify-between p-4 pb-0">
            <span className={`
              px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider
              bg-gradient-to-r ${typeConfig.color} text-white
              shadow-lg uppercase
            `}>
              {typeConfig.label}
            </span>

            {contributor.hasSponsorWallet && (
              <span className="px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg uppercase">
                SPONSOR
              </span>
            )}
          </div>

          {/* Avatar section */}
          <div className="flex justify-center py-6">
            <div className="relative">
              {/* Outer glow ring */}
              <div className={`
                absolute -inset-2 rounded-full
                bg-gradient-to-r ${typeConfig.color}
                opacity-60 blur-sm
                group-hover:opacity-80 group-hover:blur-md
                transition-all duration-500
              `} />

              {/* Avatar */}
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#2a2440] to-[#1a1625] p-1 shadow-xl">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/30 bg-gradient-to-br from-gray-800 to-gray-900">
                  {contributor.avatarUrl ? (
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.displayName || 'Avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                      <span className="text-3xl">
                        {contributor.accountType === 'personal' ? '👤' :
                         contributor.accountType === 'community' ? '🌐' :
                         contributor.accountType === 'organization' ? '🏢' : '🏪'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content section - no panel, direct on background */}
          <div className="flex-1 flex flex-col px-5 text-center">
            {/* Name */}
            <h3 className="text-xl font-bold text-white truncate mb-2 drop-shadow-lg">
              {contributor.displayName || contributor.displayAddress}
            </h3>

            {/* Description */}
            <div className="flex-1 min-h-[44px]">
              {contributor.description && (
                <p className="text-sm text-gray-200 line-clamp-2 leading-relaxed drop-shadow-md">
                  {contributor.description}
                </p>
              )}
            </div>

          </div>

          {/* Social links at bottom */}
          <div className="px-5 pb-5 mb-5">
            <div className="flex items-center justify-center gap-3">
              {socialLinks.length > 0 ? (
                socialLinks.slice(0, 5).map((link) => (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 transition-all duration-200 hover:scale-110"
                  >
                    <SocialIcon platform={link.platform} className="w-4 h-4" />
                  </a>
                ))
              ) : (
                <div className="h-[40px]" />
              )}
            </div>
          </div>

          {/* Bottom decorative line */}
          <div className={`h-1 bg-gradient-to-r ${typeConfig.color}`} />
        </div>
      </div>
    </div>
  );
}

export function ContributorSlider() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchContributors = async () => {
      try {
        const response = await fetch('/api/contributors?limit=12');
        if (response.ok) {
          const data = await response.json();
          setContributors(data.contributors || []);
        }
      } catch (error) {
        console.error('Failed to fetch contributors:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, []);

  // Auto-scroll animation
  const scroll = useCallback(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollLeft += 0.5;

      // Reset scroll when reaching the end
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      if (scrollRef.current.scrollLeft >= maxScroll) {
        scrollRef.current.scrollLeft = 0;
      }
    }
    animationRef.current = requestAnimationFrame(scroll);
  }, [isPaused]);

  useEffect(() => {
    if (contributors.length > 0) {
      animationRef.current = requestAnimationFrame(scroll);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [scroll, contributors.length]);

  if (loading) {
    return (
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-pink-400 border-r-transparent" />
            <span className="ml-3 text-gray-400">Loading contributors...</span>
          </div>
        </div>
      </section>
    );
  }

  if (contributors.length === 0) {
    return null;
  }

  // Duplicate contributors for seamless infinite scroll
  const displayContributors = [...contributors, ...contributors];

  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-pink-500/5 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-pink-500/10 border border-pink-500/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <span className="text-pink-400 text-sm font-mono tracking-wide uppercase">Contributors</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Building Together
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Meet the vendors, creators, and organizations powering the PerkOS ecosystem
          </p>
        </div>

        {/* Carousel container with fade edges */}
        <div className="relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#0E0716] to-transparent z-10 pointer-events-none" />

          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#0E0716] to-transparent z-10 pointer-events-none" />

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide py-4 px-8"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {displayContributors.map((contributor, index) => (
              <ContributorCard
                key={`${contributor.id}-${index}`}
                contributor={contributor}
                index={index}
              />
            ))}
          </div>
        </div>

        {/* View all link */}
        <div className="flex justify-center mt-10">
          <Link
            href="/contributors"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 rounded-xl transition-all duration-300"
          >
            <span className="text-gray-300 group-hover:text-white transition-colors">View All Contributors</span>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
