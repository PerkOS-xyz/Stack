"use client";

/**
 * useSignTypedData Hook
 *
 * Provides unified EIP-712 typed data signing across all wallet providers.
 * Handles provider-specific differences and provides consistent error handling.
 *
 * @example
 * import { useSignTypedData } from "@/lib/wallet";
 *
 * function PaymentComponent() {
 *   const { signTypedData, isReady, error } = useSignTypedData();
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
 */

import { useState, useCallback, useMemo } from "react";
import {
  createWalletClient,
  custom,
  type WalletClient,
  type Chain,
  type TypedDataDomain,
  type TypedDataParameter,
} from "viem";
import { ACTIVE_PROVIDER } from "../config";
import { useWalletContext } from "../context/WalletContext";

/**
 * EIP-712 typed data parameters for signing
 */
export interface SignTypedDataParams {
  /** EIP-712 domain */
  domain: TypedDataDomain;
  /** Type definitions */
  types: Record<string, readonly TypedDataParameter[]>;
  /** The primary type being signed */
  primaryType: string;
  /** The message data to sign */
  message: Record<string, unknown>;
}

/**
 * Return type for useSignTypedData hook
 */
export interface UseSignTypedDataReturn {
  /** Sign typed data according to EIP-712 */
  signTypedData: (params: SignTypedDataParams) => Promise<`0x${string}`>;
  /** Whether signing is ready */
  isReady: boolean;
  /** Whether signing is currently in progress */
  isSigning: boolean;
  /** Current error if any */
  error: Error | null;
  /** Clear any existing error */
  clearError: () => void;
  /** The active wallet provider */
  provider: typeof ACTIVE_PROVIDER;
}

// Provider-specific SDK hooks (lazy loaded based on provider)
let useViemClientPara: ((config: {
  address?: `0x${string}`;
  walletClientConfig?: { chain: Chain; transport: ReturnType<typeof import("viem").http> };
}) => {
  viemClient: { account: { signTypedData: (params: SignTypedDataParams) => Promise<`0x${string}`> } } | null;
  isLoading: boolean;
}) | null = null;

let useDynamicContextDynamic: (() => {
  primaryWallet: {
    address?: string;
    // Direct wallet signing method (Dynamic SDK v2+)
    signTypedData?: (params: {
      domain: TypedDataDomain;
      types: Record<string, readonly TypedDataParameter[]>;
      message: Record<string, unknown>;
      primaryType: string;
    }) => Promise<string>;
    connector?: {
      getWalletClient?: () => Promise<WalletClient>;
      getSigner?: () => Promise<{ signTypedData: (domain: object, types: object, value: object) => Promise<string> }>;
    };
  } | null;
}) | null = null;

// Dynamic imports based on provider
if (typeof window !== "undefined") {
  if (ACTIVE_PROVIDER === "para") {
    try {
      const paraSdk = require("@getpara/react-sdk/evm/hooks");
      useViemClientPara = paraSdk.useViemClient;
    } catch (e) {
      console.warn("[useSignTypedData] Para SDK hooks not available");
    }
  } else if (ACTIVE_PROVIDER === "dynamic") {
    try {
      const dynamicSdk = require("@dynamic-labs/sdk-react-core");
      useDynamicContextDynamic = dynamicSdk.useDynamicContext;
    } catch (e) {
      console.warn("[useSignTypedData] Dynamic SDK not available");
    }
  }
}

/**
 * Hook for signing EIP-712 typed data
 *
 * Provides a unified interface across:
 * - Para SDK (uses viemClient.account.signTypedData)
 * - Dynamic SDK (uses connector.getWalletClient or connector.getSigner)
 * - External wallets (MetaMask, etc. via window.ethereum)
 *
 * @param chain - Optional chain for HTTP transport configuration
 */
