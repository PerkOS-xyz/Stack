"use client";

/**
 * Unified Wallet Provider
 *
 * Automatically selects the appropriate wallet provider based on the
 * NEXT_PUBLIC_WALLET_PROVIDER environment variable.
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
import { ACTIVE_PROVIDER, logWalletConfig } from "./config";
import { ParaClientProvider } from "./providers/para/ParaClientProvider";
import { DynamicClientProvider } from "./providers/dynamic/DynamicClientProvider";

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
      // Privy not yet implemented
      console.error("[WalletProvider] Privy provider not yet implemented");
      return <ParaClientProvider>{children}</ParaClientProvider>;

    default:
      console.error(`[WalletProvider] Unknown provider: ${ACTIVE_PROVIDER}, falling back to Para`);
      return <ParaClientProvider>{children}</ParaClientProvider>;
  }
}

export default WalletProvider;
