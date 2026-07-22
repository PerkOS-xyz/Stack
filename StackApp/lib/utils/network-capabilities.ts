import rawCapabilities from "./network-capabilities.json";

export type X402PaymentNetwork =
  | "avalanche" | "avalanche-fuji"
  | "celo"
  | "base" | "base-sepolia"
  | "ethereum" | "sepolia"
  | "polygon" | "polygon-amoy"
  | "monad" | "monad-testnet"
  | "arbitrum" | "arbitrum-sepolia"
  | "optimism" | "optimism-sepolia"
  | "unichain" | "unichain-sepolia"
  | "robinhood" | "robinhood-testnet";

export interface NetworkCapability {
  network: X402PaymentNetwork;
  label: string;
  chainId: number;
  testnet: boolean;
  asset: `0x${string}`;
  symbol: "USDC" | "USDG";
  tokenName: string;
  tokenVersion: string;
  erc8004Identity: boolean;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const NETWORK_CAPABILITIES = rawCapabilities as NetworkCapability[];

export const X402_PAYMENT_NETWORKS = NETWORK_CAPABILITIES.map((entry) => entry.network);

export const X402_PAYMENT_NETWORK_OPTIONS = NETWORK_CAPABILITIES.map((entry) => ({
  value: entry.network,
  label: entry.label,
  testnet: entry.testnet,
  chainId: entry.chainId,
  asset: entry.asset,
  symbol: entry.symbol,
}));

export const AGENT_READY_NETWORK_OPTIONS = NETWORK_CAPABILITIES
  .filter((entry) => entry.erc8004Identity)
  .map((entry) => ({
    value: entry.network,
    label: entry.label,
    testnet: entry.testnet,
    chainId: entry.chainId,
    asset: entry.asset,
    symbol: entry.symbol,
    x402Configured: true as const,
  }));

export function getNetworkCapability(network: string): NetworkCapability | undefined {
  return NETWORK_CAPABILITIES.find((entry) => entry.network === network);
}

export function getNetworkCapabilityByChainId(chainId: number): NetworkCapability | undefined {
  return NETWORK_CAPABILITIES.find((entry) => entry.chainId === chainId);
}

export function isX402PaymentNetwork(network: string): network is X402PaymentNetwork {
  return NETWORK_CAPABILITIES.some((entry) => entry.network === network);
}

export function isAgentReadyNetwork(network: string): network is X402PaymentNetwork {
  return NETWORK_CAPABILITIES.some(
    (entry) => entry.network === network && entry.erc8004Identity
  );
}
