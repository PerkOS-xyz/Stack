"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect, darkTheme } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

// Define wallets outside component to avoid hoisting issues
const supportedWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("app.phantom"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: ["email", "google", "apple", "facebook", "discord", "telegram", "phone"],
    },
  }),
].filter(wallet => wallet && typeof wallet === 'object');

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
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch ENS name and avatar when account changes
  useEffect(() => {
    async function fetchEnsData() {
      if (!account?.address) {
        setEnsName(null);
        setEnsAvatar(null);
        return;
      }
      try {
        // Reverse lookup ENS name
        const name = await ensClient.getEnsName({
          address: account.address as `0x${string}`,
        });
        setEnsName(name);

        // If we have an ENS name, try to get the avatar
        if (name) {
          try {
            const avatar = await ensClient.getEnsAvatar({
              name: normalize(name),
            });
            setEnsAvatar(avatar);
          } catch (avatarError) {
            console.error("Failed to fetch ENS avatar:", avatarError);
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
  }, [account?.address]);

  // Fetch user profile avatar when account changes
  useEffect(() => {
    async function fetchUserAvatar() {
      if (!account?.address) {
        setUserAvatar(null);
        return;
      }
      try {
        const response = await fetch(`/api/profile?address=${account.address}`);
        if (response.ok) {
          const data = await response.json();
          setUserAvatar(data.profile?.avatar_url || null);
        }
      } catch (error) {
        console.error("Failed to fetch user avatar:", error);
      }
    }
    fetchUserAvatar();
  }, [account?.address]);

  // Check if user has a sponsor wallet
  useEffect(() => {
    async function checkSponsorWallet() {
      if (!account?.address) {
        setHasSponsorWallet(false);
        return;
      }
      try {
        const response = await fetch(`/api/sponsor/wallets?address=${account.address}`);
        if (response.ok) {
          const data = await response.json();
          setHasSponsorWallet(data.wallets && data.wallets.length > 0);
        }
      } catch (error) {
        console.error("Failed to check sponsor wallet:", error);
        setHasSponsorWallet(false);
      }
    }
    checkSponsorWallet();
  }, [account?.address]);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!account?.address) {
        setIsAdmin(false);
        return;
      }
      try {
        const response = await fetch(`/api/admin/verify?address=${account.address}`);
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
        setIsAdmin(false);
      }
    }
    checkAdminStatus();
  }, [account?.address]);

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
  const formatAddress = (address: string) => {
    return `${address.slice(0, 7)}...${address.slice(-5)}`;
  };

  // Get display name: ENS name or formatted address
  const getDisplayName = () => {
    if (ensName) return ensName;
    if (account?.address) return formatAddress(account.address);
    return "";
  };

  // Get avatar: profile avatar > ENS avatar > null
  const getAvatar = () => {
    return userAvatar || ensAvatar || null;
  };

  const isActive = (href: string) => pathname === href;

  return (
    <header className="border-b border-blue-500/20 backdrop-blur-sm bg-slate-950/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Hamburger Menu (mobile only) + Logo */}
          <div className="flex items-center space-x-3">
            {/* Hamburger Menu Button - visible on small screens */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10 rounded-lg transition-all"
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
              <img src="/logo.png" alt="Stack" className="w-10 h-10 rounded-lg" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Stack
                </h1>
                <p className="text-xs text-gray-400">Multi-Chain Payment Infrastructure</p>
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
                  className={`px-4 py-2 text-sm hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-2 ${
                    active
                      ? "text-cyan-400 font-medium"
                      : "text-gray-300 hover:text-cyan-400"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Side - User Menu or Connect Button */}
          {account ? (
            // Logged in - show custom user dropdown
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/30 rounded-lg transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                  {getAvatar() ? (
                    <img
                      src={getAvatar()!}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    account.address.slice(2, 4).toUpperCase()
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
                <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-blue-500/30 rounded-xl shadow-xl overflow-hidden z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-blue-500/20">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden flex-shrink-0">
                        {getAvatar() ? (
                          <img
                            src={getAvatar()!}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          account.address.slice(2, 4).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {ensName && (
                          <p className="text-sm text-gray-200 font-medium truncate">{ensName}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono truncate">{formatAddress(account.address)}</p>
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
                              ? "text-cyan-400 bg-cyan-500/10"
                              : "text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10"
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                    {/* Wallet link - only shown when sponsor wallet exists */}
                    {hasSponsorWallet && (
                      <Link
                        href="/wallet"
                        onClick={() => setUserMenuOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 text-sm transition-all ${
                          isActive("/wallet")
                            ? "text-cyan-400 bg-cyan-500/10"
                            : "text-gray-300 hover:text-cyan-400 hover:bg-blue-500/10"
                        }`}
                      >
                        <span>💰</span>
                        <span>Wallet</span>
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
                  <div className="border-t border-blue-500/20 py-2">
                    <button
                      onClick={() => {
                        if (wallet) {
                          disconnect(wallet);
                        }
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
          ) : (
            // Not logged in - show Thirdweb Connect button
            <ConnectButton
              client={client}
              chains={chains}
              wallets={supportedWallets}
              theme={darkTheme({
                colors: {
                  primaryButtonBg: "linear-gradient(to right, #3b82f6, #06b6d4)",
                  primaryButtonText: "#ffffff",
                },
              })}
              connectButton={{
                label: "Sign In",
                style: {
                  borderRadius: "8px",
                  fontWeight: "600",
                  padding: "8px 24px",
                },
              }}
              appMetadata={{
                name: "PerkOS Stack",
                logoUrl: "https://stack.perkos.xyz/logo.png",
                url: typeof window !== "undefined" ? window.location.origin : "",
              }}
              connectModal={{
                size: "wide",
                title: "Sign In to PerkOS Stack",
                welcomeScreen: {
                  title: "PerkOS Stack",
                  subtitle: "Multi-chain x402 payment infrastructure",
                  img: {
                    src: "https://stack.perkos.xyz/logo.png",
                    width: 150,
                    height: 150,
                  },
                },
                showThirdwebBranding: false,
              }}
            />
          )}
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-blue-500/20">
            <nav className="flex flex-col space-y-2">
              {/* User menu items (only when logged in) */}
              {account && (
                <>
                  {userMenuItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 text-sm hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                          active
                            ? "text-cyan-400 font-medium"
                            : "text-gray-300 hover:text-cyan-400"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  {/* Wallet link - only shown when sponsor wallet exists */}
                  {hasSponsorWallet && (
                    <Link
                      href="/wallet"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-3 text-sm hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                        isActive("/wallet")
                          ? "text-cyan-400 font-medium"
                          : "text-gray-300 hover:text-cyan-400"
                      }`}
                    >
                      <span>💰</span>
                      <span>Wallet</span>
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
                  <div className="border-t border-blue-500/20 my-2"></div>
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
                    className={`px-4 py-3 text-sm hover:bg-blue-500/10 rounded-lg transition-all flex items-center space-x-3 ${
                      active
                        ? "text-cyan-400 font-medium"
                        : "text-gray-300 hover:text-cyan-400"
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
