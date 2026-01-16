"use client";

/**
 * Unified Wallet Context
 *
 * Provides wallet state and actions regardless of the underlying provider.
 * The provider is selected based on NEXT_PUBLIC_WALLET_PROVIDER environment variable.
 *
 * @example
 * import { useWalletContext } from "@/lib/wallet/context";
 *
 * function MyComponent() {
 *   const { isConnected, address, openModal, disconnect } = useWalletContext();
 *   // ...
 * }
 */

import React, { createContext, useContext, type ReactNode } from "react";
import type { WalletProviderType } from "../interfaces";

/**
 * Wallet context value interface
 *
 * Supports both EVM addresses (0x prefixed) and Solana addresses (base58 encoded)
 */
export interface WalletContextValue {
  // Provider Info
  provider: WalletProviderType;

  // Connection State
  isConnected: boolean;
  isLoading: boolean;
  // EVM addresses start with 0x, Solana addresses are base58 encoded
  address: `0x${string}` | string | undefined;
  chainId?: number;

  // Actions
  openModal: () => void;
  closeModal?: () => void;
  openUserProfile?: () => void; // Opens user wallet dashboard (for connected users)
  disconnect: () => Promise<void>;
  switchChain?: (chainId: number) => Promise<void>;

  // Error State
  error: Error | null;
}

/**
 * Default context value (disconnected state)
 */
const defaultContextValue: WalletContextValue = {
  provider: "para",
  isConnected: false,
  isLoading: false,
  address: undefined,
  chainId: undefined,
  openModal: () => {
    console.warn("[WalletContext] openModal called but no provider initialized");
  },
  disconnect: async () => {
    console.warn("[WalletContext] disconnect called but no provider initialized");
  },
  error: null,
};

/**
 * Wallet Context
 */
export const WalletContext = createContext<WalletContextValue>(defaultContextValue);

/**
 * Hook to access wallet context
 * Returns default disconnected state if used outside WalletProvider
 * This allows components to render without wallet functionality in public pages
 */
export function useWalletContext(): WalletContextValue {
  const context = useContext(WalletContext);
  // Return default context if not within provider (for public pages without wallet)
  return context || defaultContextValue;
}

/**
 * Props for WalletContextProvider
 */
export interface WalletContextProviderProps {
  children: ReactNode;
  value: WalletContextValue;
}

/**
 * Context provider wrapper (used internally by provider implementations)
 */
export function WalletContextProvider({ children, value }: WalletContextProviderProps) {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export default WalletContext;
