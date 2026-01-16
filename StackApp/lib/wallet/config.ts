/**
 * Wallet Provider Configuration
 *
 * Central configuration for wallet provider selection via environment variables.
 * Set NEXT_PUBLIC_WALLET_PROVIDER to switch between providers.
 *
 * @example .env configuration:
 * NEXT_PUBLIC_WALLET_PROVIDER=para      # Use Para SDK (default)
 * NEXT_PUBLIC_WALLET_PROVIDER=dynamic   # Use Dynamic SDK
 */

import type { WalletProviderType } from "./interfaces";

/**
 * Valid provider values
 */
const VALID_PROVIDERS: WalletProviderType[] = ["para", "dynamic", "privy"];

/**
 * Get the active wallet provider from environment
 * Reads from NEXT_PUBLIC_WALLET_PROVIDER, defaults to "para"
 */
export function getActiveProvider(): WalletProviderType {
  const envProvider = process.env.NEXT_PUBLIC_WALLET_PROVIDER?.toLowerCase() as WalletProviderType | undefined;

  if (envProvider && VALID_PROVIDERS.includes(envProvider)) {
    return envProvider;
  }

  // Default to "para" if not set or invalid
  return "para";
}

/**
 * Active wallet provider (cached for consistency)
 */
export const ACTIVE_PROVIDER: WalletProviderType = getActiveProvider();

/**
 * Provider-specific configuration
 */
export interface WalletProviderConfig {
  provider: WalletProviderType;

  // API Keys (from environment)
  apiKey: string;
  serverApiKey?: string;
  environment: "production" | "sandbox" | "beta" | "development";

  // Client-side options
  client: {
    appName: string;
    oAuthMethods: string[];
    externalWallets: string[];
    supportedChains: number[]; // Chain IDs
  };

  // Server-side options (for server wallet creation/signing)
  server: {
    enabled: boolean;
    supportsEVM: boolean;
    supportsSolana: boolean;
  };
}

/**
 * Supported chain IDs for wallet operations
 */
export const SUPPORTED_CHAIN_IDS = {
  // Mainnets
  ethereum: 1,
  base: 8453,
  optimism: 10,
  arbitrum: 42161,
  polygon: 137,
  avalanche: 43114,
  celo: 42220,
  // Testnets
  sepolia: 11155111,
  baseSepolia: 84532,
  avalancheFuji: 43113,
};

/**
 * Get current wallet provider configuration
 */
export function getWalletConfig(): WalletProviderConfig {
  const provider = ACTIVE_PROVIDER;

  const defaultChains = [
    SUPPORTED_CHAIN_IDS.ethereum,
    SUPPORTED_CHAIN_IDS.base,
    SUPPORTED_CHAIN_IDS.optimism,
    SUPPORTED_CHAIN_IDS.arbitrum,
    SUPPORTED_CHAIN_IDS.polygon,
    SUPPORTED_CHAIN_IDS.avalanche,
    SUPPORTED_CHAIN_IDS.celo,
  ];

  switch (provider) {
    case "para":
      return {
        provider: "para",
        apiKey: process.env.NEXT_PUBLIC_PARA_API_KEY || "",
        serverApiKey: process.env.PARA_SERVER_API_KEY,
        environment: process.env.NODE_ENV === "production" ? "production" : "beta",
        client: {
          appName: process.env.NEXT_PUBLIC_APP_NAME || "PerkOS Stack",
          oAuthMethods: ["GOOGLE", "TWITTER", "DISCORD"],
          externalWallets: ["METAMASK", "PHANTOM"],
          supportedChains: defaultChains,
        },
        server: {
          enabled: !!process.env.PARA_SERVER_API_KEY,
          supportsEVM: true,
          supportsSolana: true,
        },
      };

    case "dynamic":
      return {
        provider: "dynamic",
        apiKey: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "",
        serverApiKey: process.env.DYNAMIC_API_KEY,
        environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
        client: {
          appName: process.env.NEXT_PUBLIC_APP_NAME || "PerkOS Stack",
          oAuthMethods: ["google", "twitter", "discord"],
          externalWallets: ["metamask", "phantom", "walletconnect"],
          supportedChains: defaultChains,
        },
        server: {
          // Dynamic uses Turnkey for embedded wallet signing
          enabled: !!process.env.DYNAMIC_API_KEY && !!process.env.TURNKEY_API_PRIVATE_KEY,
          supportsEVM: true,
          supportsSolana: true,
        },
      };

    case "privy":
      return {
        provider: "privy",
        apiKey: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
        serverApiKey: process.env.PRIVY_APP_SECRET,
        environment: process.env.NODE_ENV === "production" ? "production" : "development",
        client: {
          appName: process.env.NEXT_PUBLIC_APP_NAME || "PerkOS Stack",
          oAuthMethods: ["google", "twitter", "discord"],
          externalWallets: ["metamask"],
          supportedChains: defaultChains,
        },
        server: {
          enabled: !!process.env.PRIVY_APP_SECRET,
          supportsEVM: true,
          supportsSolana: false,
        },
      };

    default:
      throw new Error(`Unknown wallet provider: ${provider}`);
  }
}

/**
 * Check if server wallet features are available for the active provider
 */
export function isServerWalletEnabled(): boolean {
  return getWalletConfig().server.enabled;
}

/**
 * Check if the provider supports a specific network type
 */
export function supportsNetwork(networkType: "evm" | "solana"): boolean {
  const config = getWalletConfig();
  return networkType === "evm" ? config.server.supportsEVM : config.server.supportsSolana;
}

/**
 * Validate that required environment variables are set for the active provider
 * Call this at app startup to fail fast on misconfiguration
 */
export function validateWalletConfig(): { valid: boolean; errors: string[] } {
  const config = getWalletConfig();
  const errors: string[] = [];

  // Check client API key
  if (!config.apiKey) {
    errors.push(`Missing API key for ${config.provider}: ${getApiKeyEnvName(config.provider)}`);
  }

  // Check server API key if server features are expected
  if (process.env.NEXT_PUBLIC_ENABLE_SPONSOR_WALLETS === "true" && !config.server.enabled) {
    errors.push(
      `Server wallet features enabled but ${config.provider} server API key not configured`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the environment variable name for the API key based on provider
 */
function getApiKeyEnvName(provider: WalletProviderType): string {
  switch (provider) {
    case "para":
      return "NEXT_PUBLIC_PARA_API_KEY";
    case "dynamic":
      return "NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID";
    case "privy":
      return "NEXT_PUBLIC_PRIVY_APP_ID";
    default:
      return "UNKNOWN_API_KEY";
  }
}

/**
 * Debug: Log current wallet configuration (safe for client-side)
 */
export function logWalletConfig(): void {
  const config = getWalletConfig();
  console.log("[WalletConfig]", {
    provider: config.provider,
    environment: config.environment,
    hasApiKey: !!config.apiKey,
    serverEnabled: config.server.enabled,
    supportedChains: config.client.supportedChains.length,
  });
}
