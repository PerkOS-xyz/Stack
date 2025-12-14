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

// Ethereum Mainnet
export const ethereum = defineChain({
  id: 1,
  name: "Ethereum",
  network: "ethereum",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://eth.llamarpc.com"],
    },
    public: {
      http: ["https://eth.llamarpc.com"],
    },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 14353601,
    },
  },
});

// Ethereum Sepolia Testnet
export const sepolia = defineChain({
  id: 11155111,
  name: "Sepolia",
  network: "sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.sepolia.org"],
    },
    public: {
      http: ["https://rpc.sepolia.org"],
    },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 751532,
    },
  },
  testnet: true,
});

// Polygon PoS Mainnet
export const polygon = defineChain({
  id: 137,
  name: "Polygon",
  network: "polygon",
  nativeCurrency: {
    decimals: 18,
    name: "POL",
    symbol: "POL",
  },
  rpcUrls: {
    default: {
      http: ["https://polygon-rpc.com"],
    },
    public: {
      http: ["https://polygon-rpc.com"],
    },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://polygonscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 25770160,
    },
  },
});

// Polygon Amoy Testnet
export const polygonAmoy = defineChain({
  id: 80002,
  name: "Polygon Amoy",
  network: "polygon-amoy",
  nativeCurrency: {
    decimals: 18,
    name: "POL",
    symbol: "POL",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-amoy.polygon.technology"],
    },
    public: {
      http: ["https://rpc-amoy.polygon.technology"],
    },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://amoy.polygonscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 3127388,
    },
  },
  testnet: true,
});

// Monad Testnet (Mainnet not yet launched)
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  network: "monad-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
    public: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

// Monad Mainnet (Placeholder - not yet launched)
export const monad = defineChain({
  id: 10142, // Placeholder chain ID - will be updated when mainnet launches
  name: "Monad",
  network: "monad",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.monad.xyz"], // Placeholder URL
    },
    public: {
      http: ["https://rpc.monad.xyz"], // Placeholder URL
    },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://monadexplorer.com" },
  },
});

// Arbitrum One Mainnet
export const arbitrum = defineChain({
  id: 42161,
  name: "Arbitrum One",
  network: "arbitrum",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://arb1.arbitrum.io/rpc"],
    },
    public: {
      http: ["https://arb1.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://arbiscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 7654707,
    },
  },
});

// Arbitrum Sepolia Testnet
export const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  network: "arbitrum-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
    public: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" },
  },
  testnet: true,
});

// Optimism Mainnet
export const optimism = defineChain({
  id: 10,
  name: "OP Mainnet",
  network: "optimism",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.optimism.io"],
    },
    public: {
      http: ["https://mainnet.optimism.io"],
    },
  },
  blockExplorers: {
    default: { name: "Optimism Explorer", url: "https://optimistic.etherscan.io" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 4286263,
    },
  },
});

// OP Sepolia Testnet
export const optimismSepolia = defineChain({
  id: 11155420,
  name: "OP Sepolia",
  network: "optimism-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.optimism.io"],
    },
    public: {
      http: ["https://sepolia.optimism.io"],
    },
  },
  blockExplorers: {
    default: { name: "Optimism Explorer", url: "https://sepolia-optimism.etherscan.io" },
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
  ethereum,
  sepolia,
  polygon,
  "polygon-amoy": polygonAmoy,
  monad,
  "monad-testnet": monadTestnet,
  arbitrum,
  "arbitrum-sepolia": arbitrumSepolia,
  optimism,
  "optimism-sepolia": optimismSepolia,
};

// Supported networks mapping (mainnet only)
export const networkToChain: Record<string, Chain> = {
  avalanche: avalanche,
  celo: celo,
  base: base,
  ethereum: ethereum,
  polygon: polygon,
  monad: monad,
  arbitrum: arbitrum,
  optimism: optimism,
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
  // Ethereum Mainnet (Circle USDC)
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  // Ethereum Sepolia (Circle USDC testnet)
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  // Polygon PoS Mainnet (Circle USDC)
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  // Polygon Amoy Testnet
  80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  // Monad Mainnet (Placeholder - not yet launched)
  10142: "0x0000000000000000000000000000000000000000",
  // Monad Testnet (Placeholder - USDC not yet available)
  10143: "0x0000000000000000000000000000000000000000",
  // Arbitrum One Mainnet (Circle USDC)
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  // Arbitrum Sepolia Testnet
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  // Optimism Mainnet (Circle USDC)
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  // OP Sepolia Testnet
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
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
  ETHEREUM: 1,
  SEPOLIA: 11155111,
  POLYGON: 137,
  POLYGON_AMOY: 80002,
  MONAD: 10142,
  MONAD_TESTNET: 10143,
  ARBITRUM: 42161,
  ARBITRUM_SEPOLIA: 421614,
  OPTIMISM: 10,
  OPTIMISM_SEPOLIA: 11155420,
} as const;

// Supported networks
export const SUPPORTED_NETWORKS = [
  "avalanche",
  "avalanche-fuji",
  "celo",
  "celo-sepolia",
  "base",
  "base-sepolia",
  "ethereum",
  "sepolia",
  "polygon",
  "polygon-amoy",
  "monad",
  "monad-testnet",
  "arbitrum",
  "arbitrum-sepolia",
  "optimism",
  "optimism-sepolia",
] as const;
