"use client";

/**
 * Dynamic Client Provider
 *
 * Provides wallet authentication and connection via Dynamic SDK.
 * Dynamic offers 50+ wallet connections, social login, and embedded wallets.
 *
 * Required packages:
 *   npm install @dynamic-labs/sdk-react-core @dynamic-labs/ethereum @dynamic-labs/solana
 *
 * Required environment variables:
 *   NEXT_PUBLIC_WALLET_PROVIDER=dynamic
 *   NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your-environment-id
 *
 * @see https://docs.dynamic.xyz/ for Dynamic SDK documentation
 * @see https://www.dynamic.xyz/docs/wallets/overview
 */

import React, { type ReactNode } from "react";
import { WalletContextProvider, type WalletContextValue } from "../../context/WalletContext";
import { getWalletConfig } from "../../config";

// Dynamic SDK Imports
import {
  DynamicContextProvider,
  useDynamicContext,
  useUserWallets,
  type Wallet,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";

/**
 * Dynamic Wallet Bridge
 *
 * Bridges Dynamic SDK hooks to WalletContext.
 * Prioritizes EVM wallets over Solana for compatibility with ENS and other EVM services.
 */
function DynamicWalletBridge({ children }: { children: ReactNode }) {
  const {
    user,
    primaryWallet,
    handleLogOut,
    setShowAuthFlow,
    setShowDynamicUserProfile,
    sdkHasLoaded,
    network,
  } = useDynamicContext();

  // Get all connected wallets using the dedicated hook
  const userWallets = useUserWallets();

  const isAuthenticated = !!user;

  // Debug logging for connection state
  React.useEffect(() => {
    console.log("[DynamicWalletBridge] State:", {
      sdkHasLoaded,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.userId,
      primaryWalletAddress: primaryWallet?.address,
      primaryWalletChain: primaryWallet?.chain,
      userWalletsCount: userWallets?.length ?? 0,
      userWallets: userWallets?.map((w: Wallet) => ({
        address: w.address,
        chain: w.chain,
        connector: w.connector?.name,
      })),
      network,
    });
  }, [sdkHasLoaded, user, primaryWallet, userWallets, network, isAuthenticated]);

  // Prefer EVM wallet over Solana - filter connected wallets for EVM chain type
  // Dynamic SDK may select Solana as primary when both wallet types are connected
  const evmWallet = userWallets?.find(
    (wallet: Wallet) => wallet.chain === "evm" || wallet.address?.startsWith("0x")
  );

  // Determine the active wallet: prefer EVM, fall back to primary (which may be Solana)
  const activeWallet = evmWallet ?? primaryWallet;
  const walletAddress = activeWallet?.address;

  // For EVM addresses, cast to 0x prefixed type
  // For Solana addresses, keep as string (won't work with ENS but will show as connected)
  const isEvmAddress = walletAddress?.startsWith("0x") && walletAddress?.length === 42;
  const address: `0x${string}` | string | undefined = walletAddress
    ? (isEvmAddress ? (walletAddress as `0x${string}`) : walletAddress)
    : undefined;

  // Get chainId from network (for EVM) or activeWallet chain (for Solana it would be 101)
  const chainId = network
    ? parseInt(String(network), 10)
    : (activeWallet?.chain === "SOL" || activeWallet?.chain === "solana" ? 101 : undefined);

  // Debug final connection state
  React.useEffect(() => {
    console.log("[DynamicWalletBridge] Final state:", {
      evmWalletAddress: evmWallet?.address,
      evmWalletChain: evmWallet?.chain,
      activeWalletAddress: activeWallet?.address,
      activeWalletChain: activeWallet?.chain,
      finalAddress: address,
      chainId,
      willBeConnected: isAuthenticated && !!activeWallet && !!address,
    });
  }, [evmWallet, activeWallet, address, chainId, isAuthenticated]);

  const contextValue: WalletContextValue = {
    provider: "dynamic",
    // User is "connected" if authenticated, even without a wallet linked
    // This allows showing the user menu so they can link a wallet
    isConnected: isAuthenticated,
    isLoading: !sdkHasLoaded,
    address,
    chainId,
    openModal: () => setShowAuthFlow(true),
    closeModal: () => setShowAuthFlow(false),
    openUserProfile: () => setShowDynamicUserProfile(true),
    disconnect: async () => {
      try {
        await handleLogOut();
      } catch (error) {
        // Dynamic WaaS SDK throws "Auth token is required" error during logout
        // because the WaaS connector tries to end session after token is cleared.
        // This is expected behavior - the logout still completes successfully.
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Auth token is required")) {
          console.log("[DynamicClientProvider] Logout completed (WaaS session cleanup skipped)");
        } else {
          console.error("[DynamicClientProvider] Logout error:", error);
        }
      }
    },
    switchChain: async (newChainId: number) => {
      // Dynamic SDK handles chain switching via the EVM wallet
      const walletToSwitch = evmWallet ?? activeWallet;
      if (walletToSwitch && "switchNetwork" in walletToSwitch) {
        try {
          await (walletToSwitch as { switchNetwork: (chainId: number) => Promise<void> }).switchNetwork(newChainId);
        } catch (error) {
          console.error("[DynamicClientProvider] Switch chain error:", error);
        }
      }
    },
    error: null,
  };

  return (
    <WalletContextProvider value={contextValue}>
      {children}
    </WalletContextProvider>
  );
}

