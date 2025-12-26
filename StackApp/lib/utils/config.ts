import type { Address } from "../types/x402";

// Supported networks
export type SupportedNetwork =
  | "avalanche" | "avalanche-fuji"
  | "celo" | "celo-sepolia"
  | "base" | "base-sepolia"
  | "ethereum" | "sepolia"
  | "polygon" | "polygon-amoy"
  | "monad" | "monad-testnet"
  | "arbitrum" | "arbitrum-sepolia"
  | "optimism" | "optimism-sepolia";

export const config = {
  // Blockchain
  defaultNetwork: (process.env.NEXT_PUBLIC_DEFAULT_NETWORK || "avalanche") as SupportedNetwork,

  // RPC URLs
  rpcUrls: {
    avalanche: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    "avalanche-fuji": process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    celo: process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org",
    "celo-sepolia": process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL || "https://forno.celo-sepolia.celo-testnet.org",
    base: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
    "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
    ethereum: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    polygon: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com",
    "polygon-amoy": process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    monad: process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://rpc.monad.xyz",
    "monad-testnet": process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz",
    arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    "arbitrum-sepolia": process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    "optimism-sepolia": process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io",
  },

  privateKey: process.env.PRIVATE_KEY as Address | undefined,

  // x402 Payment Tokens (USDC addresses by network)
  paymentTokens: {
    avalanche: (process.env.NEXT_PUBLIC_AVALANCHE_PAYMENT_TOKEN || "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E") as Address,
    "avalanche-fuji": (process.env.NEXT_PUBLIC_AVALANCHE_FUJI_PAYMENT_TOKEN || "0x5425890298aed601595a70AB815c96711a31Bc65") as Address,
    celo: (process.env.NEXT_PUBLIC_CELO_PAYMENT_TOKEN || "0xcebA9300f2b948710d2653dD7B07f33A8B32118C") as Address,
    "celo-sepolia": (process.env.NEXT_PUBLIC_CELO_SEPOLIA_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    base: (process.env.NEXT_PUBLIC_BASE_PAYMENT_TOKEN || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as Address,
    "base-sepolia": (process.env.NEXT_PUBLIC_BASE_SEPOLIA_PAYMENT_TOKEN || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address,
    ethereum: (process.env.NEXT_PUBLIC_ETHEREUM_PAYMENT_TOKEN || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") as Address,
    sepolia: (process.env.NEXT_PUBLIC_SEPOLIA_PAYMENT_TOKEN || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as Address,
    polygon: (process.env.NEXT_PUBLIC_POLYGON_PAYMENT_TOKEN || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address,
    "polygon-amoy": (process.env.NEXT_PUBLIC_POLYGON_AMOY_PAYMENT_TOKEN || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582") as Address,
    monad: (process.env.NEXT_PUBLIC_MONAD_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    "monad-testnet": (process.env.NEXT_PUBLIC_MONAD_TESTNET_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    arbitrum: (process.env.NEXT_PUBLIC_ARBITRUM_PAYMENT_TOKEN || "0xaf88d065e77c8cC2239327C5EDb3A432268e5831") as Address,
    "arbitrum-sepolia": (process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_PAYMENT_TOKEN || "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d") as Address,
    optimism: (process.env.NEXT_PUBLIC_OPTIMISM_PAYMENT_TOKEN || "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85") as Address,
    "optimism-sepolia": (process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_PAYMENT_TOKEN || "0x5fd84259d66Cd46123540766Be93DFE6D43130D7") as Address,
  },

  // Payment Receiver
  paymentReceiver: process.env.NEXT_PUBLIC_X402_PAYMENT_RECEIVER as Address,

  // Deferred Scheme - Escrow addresses by network
  deferredEnabled: process.env.NEXT_PUBLIC_DEFERRED_ENABLED === "true",
  deferredEscrowAddresses: {
    avalanche: process.env.NEXT_PUBLIC_AVALANCHE_ESCROW_ADDRESS as Address | undefined,
    "avalanche-fuji": process.env.NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS as Address | undefined,
    celo: process.env.NEXT_PUBLIC_CELO_ESCROW_ADDRESS as Address | undefined,
    "celo-sepolia": process.env.NEXT_PUBLIC_CELO_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
    base: process.env.NEXT_PUBLIC_BASE_ESCROW_ADDRESS as Address | undefined,
    "base-sepolia": process.env.NEXT_PUBLIC_BASE_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
    ethereum: process.env.NEXT_PUBLIC_ETHEREUM_ESCROW_ADDRESS as Address | undefined,
    sepolia: process.env.NEXT_PUBLIC_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
    polygon: process.env.NEXT_PUBLIC_POLYGON_ESCROW_ADDRESS as Address | undefined,
    "polygon-amoy": process.env.NEXT_PUBLIC_POLYGON_AMOY_ESCROW_ADDRESS as Address | undefined,
    monad: process.env.NEXT_PUBLIC_MONAD_ESCROW_ADDRESS as Address | undefined,
    "monad-testnet": process.env.NEXT_PUBLIC_MONAD_TESTNET_ESCROW_ADDRESS as Address | undefined,
    arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_ESCROW_ADDRESS as Address | undefined,
    "arbitrum-sepolia": process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
    optimism: process.env.NEXT_PUBLIC_OPTIMISM_ESCROW_ADDRESS as Address | undefined,
    "optimism-sepolia": process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
  },

  // Facilitator Info
  facilitatorName: process.env.NEXT_PUBLIC_FACILITATOR_NAME || "Stack",
  facilitatorDescription: process.env.NEXT_PUBLIC_FACILITATOR_DESCRIPTION || "Multi-chain x402 payment infrastructure for Web3 agents",
  facilitatorUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL || "http://localhost:3402",

  // ERC-8004 Registry Addresses (by network)
  erc8004Registries: {
    avalanche: {
      identity: process.env.NEXT_PUBLIC_AVALANCHE_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_AVALANCHE_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_AVALANCHE_VALIDATION_REGISTRY as Address | undefined,
    },
    "avalanche-fuji": {
      identity: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_VALIDATION_REGISTRY as Address | undefined,
    },
    base: {
      identity: process.env.NEXT_PUBLIC_BASE_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_BASE_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_BASE_VALIDATION_REGISTRY as Address | undefined,
    },
    "base-sepolia": {
      identity: process.env.NEXT_PUBLIC_BASE_SEPOLIA_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_BASE_SEPOLIA_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_BASE_SEPOLIA_VALIDATION_REGISTRY as Address | undefined,
    },
    celo: {
      identity: process.env.NEXT_PUBLIC_CELO_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_CELO_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_CELO_VALIDATION_REGISTRY as Address | undefined,
    },
    "celo-sepolia": {
      identity: process.env.NEXT_PUBLIC_CELO_SEPOLIA_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_CELO_SEPOLIA_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_CELO_SEPOLIA_VALIDATION_REGISTRY as Address | undefined,
    },
    ethereum: {
      identity: process.env.NEXT_PUBLIC_ETHEREUM_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_ETHEREUM_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_ETHEREUM_VALIDATION_REGISTRY as Address | undefined,
    },
    sepolia: {
      identity: process.env.NEXT_PUBLIC_SEPOLIA_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_SEPOLIA_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_SEPOLIA_VALIDATION_REGISTRY as Address | undefined,
    },
    polygon: {
      identity: process.env.NEXT_PUBLIC_POLYGON_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_POLYGON_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_POLYGON_VALIDATION_REGISTRY as Address | undefined,
    },
    "polygon-amoy": {
      identity: process.env.NEXT_PUBLIC_POLYGON_AMOY_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_POLYGON_AMOY_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_POLYGON_AMOY_VALIDATION_REGISTRY as Address | undefined,
    },
    monad: {
      identity: process.env.NEXT_PUBLIC_MONAD_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_MONAD_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_MONAD_VALIDATION_REGISTRY as Address | undefined,
    },
    "monad-testnet": {
      identity: process.env.NEXT_PUBLIC_MONAD_TESTNET_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_MONAD_TESTNET_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_MONAD_TESTNET_VALIDATION_REGISTRY as Address | undefined,
    },
    arbitrum: {
      identity: process.env.NEXT_PUBLIC_ARBITRUM_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_ARBITRUM_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_ARBITRUM_VALIDATION_REGISTRY as Address | undefined,
    },
    "arbitrum-sepolia": {
      identity: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_VALIDATION_REGISTRY as Address | undefined,
    },
    optimism: {
      identity: process.env.NEXT_PUBLIC_OPTIMISM_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_OPTIMISM_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_OPTIMISM_VALIDATION_REGISTRY as Address | undefined,
    },
    "optimism-sepolia": {
      identity: process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_IDENTITY_REGISTRY as Address | undefined,
      reputation: process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_REPUTATION_REGISTRY as Address | undefined,
      validation: process.env.NEXT_PUBLIC_OPTIMISM_SEPOLIA_VALIDATION_REGISTRY as Address | undefined,
    },
  },
} as const;

// Helper functions
export function getPaymentToken(network: SupportedNetwork): Address {
  return config.paymentTokens[network];
}

export function getEscrowAddress(network: SupportedNetwork): Address | undefined {
  return config.deferredEscrowAddresses[network];
}

export function getRpcUrl(network: SupportedNetwork): string {
  return config.rpcUrls[network];
}

export function isDeferredEnabledForNetwork(network: SupportedNetwork): boolean {
  return config.deferredEnabled && !!config.deferredEscrowAddresses[network];
}

export function getErc8004Registries(network: SupportedNetwork): {
  identity: Address | undefined;
  reputation: Address | undefined;
  validation: Address | undefined;
} {
  return config.erc8004Registries[network] || { identity: undefined, reputation: undefined, validation: undefined };
}

export function hasErc8004Registries(network: SupportedNetwork): boolean {
  const registries = config.erc8004Registries[network];
  return !!(registries?.identity && registries?.reputation && registries?.validation);
}

// Validation
export function validateConfig(): void {
  if (!config.paymentReceiver) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_X402_PAYMENT_RECEIVER");
  }

  if (config.deferredEnabled) {
    const hasAtLeastOneEscrow = Object.values(config.deferredEscrowAddresses).some(addr => !!addr);
    if (!hasAtLeastOneEscrow) {
      console.warn("DEFERRED_ENABLED=true but no escrow addresses configured");
    }
  }
}
