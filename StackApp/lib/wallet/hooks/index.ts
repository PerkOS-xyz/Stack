/**
 * Abstracted wallet hooks
 *
 * These hooks provide a unified interface for wallet operations
 * across different providers (Para, Dynamic, Privy, etc.)
 *
 * @example
 * import { useWalletProvider, useWalletModal } from "@/lib/wallet/hooks";
 *
 * function MyComponent() {
 *   const { isConnected, address, disconnect } = useWalletProvider();
 *   const { openModal } = useWalletModal();
 *
 *   if (!isConnected) {
 *     return <button onClick={openModal}>Connect</button>;
 *   }
 *
 *   return <div>Connected: {address}</div>;
 * }
 */

export { useWalletProvider, useWalletData, type UseWalletProviderReturn } from "./useWalletProvider";
export { useWalletModal } from "./useWalletModal";
export { useWalletClient, type UseWalletClientConfig, type UseWalletClientReturn } from "./useWalletClient";
export {
  useSignTypedData,
  type SignTypedDataParams,
  type UseSignTypedDataReturn,
} from "./useSignTypedData";