/**
 * Dynamic Client Provider Props
 */
export interface DynamicClientProviderProps {
  children: ReactNode;
}

/**
 * Dynamic Client Provider
 *
 * Wraps the Dynamic SDK and provides wallet state to WalletContext.
 */
export function DynamicClientProvider({ children }: DynamicClientProviderProps) {
  const config = getWalletConfig();

  // Check if Dynamic SDK is configured
  if (!config.apiKey) {
    console.error(
      "[DynamicClientProvider] NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID not configured"
    );
    // Return children without wallet functionality
    const errorValue: WalletContextValue = {
      provider: "dynamic",
      isConnected: false,
      isLoading: false,
      address: undefined,
      openModal: () => {
        console.error("[Dynamic] Environment ID not configured");
      },
      closeModal: () => {},
      openUserProfile: () => {
        console.error("[Dynamic] Environment ID not configured");
      },
      disconnect: async () => {},
      error: new Error("Dynamic environment ID not configured"),
    };
    return (
      <WalletContextProvider value={errorValue}>
        {children}
      </WalletContextProvider>
    );
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId: config.apiKey,
        walletConnectors: [
          EthereumWalletConnectors,
          SolanaWalletConnectors,
        ],
        // Social login providers (must also be enabled in Dynamic Dashboard)
        socialProvidersFilter: (providers) => providers,
        // EVM networks that x402 supports
        overrides: {
          evmNetworks: [
            // Base
            {
              chainId: 8453,
              networkId: 8453,
              name: "Base",
              vanityName: "Base",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_base.jpg"],
            },
            {
              chainId: 84532,
              networkId: 84532,
              name: "Base Sepolia",
              vanityName: "Base Sepolia",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.base.org"],
              blockExplorerUrls: ["https://sepolia.basescan.org"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_base.jpg"],
            },
            // Ethereum
            {
              chainId: 1,
              networkId: 1,
              name: "Ethereum",
              vanityName: "Ethereum",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://eth.llamarpc.com"],
              blockExplorerUrls: ["https://etherscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg"],
            },
            {
              chainId: 11155111,
              networkId: 11155111,
              name: "Sepolia",
              vanityName: "Sepolia",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg"],
            },
            // Polygon
            {
              chainId: 137,
              networkId: 137,
              name: "Polygon",
              vanityName: "Polygon",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com"],
              blockExplorerUrls: ["https://polygonscan.com"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_polygon.jpg"],
            },
            {
              chainId: 80002,
              networkId: 80002,
              name: "Polygon Amoy",
              vanityName: "Polygon Amoy",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://rpc-amoy.polygon.technology"],
              blockExplorerUrls: ["https://amoy.polygonscan.com"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_polygon.jpg"],
            },
            // Arbitrum
            {
              chainId: 42161,
              networkId: 42161,
              name: "Arbitrum One",
              vanityName: "Arbitrum",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://arb1.arbitrum.io/rpc"],
              blockExplorerUrls: ["https://arbiscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg"],
            },
            {
              chainId: 421614,
              networkId: 421614,
              name: "Arbitrum Sepolia",
              vanityName: "Arbitrum Sepolia",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
              blockExplorerUrls: ["https://sepolia.arbiscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg"],
            },
            // Optimism
            {
              chainId: 10,
              networkId: 10,
              name: "Optimism",
              vanityName: "Optimism",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.optimism.io"],
              blockExplorerUrls: ["https://optimistic.etherscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_optimism.jpg"],
            },
            {
              chainId: 11155420,
              networkId: 11155420,
              name: "Optimism Sepolia",
              vanityName: "OP Sepolia",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://sepolia.optimism.io"],
              blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_optimism.jpg"],
            },
            // Avalanche
            {
              chainId: 43114,
              networkId: 43114,
              name: "Avalanche C-Chain",
              vanityName: "Avalanche",
              nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
              rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
              blockExplorerUrls: ["https://snowtrace.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg"],
            },
            {
              chainId: 43113,
              networkId: 43113,
              name: "Avalanche Fuji",
              vanityName: "Fuji",
              nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
              rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
              blockExplorerUrls: ["https://testnet.snowtrace.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg"],
            },
            // Celo
            {
              chainId: 42220,
              networkId: 42220,
              name: "Celo",
              vanityName: "Celo",
              nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
              rpcUrls: ["https://forno.celo.org"],
              blockExplorerUrls: ["https://celoscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_celo.jpg"],
            },
            {
              chainId: 44787,
              networkId: 44787,
              name: "Celo Alfajores",
              vanityName: "Alfajores",
              nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
              rpcUrls: ["https://alfajores-forno.celo-testnet.org"],
              blockExplorerUrls: ["https://alfajores.celoscan.io"],
              iconUrls: ["https://icons.llamao.fi/icons/chains/rsz_celo.jpg"],
            },
          ],
        },
      }}
      theme="dark"
    >
      <DynamicWalletBridge>{children}</DynamicWalletBridge>
    </DynamicContextProvider>
  );
}

export default DynamicClientProvider;
