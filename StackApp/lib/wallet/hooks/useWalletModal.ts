"use client";

/**
 * Unified Wallet Modal Hook
 *
 * Provides a unified interface for opening wallet connection/auth modals
 * across different providers (Para, Dynamic, Privy, etc.)
 *
 * @example
 * import { useWalletModal } from "@/lib/wallet";
 *
 * function ConnectButton() {
 *   const { openModal } = useWalletModal();
 *   return <button onClick={openModal}>Connect Wallet</button>;
 * }
 */

import { useWalletContext } from "../context";
import type { IWalletModal } from "../interfaces";

/**
 * Unified wallet modal hook
 *
 * Returns modal control functions from the active wallet provider.
 * The actual implementation is provided by the WalletContext.
 */
export function useWalletModal(): IWalletModal {
  const context = useWalletContext();

  return {
    openModal: context.openModal,
    closeModal: context.closeModal,
    isOpen: undefined, // Not all providers expose this
  };
}

export default useWalletModal;
