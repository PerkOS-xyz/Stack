"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton, useActiveAccount, darkTheme } from "thirdweb/react";
import { client, chains } from "@/lib/config/thirdweb";
import { inAppWallet, createWallet } from "thirdweb/wallets";

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

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", requiresAuth: true },
  { href: "/networks", label: "Networks", icon: "🌐" },
  { href: "/transactions", label: "Transactions", icon: "💸" },
  { href: "/marketplace", label: "Marketplace", icon: "🏪" },
  { href: "/agents", label: "Agents", icon: "👥" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const account = useActiveAccount();
  const pathname = usePathname();

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
              // Skip auth-required items if not connected
              if (item.requiresAuth && !account) return null;

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

          {/* Right Side - Connect */}
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
            connectModal={{
              size: "wide",
              title: "Sign In to Stack",
              welcomeScreen: {
                title: "Stack Middleware",
                subtitle: "Multi-chain x402 payment infrastructure",
              },
              showThirdwebBranding: false,
            }}
          />
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-blue-500/20">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => {
                // Skip auth-required items if not connected
                if (item.requiresAuth && !account) return null;

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
