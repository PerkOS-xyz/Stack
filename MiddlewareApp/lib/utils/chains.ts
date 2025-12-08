import { defineChain } from "viem";
import type { Chain } from "viem";

// Avalanche Mainnet
export const avalanche = defineChain({
  id: 43114,
  name: "Avalanche C-Chain",
  network: "avalanche",
  nativeCurrency: {
    decimals: 18,
    name: "Avalanche",
    symbol: "AVAX",
  },
  rpcUrls: {
    default: {
      http: ["https://api.avax.network/ext/bc/C/rpc"],
    },
    public: {
      http: ["https://api.avax.network/ext/bc/C/rpc"],
    },
  },
  blockExplorers: {
    default: { name: "SnowTrace", url: "https://snowtrace.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 11907934,
    },
  },
});

// Avalanche Fuji Testnet
export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  network: "avalanche-fuji",
  nativeCurrency: {
    decimals: 18,
    name: "Avalanche",
    symbol: "AVAX",
  },
  rpcUrls: {
    default: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
    public: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
  },
  blockExplorers: {
    default: { name: "SnowTrace", url: "https://testnet.snowtrace.io" },
  },
  testnet: true,
});

// Celo Mainnet
export const celo = defineChain({
  id: 42220,
  name: "Celo",
  network: "celo",
  nativeCurrency: {
    decimals: 18,
    name: "CELO",
    symbol: "CELO",
  },
  rpcUrls: {
    default: {
      http: ["https://forno.celo.org"],
    },
    public: {
      http: ["https://forno.celo.org"],
    },
  },
  blockExplorers: {
    default: { name: "Celo Explorer", url: "https://explorer.celo.org/mainnet" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 13112599,
    },
  },
});

// Celo Sepolia Testnet
export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  network: "celo-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "CELO",
    symbol: "CELO",
  },
  rpcUrls: {
    default: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
    public: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
  },
  blockExplorers: {
    default: { name: "Celo Sepolia Explorer", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
});

// Base Mainnet
export const base = defineChain({
  id: 8453,
  name: "Base",
  network: "base",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.base.org"],
    },
    public: {
      http: ["https://mainnet.base.org"],
    },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://basescan.org" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 5022,
    },
  },
});

// Base Sepolia Testnet
export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  network: "base-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
    public: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
});

// Chain registry
export const chains: Record<string, Chain> = {
  avalanche,
  "avalanche-fuji": avalancheFuji,
  celo,
  "celo-sepolia": celoSepolia,
  base,
  "base-sepolia": baseSepolia,
};

// Supported networks mapping
export const networkToChain: Record<string, Chain> = {
  avalanche: avalanche,
  celo: celo,
  base: base,
};

// Get chain by ID
export function getChainById(chainId: number): Chain | undefined {
  return Object.values(chains).find((chain) => chain.id === chainId);
}

// Get chain by network name
export function getChainByNetwork(network: string): Chain | undefined {
  return chains[network] || networkToChain[network];
}

// Check if chain is testnet
export function isTestnet(chainId: number): boolean {
  const chain = getChainById(chainId);
  return chain?.testnet === true;
}

// Token addresses by chain
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  // Avalanche C-Chain
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  // Avalanche Fuji
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65",
  // Celo Mainnet
  42220: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  // Celo Sepolia
  11142220: "0x0000000000000000000000000000000000000000", // TODO: Update with actual USDC address
  // Base Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Base Sepolia
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

// Get USDC address for chain
export function getUSDCAddress(chainId: number): `0x${string}` | undefined {
  return USDC_ADDRESSES[chainId];
}

// Get RPC URL for chain
export function getRpcUrl(chainId: number): string | undefined {
  const chain = getChainById(chainId);
  return chain?.rpcUrls.default.http[0];
}

// Chain IDs constants
export const CHAIN_IDS = {
  AVALANCHE: 43114,
  AVALANCHE_FUJI: 43113,
  CELO: 42220,
  CELO_SEPOLIA: 11142220,
  BASE: 8453,
  BASE_SEPOLIA: 84532,
} as const;

// Supported networks
export const SUPPORTED_NETWORKS = [
  "avalanche",
  "avalanche-fuji",
  "celo",
  "celo-sepolia",
  "base",
  "base-sepolia",
] as const;
