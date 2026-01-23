"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useWalletContext } from "@/lib/wallet/client";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { useSubscription } from "@/lib/contexts/SubscriptionContext";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  requiresAuth?: boolean;
}

// Navigation items (excluding Dashboard and Profile which go in user dropdown)
// Networks and Transactions are accessible from landing page "View All" links
const navItems: NavItem[] = [
  { href: "/marketplace", label: "Marketplace", icon: "🏪" },
  { href: "/agents", label: "Agents", icon: "👥" },
  { href: "/contributors", label: "Contributors", icon: "🤝" },
];

// User dropdown menu items (only shown when logged in)
const userMenuItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/subscription", label: "Subscription", icon: "💎" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

// Ethereum mainnet client for ENS lookups
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [ensAvatar, setEnsAvatar] = useState<string | null>(null);
  const [hasSponsorWallet, setHasSponsorWallet] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Wallet abstraction hooks - works with Para, Dynamic, or any configured provider
  const { openModal, openUserProfile, isConnected, address, disconnect } = useWalletContext();

  // Subscription context - centralized to prevent duplicate API calls
  const { tier: subscriptionTier } = useSubscription();

  const pathname = usePathname();
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch ENS name and avatar when account changes
  useEffect(() => {
    async function fetchEnsData() {
      if (!address) {
        setEnsName(null);
        setEnsAvatar(null);
        return;
      }

      // Validate that we have an EVM address (starts with 0x)
      // This prevents ENS lookup errors when a non-EVM address (e.g., Solana) is provided
      if (!address.startsWith("0x") || address.length !== 42) {
        console.warn("[Header] Skipping ENS lookup for non-EVM address:", address);
        setEnsName(null);
        setEnsAvatar(null);
        return;
      }

      try {
        // Reverse lookup ENS name
        const name = await ensClient.getEnsName({
          address: address,
        });
        setEnsName(name);

        // If we have an ENS name, try to get the avatar
        // Note: NFT avatars may fail due to CORS (e.g., OpenSea API)
        if (name) {
          try {
            const avatar = await ensClient.getEnsAvatar({
              name: normalize(name),
            });
            setEnsAvatar(avatar);
          } catch {
            // Silently fail - NFT avatars often fail due to CORS restrictions
            setEnsAvatar(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch ENS data:", error);
        setEnsName(null);
        setEnsAvatar(null);
      }
    }
    fetchEnsData();
  }, [address]);

  // Refs to track in-flight requests and prevent duplicates
  const fetchingUserDataRef = useRef(false);
  const lastFetchedAddressRef = useRef<string | null>(null);

  // Consolidated user data fetch - runs all API calls in parallel once per address
  useEffect(() => {
    async function fetchUserData() {
      // Reset state when disconnected
      if (!address) {
        setUserAvatar(null);
        setHasSponsorWallet(false);
        setIsAdmin(false);
        lastFetchedAddressRef.current = null;
        return;
      }

      const normalizedAddress = address.toLowerCase();

      // Skip if we've already fetched for this address
      if (lastFetchedAddressRef.current === normalizedAddress) {
        return;
      }

      // Skip if already fetching
      if (fetchingUserDataRef.current) {
        return;
      }

      fetchingUserDataRef.current = true;

      try {
        // Run all API calls in parallel
        const [profileRes, walletsRes, adminRes] = await Promise.all([
          fetch(`/api/profile?address=${address}`).catch(() => null),
          fetch(`/api/sponsor/wallets?address=${address}`).catch(() => null),
          fetch(`/api/admin/verify?address=${address}`).catch(() => null),
        ]);

        // Process profile response
        if (profileRes?.ok) {
          const data = await profileRes.json();
          setUserAvatar(data.profile?.avatar_url || null);

          // Auto-create profile if it doesn't exist (for new users)
          if (!data.exists && address) {
            console.log("[Header] Creating profile for new user:", address);
            try {
              await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  walletAddress: address,
                  accountType: "personal",
                  isPublic: true,
                }),
              });
            } catch (err) {
              console.error("[Header] Failed to auto-create profile:", err);
            }
          }
        }

        // Process wallets response
        if (walletsRes?.ok) {
          const data = await walletsRes.json();
          setHasSponsorWallet(data.wallets && data.wallets.length > 0);
        } else {
          setHasSponsorWallet(false);
        }

        // Process admin response
        if (adminRes?.ok) {
          const data = await adminRes.json();
          setIsAdmin(data.isAdmin === true);
        } else {
          setIsAdmin(false);
        }

        // Mark as successfully fetched
        lastFetchedAddressRef.current = normalizedAddress;
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        fetchingUserDataRef.current = false;
      }
    }

    fetchUserData();
  }, [address]);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format wallet address for display (first 5 + ... + last 5)
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Get display name: ENS name or formatted address
  const getDisplayName = () => {
    if (ensName) return ensName;
    if (address) return formatAddress(address);
    return "";
  };

  // Get avatar: profile avatar > ENS avatar > null
  const getAvatar = () => {
    return userAvatar || ensAvatar || null;
  };

  // Get avatar initials from address (handles both EVM and Solana)
  const getAvatarInitials = (addr: string) => {
    // For EVM addresses (0x prefixed), skip the 0x prefix
    if (addr.startsWith("0x") && addr.length === 42) {
      return addr.slice(2, 4).toUpperCase();
    }
    // For Solana or other addresses, use first 2 characters
    return addr.slice(0, 2).toUpperCase();
  };

  const isActive = (href: string) => pathname === href;

  // Get tier badge styling based on subscription tier
  const getTierBadgeStyle = (tier: string) => {
    switch (tier) {
      case "enterprise":
        return "bg-gradient-to-r from-purple-500 to-pink-500 text-white";
      case "scale":
        return "bg-gradient-to-r from-orange-500 to-red-500 text-white";
      case "pro":
        return "bg-gradient-to-r from-pink-500 to-orange-500 text-white";
      case "starter":
        return "bg-gradient-to-r from-green-500 to-emerald-500 text-white";
      default:
        return "bg-gray-600 text-gray-200";
    }
  };

  // Get tier display name
  const getTierDisplayName = (tier: string) => {
    const names: Record<string, string> = {
      free: "Free",
      starter: "Starter",
      pro: "Pro",
      scale: "Scale",
      enterprise: "Enterprise",
    };
    return names[tier] || "Free";
  };

  return (
    <header className="border-b border-pink-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Hamburger Menu (mobile only) + Logo */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu Button - visible on small screens */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-pink-400 hover:bg-pink-500/10 rounded-lg transition-all"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3">
              <img src="/logo.png" alt="Stack" className="w-16 h-16 rounded-lg" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                  Stack
                </h1>
                {/* <p className="text-xs text-gray-400">Payment Infrastructure</p> */}
              </div>
            </Link>
          </div>

          {/* Navigation Menu - Desktop only */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm hover:bg-pink-500/10 rounded-lg transition-all flex items-center space-x-2 ${
                    active
                      ? "text-pink-400 font-medium"
                      : "text-gray-300 hover:text-pink-400"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side - User Menu or Connect Button */}
          {isConnected && address ? (
            // Logged in with wallet - show tier badge and user dropdown
            <div className="flex items-center space-x-2">
              {/* Subscription Tier Badge */}
              <Link
                href="/subscription"
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all hover:opacity-80 hover:scale-105 ${getTierBadgeStyle(subscriptionTier)}`}
                title={`${getTierDisplayName(subscriptionTier)} Plan - Click to manage subscription`}
              >
                {getTierDisplayName(subscriptionTier)}
              </Link>

              {/* User Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-pink-600/20 to-orange-600/20 hover:from-pink-600/30 hover:to-orange-600/30 border border-pink-500/30 rounded-lg transition-all"
                >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                  {getAvatar() ? (
                    <img
                      src={getAvatar()!}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getAvatarInitials(address)
                  )}
                </div>
                <span className="text-gray-200 text-sm font-medium hidden sm:block max-w-[140px] truncate">
                  {getDisplayName()}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-pink-500/30 rounded-xl shadow-xl overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-pink-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden flex-shrink-0">
                        {getAvatar() ? (
                          <img
                            src={getAvatar()!}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getAvatarInitials(address)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {ensName && (
                          <p className="text-sm text-gray-200 font-medium truncate">{ensName}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono truncate">{formatAddress(address)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {userMenuItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setUserMenuOpen(false)}
                          className={`flex items-center space-x-3 px-4 py-2.5 text-sm transition-all ${
                            active
                              ? "text-pink-400 bg-pink-500/10"
                              : "text-gray-300 hover:text-pink-400 hover:bg-pink-500/10"
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                    {/* User Wallet - opens wallet provider's user profile/dashboard */}
                    <button
                      onClick={() => {
                        console.log("[Header] User Wallet clicked, openUserProfile:", typeof openUserProfile);
                        if (openUserProfile) {
                          openUserProfile();
                        } else {
                          console.log("[Header] openUserProfile not available, falling back to openModal");
                          openModal();
                        }
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm transition-all text-gray-300 hover:text-pink-400 hover:bg-pink-500/10 w-full"
                    >
                      <span>👛</span>
                      <span>User Wallet</span>
                    </button>
                    {/* Sponsor Wallets link - only shown when sponsor wallet exists */}
                    {hasSponsorWallet && (
                      <Link
                        href="/wallet"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-sm transition-all ${
                          isActive("/wallet")
                            ? "text-pink-400 bg-pink-500/10"
                            : "text-gray-300 hover:text-pink-400 hover:bg-pink-500/10"
                        }`}
                      >
                        <span>💰</span>
                        <span>Sponsor Wallets</span>
                      </Link>
                    )}
                    {/* Admin link - only shown for admin wallets */}
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-sm transition-all ${
                          isActive("/admin")
                            ? "text-red-400 bg-red-500/10"
                            : "text-gray-300 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        <span>🛡️</span>
                        <span>Admin</span>
                      </Link>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-pink-500/20 py-2">
                    <button
                      onClick={async () => {
                        await disconnect();
                        setUserMenuOpen(false);
                        router.push("/");
                      }}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 w-full transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : isConnected && !address ? (
            // Logged in but no wallet linked - show Link Wallet button and logout option
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openModal()}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg transition-all"
              >
                Link Wallet
              </button>
              <button
                onClick={async () => {
                  await disconnect();
                  router.push("/");
                }}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          ) : (
            // Not logged in - show Sign In button
            <button
              onClick={() => openModal()}
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-pink-500/20">
            <nav className="flex flex-col space-y-2">
              {/* Link Wallet prompt (logged in but no wallet) */}
              {isConnected && !address && (
                <>
                  <button
                    onClick={() => {
                      openModal();
                      setMobileMenuOpen(false);
                    }}
                    className="px-4 py-3 text-sm bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/30 rounded-lg transition-all flex items-center space-x-3 text-orange-400 w-full text-left"
                  >
                    <span>🔗</span>
                    <span>Link Wallet to Continue</span>
                  </button>
                  <div className="border-t border-pink-500/20 my-2"></div>
                </>
              )}
              {/* User menu items (only when logged in with wallet) */}
              {isConnected && address && (
                <>
                  {userMenuItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 text-sm hover:bg-pink-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                          active
                            ? "text-pink-400 font-medium"
                            : "text-gray-300 hover:text-pink-400"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  {/* User Wallet - opens wallet provider's user profile/dashboard */}
                  <button
                    onClick={() => {
                      console.log("[Header Mobile] User Wallet clicked, openUserProfile:", typeof openUserProfile);
                      if (openUserProfile) {
                        openUserProfile();
                      } else {
                        console.log("[Header Mobile] openUserProfile not available, falling back to openModal");
                        openModal();
                      }
                      setMobileMenuOpen(false);
                    }}
                    className="px-4 py-3 text-sm hover:bg-pink-500/10 rounded-lg transition-all flex items-center space-x-3 text-gray-300 hover:text-pink-400 w-full text-left"
                  >
                    <span>👛</span>
                    <span>User Wallet</span>
                  </button>
                  {/* Sponsor Wallets link - only shown when sponsor wallet exists */}
                  {hasSponsorWallet && (
                    <Link
                      href="/wallet"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 text-sm hover:bg-pink-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                        isActive("/wallet")
                          ? "text-pink-400 font-medium"
                          : "text-gray-300 hover:text-pink-400"
                      }`}
                    >
                      <span>💰</span>
                      <span>Sponsor Wallets</span>
                    </Link>
                  )}
                  {/* Admin link - only shown for admin wallets */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 text-sm hover:bg-red-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                        isActive("/admin")
                          ? "text-red-400 font-medium"
                          : "text-gray-300 hover:text-red-400"
                      }`}
                    >
                      <span>🛡️</span>
                      <span>Admin</span>
                    </Link>
                  )}
                  <div className="border-t border-pink-500/20 my-2"></div>
                </>
              )}

              {/* Main navigation items */}
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 text-sm hover:bg-pink-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                      active
                        ? "text-pink-400 font-medium"
                        : "text-gray-300 hover:text-pink-400"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
