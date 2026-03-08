import type { Address } from "../types/x402";
import type { Hex } from "viem";

/**
 * Normalize a private key to the correct format for viem
 */
function normalizePrivateKey(key: string | undefined): Hex | undefined {
  if (!key) return undefined;
  let normalized = key.trim().replace(/['"]/g, '').replace(/\r?\n/g, '');
  if (!normalized.startsWith('0x')) {
    normalized = `0x${normalized}`;
  }
  if (normalized.length !== 66) {
    console.error(`Invalid private key length: expected 66 chars (0x + 64 hex), got ${normalized.length}`);
    return undefined;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    console.error('Invalid private key format: not valid hexadecimal');
    return undefined;
  }
  return normalized as Hex;
}

// ============ ERC-8004 Official CREATE2 Addresses ============
// These are deterministic across ALL EVM chains via CREATE2

const ERC8004_MAINNET_ADDRESSES = {
  identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  validation: undefined as Address | undefined, // Not officially deployed yet
};

const ERC8004_TESTNET_ADDRESSES = {
  identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
  reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
  validation: undefined as Address | undefined, // Not officially deployed yet
};

// Supported networks
export type SupportedNetwork =
  | "avalanche" | "avalanche-fuji"
  | "celo" | "celo-sepolia"
  | "base" | "base-sepolia"
  | "ethereum" | "sepolia"
  | "polygon" | "polygon-amoy"
  | "monad" | "monad-testnet"
  | "arbitrum" | "arbitrum-sepolia"
  | "optimism" | "optimism-sepolia"
  | "unichain" | "unichain-sepolia"
  | "bsc" | "bsc-testnet"
  | "linea" | "linea-sepolia"
  | "gnosis" | "gnosis-chiado"
  | "mantle" | "mantle-sepolia"
  | "metis" | "metis-sepolia"
  | "megaeth" | "megaeth-testnet"
  | "abstract" | "abstract-testnet"
  | "goat" | "goat-testnet";

/** Check if a network is a testnet */
function isTestnetNetwork(network: string): boolean {
  return (
    network.includes("fuji") ||
    network.includes("sepolia") ||
    network.includes("amoy") ||
    network.includes("testnet") ||
    network.includes("chiado")
  );
}

/** Get ERC-8004 registry addresses for any network (CREATE2 deterministic) */
function getErc8004AddressesForNetwork(network: string): {
  identity: Address | undefined;
  reputation: Address | undefined;
  validation: Address | undefined;
} {
  const isTestnet = isTestnetNetwork(network);
  const base = isTestnet ? ERC8004_TESTNET_ADDRESSES : ERC8004_MAINNET_ADDRESSES;

  // Allow env var override for validation (not yet officially deployed)
  const networkUpper = network.toUpperCase().replace(/-/g, '_');
  const validationOverride = process.env[`NEXT_PUBLIC_${networkUpper}_VALIDATION_REGISTRY`] as Address | undefined;

  return {
    identity: base.identity,
    reputation: base.reputation,
    validation: validationOverride || base.validation,
  };
}

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
    unichain: process.env.NEXT_PUBLIC_UNICHAIN_RPC_URL || "https://mainnet.unichain.org",
    "unichain-sepolia": process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_RPC_URL || "https://sepolia.unichain.org",
    bsc: process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org",
    "bsc-testnet": process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
    linea: process.env.NEXT_PUBLIC_LINEA_RPC_URL || "https://rpc.linea.build",
    "linea-sepolia": process.env.NEXT_PUBLIC_LINEA_SEPOLIA_RPC_URL || "https://rpc.sepolia.linea.build",
    gnosis: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
    "gnosis-chiado": process.env.NEXT_PUBLIC_GNOSIS_CHIADO_RPC_URL || "https://rpc.chiadochain.net",
    mantle: process.env.NEXT_PUBLIC_MANTLE_RPC_URL || "https://rpc.mantle.xyz",
    "mantle-sepolia": process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
    metis: process.env.NEXT_PUBLIC_METIS_RPC_URL || "https://andromeda.metis.io/?owner=1088",
    "metis-sepolia": process.env.NEXT_PUBLIC_METIS_SEPOLIA_RPC_URL || "https://sepolia.metisdevops.link",
    megaeth: process.env.NEXT_PUBLIC_MEGAETH_RPC_URL || "https://rpc.megaeth.com",
    "megaeth-testnet": process.env.NEXT_PUBLIC_MEGAETH_TESTNET_RPC_URL || "https://rpc-testnet.megaeth.com",
    abstract: process.env.NEXT_PUBLIC_ABSTRACT_RPC_URL || "https://api.abstrakt.network",
    "abstract-testnet": process.env.NEXT_PUBLIC_ABSTRACT_TESTNET_RPC_URL || "https://api-testnet.abstrakt.network",
    goat: process.env.NEXT_PUBLIC_GOAT_RPC_URL || "https://rpc.goat.network",
    "goat-testnet": process.env.NEXT_PUBLIC_GOAT_TESTNET_RPC_URL || "https://rpc-testnet.goat.network",
  },

  privateKey: normalizePrivateKey(process.env.PRIVATE_KEY),

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
    unichain: (process.env.NEXT_PUBLIC_UNICHAIN_PAYMENT_TOKEN || "0x078D782b760474a361dDA0AF3839290b0EF57AD6") as Address,
    "unichain-sepolia": (process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    bsc: (process.env.NEXT_PUBLIC_BSC_PAYMENT_TOKEN || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d") as Address,
    "bsc-testnet": (process.env.NEXT_PUBLIC_BSC_TESTNET_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    linea: (process.env.NEXT_PUBLIC_LINEA_PAYMENT_TOKEN || "0x176211869cA2b568f2A7D4EE941E073a821EE1ff") as Address,
    "linea-sepolia": (process.env.NEXT_PUBLIC_LINEA_SEPOLIA_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    gnosis: (process.env.NEXT_PUBLIC_GNOSIS_PAYMENT_TOKEN || "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83") as Address,
    "gnosis-chiado": (process.env.NEXT_PUBLIC_GNOSIS_CHIADO_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    mantle: (process.env.NEXT_PUBLIC_MANTLE_PAYMENT_TOKEN || "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9") as Address,
    "mantle-sepolia": (process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    metis: (process.env.NEXT_PUBLIC_METIS_PAYMENT_TOKEN || "0xEA32A96608495e54156Ae48931A7c1f6f0A723A3") as Address,
    "metis-sepolia": (process.env.NEXT_PUBLIC_METIS_SEPOLIA_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    megaeth: (process.env.NEXT_PUBLIC_MEGAETH_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    "megaeth-testnet": (process.env.NEXT_PUBLIC_MEGAETH_TESTNET_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    abstract: (process.env.NEXT_PUBLIC_ABSTRACT_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    "abstract-testnet": (process.env.NEXT_PUBLIC_ABSTRACT_TESTNET_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    goat: (process.env.NEXT_PUBLIC_GOAT_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
    "goat-testnet": (process.env.NEXT_PUBLIC_GOAT_TESTNET_PAYMENT_TOKEN || "0x0000000000000000000000000000000000000000") as Address,
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
    unichain: process.env.NEXT_PUBLIC_UNICHAIN_ESCROW_ADDRESS as Address | undefined,
    "unichain-sepolia": process.env.NEXT_PUBLIC_UNICHAIN_SEPOLIA_ESCROW_ADDRESS as Address | undefined,
  },

  // Facilitator Info
  facilitatorName: process.env.NEXT_PUBLIC_FACILITATOR_NAME || "Stack",
  facilitatorDescription: process.env.NEXT_PUBLIC_FACILITATOR_DESCRIPTION || "Multi-chain x402 payment infrastructure for Web3 agents",
  facilitatorUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL || "http://localhost:3402",
} as const;

// Helper functions
export function getPaymentToken(network: SupportedNetwork): Address {
  return config.paymentTokens[network];
}

export function getEscrowAddress(network: SupportedNetwork): Address | undefined {
  return config.deferredEscrowAddresses[network as keyof typeof config.deferredEscrowAddresses];
}

export function getRpcUrl(network: SupportedNetwork): string {
  return config.rpcUrls[network];
}

export function isDeferredEnabledForNetwork(network: SupportedNetwork): boolean {
  return config.deferredEnabled && !!getEscrowAddress(network);
}

/**
 * Get ERC-8004 registry addresses for a network.
 * Uses hardcoded CREATE2 deterministic addresses (same on all chains).
 */
export function getErc8004Registries(network: SupportedNetwork): {
  identity: Address | undefined;
  reputation: Address | undefined;
  validation: Address | undefined;
} {
  return getErc8004AddressesForNetwork(network);
}

/**
 * Check if ERC-8004 registries are available on a network.
 * Identity and Reputation are always available (CREATE2 deployed on 25+ chains).
 * Validation is not yet officially deployed.
 */
export function hasErc8004Registries(network: SupportedNetwork): boolean {
  const registries = getErc8004Registries(network);
  return !!(registries.identity && registries.reputation);
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
