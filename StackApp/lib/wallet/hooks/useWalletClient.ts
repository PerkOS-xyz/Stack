"use client";

/**
 * useWalletClient Hook
 *
 * Provides a viem-compatible wallet client for signing operations.
 * Automatically selects the appropriate implementation based on the active provider.
 *
 * @example
 * import { useWalletClient } from "@/lib/wallet";
 *
 * function PaymentComponent() {
 *   const { walletClient, isLoading, canSign } = useWalletClient({ chain });
 *
 *   if (canSign && walletClient) {
 *     const signature = await walletClient.signTypedData({...});
 *   }
 * }
 */

import { useState, useEffect, useMemo } from "react";
import {
  createWalletClient,
  custom,
  http,
  type WalletClient,
  type Chain,
  type Account,
} from "viem";
import { ACTIVE_PROVIDER } from "../config";
import { useWalletContext } from "../context/WalletContext";

// Provider-specific hooks (lazy loaded on client-side only)
type UseViemClientType = (config: { address?: `0x${string}`; walletClientConfig?: { chain: Chain; transport: ReturnType<typeof http> } }) => { viemClient: { account: Account } | null; isLoading: boolean };
type UseDynamicContextType = () => { primaryWallet: { connector?: { getWalletClient?: () => Promise<WalletClient> } } | null };

let useViemClientPara: UseViemClientType | null = null;
let useDynamicContextDynamic: UseDynamicContextType | null = null;
let sdkInitialized = false;

// Initialize SDK hooks only on client-side (avoid SSR issues with CJS/ESM)
function initializeProviderHooks() {
  if (sdkInitialized || typeof window === "undefined") return;
  sdkInitialized = true;

  if (ACTIVE_PROVIDER === "para") {
    try {
      // Para SDK viem hook
      const paraSdk = require("@getpara/react-sdk/evm/hooks");
      useViemClientPara = paraSdk.useViemClient;
    } catch (e) {
      console.warn("[useWalletClient] Para SDK hooks not available");
    }
  } else if (ACTIVE_PROVIDER === "dynamic") {
    try {
      // Dynamic SDK context hook - use ESM import to avoid CJS issues
      const dynamicSdk = require("@dynamic-labs/sdk-react-core");
      useDynamicContextDynamic = dynamicSdk.useDynamicContext;
    } catch (e) {
      console.warn("[useWalletClient] Dynamic SDK not available");
    }
  }
}

/**
 * Configuration options for useWalletClient
 */
export interface UseWalletClientConfig {
  /** The chain to connect to */
  chain: Chain;
}

/**
 * Return type for useWalletClient hook
 */
export interface UseWalletClientReturn {
  /** Viem wallet client for signing operations */
  walletClient: WalletClient | null;
  /** Whether the client is currently loading */
  isLoading: boolean;
  /** Whether signing is possible */
  canSign: boolean;
  /** Whether this is an external wallet (MetaMask, etc.) */
  isExternalWallet: boolean;
  /** Account object for direct signing (Para SDK only) */
  account: Account | null;
}

/**
 * Hook to get a viem-compatible wallet client for signing
 *
 * Automatically selects the appropriate implementation:
 * - Para: Uses useViemClient from @getpara/react-sdk
 * - Dynamic: Uses primaryWallet.connector.getWalletClient()
 * - External: Falls back to window.ethereum
 */