export function useSignTypedData(chain?: Chain): UseSignTypedDataReturn {
  const { isConnected, address } = useWalletContext();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Para SDK client (only initialized for Para provider)
  const paraClient = useViemClientPara
    ? useViemClientPara({
        address,
        walletClientConfig: chain
          ? {
              chain,
              transport: require("viem").http(),
            }
          : undefined,
      })
    : { viemClient: null, isLoading: false };

  // Dynamic SDK context (only initialized for Dynamic provider)
  const dynamicContext = useDynamicContextDynamic
    ? useDynamicContextDynamic()
    : { primaryWallet: null };

  /**
   * Clear any existing error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Sign typed data using the appropriate provider
   */
  const signTypedData = useCallback(
    async (params: SignTypedDataParams): Promise<`0x${string}`> => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      setIsSigning(true);
      setError(null);

      try {
        // 1. Try Para SDK (viemClient.account.signTypedData)
        if (ACTIVE_PROVIDER === "para" && paraClient.viemClient?.account) {
          console.log("[useSignTypedData] Using Para SDK account signing");
          const signature = await paraClient.viemClient.account.signTypedData(params);
          return signature;
        }

        // 2. Try Dynamic SDK
        if (ACTIVE_PROVIDER === "dynamic" && dynamicContext.primaryWallet) {
          const wallet = dynamicContext.primaryWallet;

          // 2a. Try direct wallet.signTypedData (Dynamic SDK v2+ preferred method)
          if ("signTypedData" in wallet && typeof wallet.signTypedData === "function") {
            console.log("[useSignTypedData] Using Dynamic SDK wallet.signTypedData");
            try {
              const signature = await wallet.signTypedData({
                domain: params.domain,
                types: params.types,
                primaryType: params.primaryType,
                message: params.message,
              });
              return signature as `0x${string}`;
            } catch (directError) {
              console.warn("[useSignTypedData] Dynamic wallet signTypedData failed:", directError);
              // Fall through to try connector methods
            }
          }

          // 2b. Try connector.getWalletClient (viem-compatible)
          const connector = wallet.connector;
          if (connector && "getWalletClient" in connector && typeof connector.getWalletClient === "function") {
            console.log("[useSignTypedData] Using Dynamic SDK connector wallet client");
            try {
              const walletClient = await connector.getWalletClient();
              if (walletClient) {
                const signature = await walletClient.signTypedData({
                  account: address,
                  domain: params.domain,
                  types: params.types,
                  primaryType: params.primaryType,
                  message: params.message,
                });
                return signature;
              }
            } catch (dynamicError) {
              console.warn("[useSignTypedData] Dynamic wallet client signing failed:", dynamicError);
              // Fall through to try other methods
            }
          }

          // 2c. Try getSigner (ethers-compatible, some Dynamic connectors)
          if (connector && "getSigner" in connector && typeof connector.getSigner === "function") {
            console.log("[useSignTypedData] Using Dynamic SDK ethers signer");
            try {
              const signer = await connector.getSigner();
              if (signer && "_signTypedData" in signer && typeof signer._signTypedData === "function") {
                // ethers.js style signing
                const signature = await (signer as { _signTypedData: (d: object, t: object, v: object) => Promise<string> })._signTypedData(
                  params.domain,
                  params.types,
                  params.message
                );
                return signature as `0x${string}`;
              }
            } catch (signerError) {
              console.warn("[useSignTypedData] Dynamic signer signing failed:", signerError);
              // Fall through to external wallet
            }
          }
        }

        // 3. Fall back to external wallet (window.ethereum)
        if (typeof window !== "undefined" && (window as unknown as { ethereum?: object }).ethereum) {
          console.log("[useSignTypedData] Using external wallet (window.ethereum)");
          const ethereum = (window as unknown as {
            ethereum: {
              request: (args: { method: string; params: unknown[] }) => Promise<string>;
            };
          }).ethereum;

          // Use eth_signTypedData_v4 for EIP-712
          const typedData = {
            types: {
              EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
              ],
              ...params.types,
            },
            primaryType: params.primaryType,
            domain: params.domain,
            message: params.message,
          };

          const signature = await ethereum.request({
            method: "eth_signTypedData_v4",
            params: [address, JSON.stringify(typedData)],
          });

          return signature as `0x${string}`;
        }

        // 4. No signing method available
        throw new Error(
          `No signing method available. Provider: ${ACTIVE_PROVIDER}, ` +
            `Para client: ${!!paraClient.viemClient}, ` +
            `Dynamic wallet: ${!!dynamicContext.primaryWallet}, ` +
            `External wallet: ${typeof window !== "undefined" && !!(window as unknown as { ethereum?: object }).ethereum}`
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsSigning(false);
      }
    },
    [isConnected, address, paraClient.viemClient, dynamicContext.primaryWallet]
  );

  /**
   * Determine if signing is ready
   */
  const isReady = useMemo(() => {
    if (!isConnected || !address) {
      return false;
    }

    // Check Para SDK
    if (ACTIVE_PROVIDER === "para") {
      if (paraClient.isLoading) return false;
      if (paraClient.viemClient?.account) return true;
    }

    // Check Dynamic SDK
    if (ACTIVE_PROVIDER === "dynamic") {
      const wallet = dynamicContext.primaryWallet;
      // Check for direct signTypedData or connector
      if (wallet && ("signTypedData" in wallet || wallet.connector)) return true;
    }

    // Check external wallet
    if (typeof window !== "undefined" && (window as unknown as { ethereum?: object }).ethereum) {
      return true;
    }

    return false;
  }, [
    isConnected,
    address,
    paraClient.viemClient,
    paraClient.isLoading,
    dynamicContext.primaryWallet,
  ]);

  return {
    signTypedData,
    isReady,
    isSigning,
    error,
    clearError,
    provider: ACTIVE_PROVIDER,
  };
}

export default useSignTypedData;
