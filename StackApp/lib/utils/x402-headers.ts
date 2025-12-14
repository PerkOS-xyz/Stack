import { CHAIN_IDS } from "./chains";

/**
 * x402 V2 HTTP Headers Utility
 *
 * Provides standardized response headers for x402 V2 protocol compliance.
 * These headers enable agent discovery, request tracing, and protocol versioning.
 */

// Generate a unique request ID for tracing
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `x402-${timestamp}-${random}`;
}

// Get chain ID from network name
export function getChainId(network: string): number | null {
  const chainIdMap: Record<string, number> = {
    avalanche: CHAIN_IDS.AVALANCHE,
    "avalanche-fuji": CHAIN_IDS.AVALANCHE_FUJI,
    celo: CHAIN_IDS.CELO,
    "celo-sepolia": CHAIN_IDS.CELO_SEPOLIA,
    base: CHAIN_IDS.BASE,
    "base-sepolia": CHAIN_IDS.BASE_SEPOLIA,
    ethereum: CHAIN_IDS.ETHEREUM,
    sepolia: CHAIN_IDS.SEPOLIA,
    polygon: CHAIN_IDS.POLYGON,
    "polygon-amoy": CHAIN_IDS.POLYGON_AMOY,
    monad: CHAIN_IDS.MONAD,
    "monad-testnet": CHAIN_IDS.MONAD_TESTNET,
    arbitrum: CHAIN_IDS.ARBITRUM,
    "arbitrum-sepolia": CHAIN_IDS.ARBITRUM_SEPOLIA,
    optimism: CHAIN_IDS.OPTIMISM,
    "optimism-sepolia": CHAIN_IDS.OPTIMISM_SEPOLIA,
  };
  return chainIdMap[network] || null;
}

// Base V2 headers for all x402 responses
export function getBaseHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-x402-Version": "2.0.0",
    "X-x402-Protocol": "1",
  };
}

// Headers for verify responses
export interface VerifyHeadersParams {
  requestId: string;
  network: string;
  scheme: "exact" | "deferred";
  isValid: boolean;
  payer?: string | null;
}

export function getVerifyHeaders(params: VerifyHeadersParams): Record<string, string> {
  const chainId = getChainId(params.network);
  const headers: Record<string, string> = {
    ...getBaseHeaders(),
    "X-x402-Request-Id": params.requestId,
    "X-x402-Network": params.network,
    "X-x402-Scheme": params.scheme,
    "X-x402-Valid": params.isValid.toString(),
  };

  if (chainId) {
    headers["X-x402-Chain-Id"] = chainId.toString();
    headers["X-x402-CAIP2"] = `eip155:${chainId}`;
  }

  if (params.payer) {
    headers["X-x402-Payer"] = params.payer;
  }

  return headers;
}

// Headers for settle responses
export interface SettleHeadersParams {
  requestId: string;
  network: string;
  scheme: "exact" | "deferred";
  success: boolean;
  payer?: string | null;
  transaction?: string | null;
}

export function getSettleHeaders(params: SettleHeadersParams): Record<string, string> {
  const chainId = getChainId(params.network);
  const headers: Record<string, string> = {
    ...getBaseHeaders(),
    "X-x402-Request-Id": params.requestId,
    "X-x402-Network": params.network,
    "X-x402-Scheme": params.scheme,
    "X-x402-Success": params.success.toString(),
  };

  if (chainId) {
    headers["X-x402-Chain-Id"] = chainId.toString();
    headers["X-x402-CAIP2"] = `eip155:${chainId}`;
  }

  if (params.payer) {
    headers["X-x402-Payer"] = params.payer;
  }

  if (params.transaction) {
    headers["X-x402-Transaction"] = params.transaction;
  }

  return headers;
}

// V2 Receipt format for settle responses
export interface V2Receipt {
  version: "2.0.0";
  requestId: string;
  timestamp: string;
  network: {
    name: string;
    chainId: number | null;
    caip2: string | null;
  };
  payment: {
    scheme: "exact" | "deferred";
    payer: string | null;
    amount?: string;
    asset?: string;
  };
  settlement: {
    success: boolean;
    transaction: string | null;
    blockExplorer?: string | null;
  };
}

export function createV2Receipt(params: {
  requestId: string;
  network: string;
  scheme: "exact" | "deferred";
  success: boolean;
  payer: string | null;
  transaction: string | null;
  amount?: string;
  asset?: string;
}): V2Receipt {
  const chainId = getChainId(params.network);
  const blockExplorerUrls: Record<string, string> = {
    avalanche: "https://snowtrace.io/tx/",
    "avalanche-fuji": "https://testnet.snowtrace.io/tx/",
    base: "https://basescan.org/tx/",
    "base-sepolia": "https://sepolia.basescan.org/tx/",
    celo: "https://explorer.celo.org/mainnet/tx/",
    "celo-sepolia": "https://celo-sepolia.blockscout.com/tx/",
    ethereum: "https://etherscan.io/tx/",
    sepolia: "https://sepolia.etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    "polygon-amoy": "https://amoy.polygonscan.com/tx/",
    arbitrum: "https://arbiscan.io/tx/",
    "arbitrum-sepolia": "https://sepolia.arbiscan.io/tx/",
    optimism: "https://optimistic.etherscan.io/tx/",
    "optimism-sepolia": "https://sepolia-optimism.etherscan.io/tx/",
    monad: "https://monadexplorer.com/tx/",
    "monad-testnet": "https://testnet.monadexplorer.com/tx/",
  };

  return {
    version: "2.0.0",
    requestId: params.requestId,
    timestamp: new Date().toISOString(),
    network: {
      name: params.network,
      chainId,
      caip2: chainId ? `eip155:${chainId}` : null,
    },
    payment: {
      scheme: params.scheme,
      payer: params.payer,
      ...(params.amount && { amount: params.amount }),
      ...(params.asset && { asset: params.asset }),
    },
    settlement: {
      success: params.success,
      transaction: params.transaction,
      blockExplorer: params.transaction && blockExplorerUrls[params.network]
        ? `${blockExplorerUrls[params.network]}${params.transaction}`
        : null,
    },
  };
}
