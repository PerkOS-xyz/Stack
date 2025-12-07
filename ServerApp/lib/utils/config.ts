import type { Address } from "../types/x402";

// Supported networks
export type SupportedNetwork = "avalanche" | "celo" | "base" | "avalanche-fuji" | "celo-sepolia" | "base-sepolia";

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
  },

  // Facilitator Info
  facilitatorName: process.env.NEXT_PUBLIC_FACILITATOR_NAME || "x402 Multi-Chain Facilitator",
  facilitatorDescription: process.env.NEXT_PUBLIC_FACILITATOR_DESCRIPTION || "Standards-compliant x402 facilitator supporting Avalanche, Celo, and Base",
  facilitatorUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL || "http://localhost:3402",
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