export function useWalletClient(config: UseWalletClientConfig): UseWalletClientReturn {
  // Initialize provider hooks on first render (client-side only)
  initializeProviderHooks();

  const { chain } = config;
  const { isConnected, address } = useWalletContext();

  const [externalClient, setExternalClient] = useState<WalletClient | null>(null);
  const [dynamicClient, setDynamicClient] = useState<WalletClient | null>(null);
  const [isLoadingExternal, setIsLoadingExternal] = useState(false);
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);

  // Para SDK client
  const paraClient = useViemClientPara
    ? useViemClientPara({
        address,
        walletClientConfig: {
          chain,
          transport: http(),
        },
      })
    : { viemClient: null, isLoading: false };

  // Dynamic SDK client
  const dynamicContext = useDynamicContextDynamic ? useDynamicContextDynamic() : { primaryWallet: null };

  // Setup Dynamic wallet client
  useEffect(() => {
    async function setupDynamicClient() {
      if (ACTIVE_PROVIDER !== "dynamic" || !dynamicContext.primaryWallet?.connector) {
        setDynamicClient(null);
        return;
      }

      setIsLoadingDynamic(true);
      try {
        const connector = dynamicContext.primaryWallet.connector;
        if (connector && "getWalletClient" in connector && typeof connector.getWalletClient === "function") {
          const client = await connector.getWalletClient();
          setDynamicClient(client as WalletClient);
        } else {
          // Fallback: create client from connector's provider
          setDynamicClient(null);
        }
      } catch (error) {
        console.error("[useWalletClient] Error getting Dynamic wallet client:", error);
        setDynamicClient(null);
      } finally {
        setIsLoadingDynamic(false);
      }
    }

    setupDynamicClient();
  }, [dynamicContext.primaryWallet, chain]);

  // Check if using external wallet (no Para client and not Dynamic)
  const isParaWallet = ACTIVE_PROVIDER === "para" && !!paraClient.viemClient;
  const isDynamicWallet = ACTIVE_PROVIDER === "dynamic" && !!dynamicClient;
  const isExternalWallet = isConnected && !isParaWallet && !isDynamicWallet && !paraClient.isLoading && !isLoadingDynamic;

  // Setup external wallet client (MetaMask, etc.)
  useEffect(() => {
    async function setupExternalClient() {
      if (!isExternalWallet || !chain || !address) {
        setExternalClient(null);
        return;
      }

      if (typeof window === "undefined" || !(window as { ethereum?: object }).ethereum) {
        setExternalClient(null);
        return;
      }

      setIsLoadingExternal(true);
      try {
        const client = createWalletClient({
          chain,
          transport: custom((window as { ethereum: object }).ethereum),
          account: address,
        });
        setExternalClient(client);
      } catch (error) {
        console.error("[useWalletClient] Error creating external wallet client:", error);
        setExternalClient(null);
      } finally {
        setIsLoadingExternal(false);
      }
    }

    setupExternalClient();
  }, [isExternalWallet, chain, address]);

  // Determine the active wallet client
  const result = useMemo((): UseWalletClientReturn => {
    // Para SDK wallet
    if (ACTIVE_PROVIDER === "para" && paraClient.viemClient) {
      // Para's viemClient is an account, not a full WalletClient
      // Create a proper WalletClient for it
      const walletClient = createWalletClient({
        account: paraClient.viemClient.account,
        chain,
        transport: http(),
      });
      return {
        walletClient,
        account: paraClient.viemClient.account,
        isLoading: paraClient.isLoading,
        canSign: true,
        isExternalWallet: false,
      };
    }

    // Dynamic SDK wallet
    if (ACTIVE_PROVIDER === "dynamic" && dynamicClient) {
      return {
        walletClient: dynamicClient,
        account: null,
        isLoading: isLoadingDynamic,
        canSign: true,
        isExternalWallet: false,
      };
    }

    // External wallet (MetaMask, etc.)
    if (isExternalWallet && externalClient) {
      return {
        walletClient: externalClient,
        account: null,
        isLoading: isLoadingExternal,
        canSign: true,
        isExternalWallet: true,
      };
    }

    // Loading state
    const isLoading = paraClient.isLoading || isLoadingDynamic || isLoadingExternal;

    // Not connected or no client available
    return {
      walletClient: null,
      account: null,
      isLoading,
      canSign: false,
      isExternalWallet: false,
    };
  }, [
    paraClient.viemClient,
    paraClient.isLoading,
    dynamicClient,
    isLoadingDynamic,
    externalClient,
    isLoadingExternal,
    isExternalWallet,
    chain,
  ]);

  return result;
}

export default useWalletClient;
