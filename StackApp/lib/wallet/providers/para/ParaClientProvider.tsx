"use client";

/**
 * Para Client Provider
 *
 * Wraps Para SDK and provides wallet state to the unified WalletContext.
 * This component handles the Para-specific hook integration.
 */

import React, { useCallback, useMemo, type ReactNode } from "react";
import { ParaProvider, Environment, useModal, useAccount, useWallet, useLogout } from "@getpara/react-sdk";
import "@getpara/react-sdk/styles.css";
import { arbitrum, base, celo, mainnet, optimism, polygon, avalanche } from "wagmi/chains";
import { WalletContextProvider, type WalletContextValue } from "../../context/WalletContext";
import { getWalletConfig } from "../../config";
import { paraModalTheme } from "@/lib/theme";

/**
 * Inner provider that uses Para hooks and provides to WalletContext
 */
function ParaWalletBridge({ children }: { children: ReactNode }) {
  const { openModal } = useModal();
  const { data: wallet, isLoading } = useWallet();
  const { isConnected } = useAccount();
  const { logout } = useLogout();

  const address = wallet?.address as `0x${string}` | undefined;

  const disconnect = useCallback(async () => {
    await logout();
  }, [logout]);

  const contextValue: WalletContextValue = useMemo(
    () => ({
      provider: "para",
      isConnected,
      isLoading,
      address,
      chainId: undefined, // Para doesn't expose chainId directly
      openModal,
      disconnect,
      error: null,
    }),
    [isConnected, isLoading, address, openModal, disconnect]
  );

  return <WalletContextProvider value={contextValue}>{children}</WalletContextProvider>;
}

/**
 * Para Client Provider Props
 */
export interface ParaClientProviderProps {
  children: ReactNode;
}

/**
 * Para Client Provider
 *
 * Wraps children with Para SDK provider and bridges to unified WalletContext
 */
export function ParaClientProvider({ children }: ParaClientProviderProps) {
  const config = getWalletConfig();
  const isProduction = config.environment === "production";

  if (!config.apiKey) {
    console.warn("[ParaClientProvider] NEXT_PUBLIC_PARA_API_KEY not configured");
    // Return children with disconnected context
    const disconnectedValue: WalletContextValue = {
      provider: "para",
      isConnected: false,
      isLoading: false,
      address: undefined,
      openModal: () => console.warn("Para not configured"),
      disconnect: async () => {},
      error: new Error("Para API key not configured"),
    };
    return <WalletContextProvider value={disconnectedValue}>{children}</WalletContextProvider>;
  }

  // Theme configuration from centralized theme (lib/theme/index.ts)
  // To change Para modal theme, update paraModalTheme in lib/theme/index.ts

  return (
    <ParaProvider
      paraClientConfig={{
        apiKey: config.apiKey,
        env: isProduction ? Environment.PRODUCTION : Environment.BETA,
      }}
      config={{
        appName: config.client.appName,
      }}
      externalWalletConfig={{
        wallets: config.client.externalWallets as ("METAMASK" | "PHANTOM")[],
        evmConnector: {
          config: {
            chains: [mainnet, base, celo, optimism, arbitrum, polygon, avalanche],
          },
        },
        walletConnect: {
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
        },
      }}
      paraModalConfig={{
        logo: "https://stack.perkos.xyz/logo.png",
        theme: paraModalTheme,
        oAuthMethods: config.client.oAuthMethods as ("GOOGLE" | "TWITTER" | "DISCORD")[],
        authLayout: ["EXTERNAL:FULL", "AUTH:FULL"],
        recoverySecretStepEnabled: true,
        onRampTestMode: !isProduction,
      }}
    >
      <ParaWalletBridge>{children}</ParaWalletBridge>
    </ParaProvider>
  );
}

export default ParaClientProvider;
