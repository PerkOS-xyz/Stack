"use client";

/**
 * Unified Wallet Provider
 *
 * Automatically selects the appropriate wallet provider based on the
 * NEXT_PUBLIC_WALLET_PROVIDER environment variable.
 *
 * Uses dynamic imports to only load the active provider's bundle,
 * significantly reducing initial JS load size.
 *
 * Supported providers:
 * - "para" (default): Para SDK
 * - "dynamic": Dynamic SDK (requires additional setup)
 *
 * @example
 * // In app/providers.tsx or layout.tsx
 * import { WalletProvider } from "@/lib/wallet";
 *
 * export function Providers({ children }) {
 *   return (
 *     <WalletProvider>
 *       {children}
 *     </WalletProvider>
 *   );
 * }
 */

import React, { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ACTIVE_PROVIDER, logWalletConfig } from "./config";

// Dynamic imports - only the active provider's bundle will be loaded
const ParaClientProvider = dynamic(
  () => import("./providers/para/ParaClientProvider").then((mod) => mod.ParaClientProvider),
  {
    ssr: false,
    loading: () => <WalletProviderSkeleton />,
  }
);

const DynamicClientProvider = dynamic(
  () => import("./providers/dynamic/DynamicClientProvider").then((mod) => mod.DynamicClientProvider),
  {
    ssr: false,
    loading: () => <WalletProviderSkeleton />,
  }
);

// Loading skeleton while provider loads
function WalletProviderSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <div className="animate-pulse">
        <div className="h-16 bg-slate-800/50" />
      </div>
    </div>
  );
}

/**
 * WalletProvider Props
 */
export interface WalletProviderProps {
  children: ReactNode;
}

/**
 * Unified Wallet Provider
 *
 * Wraps children with the appropriate wallet provider based on configuration.
 * The provider is selected based on NEXT_PUBLIC_WALLET_PROVIDER env var.
 * Uses dynamic imports for code splitting - only loads the active provider.
 */
export function WalletProvider({ children }: WalletProviderProps) {
  // Log configuration on mount (development only)
  if (process.env.NODE_ENV === "development") {
    logWalletConfig();
  }

  // Select provider based on configuration
  switch (ACTIVE_PROVIDER) {
    case "para":
      return <ParaClientProvider>{children}</ParaClientProvider>;

    case "dynamic":
      return <DynamicClientProvider>{children}</DynamicClientProvider>;

    case "privy":
      // Privy not yet implemented - fall back to Para
      if (process.env.NODE_ENV === "development") {
        console.warn("[WalletProvider] Privy provider not yet implemented");
      }
      return <ParaClientProvider>{children}</ParaClientProvider>;

    default:
      if (process.env.NODE_ENV === "development") {
        console.warn(`[WalletProvider] Unknown provider: ${ACTIVE_PROVIDER}, falling back to Para`);
      }
      return <ParaClientProvider>{children}</ParaClientProvider>;
  }
}

export default WalletProvider;
