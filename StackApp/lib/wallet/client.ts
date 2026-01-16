/**
 * Wallet Abstraction Layer - Client-Side Exports
 *
 * Use this import for client-side React components.
 * For server-side usage, import from "@/lib/wallet/server" instead.
 *
 * @example
 * ```tsx
 * // In providers.tsx or components
 * import { WalletProvider, useWalletContext, ACTIVE_PROVIDER } from "@/lib/wallet/client";
 * ```
 */

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
export { ParaClientProvider } from "./providers/para/ParaClientProvider";
export { DynamicClientProvider } from "./providers/dynamic/DynamicClientProvider";
