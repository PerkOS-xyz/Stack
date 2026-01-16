"use client";

/**
 * Unified Wallet Provider Hook
 *
 * Provides wallet connection state and actions regardless of the underlying provider.
 * Uses the WalletContext which is populated by the active provider (Para, Dynamic, etc.)
 *
 * @example
 * import { useWalletProvider } from "@/lib/wallet";
 *
 * function MyComponent() {
 *   const { isConnected, address, disconnect } = useWalletProvider();
 *
 *   if (!isConnected) {
 *     return <div>Please connect your wallet</div>;
 *   }
 *
 *   return (
 *     <div>
 *       Connected: {address}
 *       <button onClick={disconnect}>Disconnect</button>
 *     </div>
 *   );
 * }
 */

import { useWalletContext } from "../context";
import type { WalletData, IWalletProvider, WalletProviderType } from "../interfaces";

/**
 * Hook return type combining provider state and wallet data
 */
export interface UseWalletProviderReturn extends IWalletProvider {
  /** Current provider name */
  provider: WalletProviderType;

  /** Wallet data object for convenience */
  wallet: WalletData;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;
}

/**
 * Unified wallet provider hook
 *
 * Returns connection state and actions from the active wallet provider.
 * The actual implementation is provided by the WalletContext, which is
 * set up by the active provider (Para, Dynamic, etc.)
 */
export function useWalletProvider(): UseWalletProviderReturn {
  const context = useWalletContext();

  return {
    // Provider info
    provider: context.provider,

    // Connection state
    isConnected: context.isConnected,
    isLoading: context.isLoading,
    address: context.address,
    chainId: context.chainId,

    // Wallet data object
    wallet: {
      address: context.address,
      chainId: context.chainId,
      isConnected: context.isConnected,
    },

    // Actions
    connect: context.openModal,
    disconnect: context.disconnect,
    switchChain: context.switchChain,

    // Error state
    error: context.error,
  };
}

/**
 * Simplified hook that only returns wallet data
 *
 * Use this when you only need the wallet address/connection state,
 * not the full set of actions.
 *
 * @example
 * const { address, isConnected } = useWalletData();
 */
export function useWalletData(): WalletData {
  const context = useWalletContext();

  return {
    address: context.address,
    chainId: context.chainId,
    isConnected: context.isConnected,
  };
}

export default useWalletProvider;
