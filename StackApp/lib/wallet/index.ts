/**
 * Wallet Abstraction Layer
 *
 * Provides a unified interface for wallet operations across different providers
 * (Para, Dynamic, Privy, etc.)
 *
 * Set the wallet provider via environment variable:
 *   NEXT_PUBLIC_WALLET_PROVIDER=para     # Default
 *   NEXT_PUBLIC_WALLET_PROVIDER=dynamic  # Use Dynamic SDK
 *
 * IMPORTANT: This file exports BOTH client and server code.
 * - For client-side code (React components), use: import from "@/lib/wallet/client"
 * - For server-side code (API routes), use: import from "@/lib/wallet/server"
 *
 * @example Client-side usage:
 * ```tsx
 * // In providers.tsx
 * import { WalletProvider } from "@/lib/wallet/client";
 *
 * export function Providers({ children }) {
 *   return <WalletProvider>{children}</WalletProvider>;
 * }
 *
 * // In components
 * import { useWalletProvider, useWalletModal, useSignTypedData } from "@/lib/wallet/client";
 *
 * function ConnectButton() {
 *   const { isConnected, address, disconnect } = useWalletProvider();
 *   const { openModal } = useWalletModal();
 *
 *   if (!isConnected) {
 *     return <button onClick={openModal}>Connect</button>;
 *   }
 *   return <button onClick={disconnect}>Disconnect {address}</button>;
 * }
 *
 * // For EIP-712 signing
 * function PaymentComponent() {
 *   const { signTypedData, isReady, isSigning } = useSignTypedData();
 *
 *   const handlePayment = async () => {
 *     const signature = await signTypedData({
 *       domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: "0x..." },
 *       types: { Transfer: [{ name: "from", type: "address" }, ...] },
 *       primaryType: "Transfer",
 *       message: { from: "0x...", to: "0x...", value: "1000000" },
 *     });
 *   };
 * }
 * ```
 *
 * @example Server-side usage:
 * ```ts
 * import { getServerWalletService } from "@/lib/wallet/server";
 *
 * const walletService = await getServerWalletService();
 * const wallet = await walletService.createWallet(userId, "evm");
 * const signer = await walletService.getSigner(wallet.walletId, rpcUrl, wallet.keyMaterial);
 * ```
 */

// Interfaces (client-safe)
export * from "./interfaces";

// Configuration (client-safe)
export {
  ACTIVE_PROVIDER,
  getActiveProvider,
  getWalletConfig,
  isServerWalletEnabled,
  supportsNetwork,
  validateWalletConfig,
  logWalletConfig,
  SUPPORTED_CHAIN_IDS,
  type WalletProviderConfig,
} from "./config";

// Client-side provider (use in app/providers.tsx)
export { WalletProvider, type WalletProviderProps } from "./WalletProvider";

// Client-side context
export { useWalletContext, type WalletContextValue } from "./context";

// Client-side hooks (use in React components)
export {
  useWalletProvider,
  useWalletData,
  useWalletModal,
  useWalletClient,
  useSignTypedData,
  type UseWalletProviderReturn,
  type UseWalletClientConfig,
  type UseWalletClientReturn,
  type SignTypedDataParams,
  type UseSignTypedDataReturn,
} from "./hooks";

// Client-side provider components (for advanced usage)
// Import these directly from specific files to avoid bundling server code
export { ParaClientProvider } from "./providers/para/ParaClientProvider";
export { DynamicClientProvider } from "./providers/dynamic/DynamicClientProvider";

/**
 * NOTE: Server-side exports have been moved to "@/lib/wallet/server"
 * to prevent native Node.js modules from being bundled in client code.
 *
 * For server-side wallet operations, use:
 *   import { getServerWalletService } from "@/lib/wallet/server";
 */
