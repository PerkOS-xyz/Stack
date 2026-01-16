/**
 * Client-side wallet provider interface
 *
 * This interface abstracts wallet connection, authentication, and state management
 * to enable swapping between different wallet providers (Para, Dynamic, Privy, etc.)
 */

export interface WalletData {
  address: `0x${string}` | undefined;
  chainId?: number;
  isConnected: boolean;
  walletType?: "EVM" | "SOLANA";
}

/**
 * Core wallet provider interface for client-side wallet management
 */
export interface IWalletProvider {
  // Connection State
  isConnected: boolean;
  address: `0x${string}` | undefined;
  chainId?: number;

  // Connection Actions
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Chain Management (optional)
  switchChain?(chainId: number): Promise<void>;

  // Loading State
  isLoading?: boolean;
  error?: Error | null;
}

/**
 * Modal control interface for authentication UI
 */
export interface IWalletModal {
  openModal(): void;
  closeModal?(): void;
  isOpen?: boolean;
}

/**
 * Combined hook return type for convenience
 */
export interface UseWalletReturn extends IWalletProvider, IWalletModal {
  // Shorthand for wallet data
  wallet: WalletData;
}

/**
 * Provider type for configuration
 */
export type WalletProviderType = "para" | "dynamic" | "privy" | "custom";
