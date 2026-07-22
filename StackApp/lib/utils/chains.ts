/**
 * Chain utilities.
 *
 * Most definitions come from @perkos/util-chains. Robinhood Chain is extended
 * locally so Stack can ship support without waiting for a shared-package
 * release.
 */

import { defineChain, type Chain } from "viem";
import {
  abstract,
  abstractTestnet,
  bsc,
  bscTestnet,
  gnosis,
  goat,
  linea,
  lineaSepolia,
  mantle,
  mantleSepoliaTestnet,
  megaeth,
  megaethTestnet,
  metis,
  metisSepolia,
  monad as viemMonad,
  monadTestnet as viemMonadTestnet,
  polygonAmoy as viemPolygonAmoy,
  sepolia as viemSepolia,
} from "viem/chains";
import * as shared from "@perkos/util-chains";
import {
  AGENT_READY_NETWORK_OPTIONS,
  X402_PAYMENT_NETWORKS,
  type X402PaymentNetwork,
} from "./network-capabilities";

export {
  avalanche,
  avalancheFuji,
  celo,
  celoSepolia,
  base,
  baseSepolia,
  ethereum,
  polygon,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  unichain,
  unichainSepolia,
} from "@perkos/util-chains";

export type { Chain } from "viem";

export const ROBINHOOD_USDG_ADDRESS =
  "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const ROBINHOOD_TESTNET_USDG_ADDRESS =
  "0x7E955252E15c84f5768B83c41a71F9eba181802F" as const;

export const MONAD_USDC_ADDRESS =
  "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as const;

export const MONAD_TESTNET_USDC_ADDRESS =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3" as const;

// @perkos/util-chains@1.1.1 still contains Monad's pre-mainnet chain ID
// (10142). Use viem's current definitions until the shared package catches up.
export const monad = viemMonad;
export const monadTestnet = viemMonadTestnet;
export const sepolia = viemSepolia;
export const polygonAmoy = defineChain({
  ...viemPolygonAmoy,
  rpcUrls: {
    default: { http: ["https://polygon-amoy-bor-rpc.publicnode.com"] },
    public: { http: ["https://polygon-amoy-bor-rpc.publicnode.com"] },
  },
});

/**
 * Agent onboarding is payment-first: only official ERC-8004 deployments on a
 * production-configured x402 exact rail are exposed in the registration UI.
 * Robinhood and Unichain remain payment rails and use a cross-chain identity
 * binding because they do not have an official ERC-8004 deployment.
 */
export const ERC8004_REGISTRATION_NETWORKS = AGENT_READY_NETWORK_OPTIONS;

export type Erc8004RegistrationNetwork =
  (typeof ERC8004_REGISTRATION_NETWORKS)[number]["value"];

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  network: "robinhood",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  network: "robinhood-testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.chain.robinhood.com"] },
    public: { http: ["https://rpc.testnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Testnet Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const chains: Record<string, Chain> = {
  ...shared.chains,
  sepolia,
  "polygon-amoy": polygonAmoy,
  monad,
  "monad-testnet": monadTestnet,
  bsc,
  "bsc-testnet": bscTestnet,
  linea,
  "linea-sepolia": lineaSepolia,
  gnosis,
  mantle,
  "mantle-sepolia": mantleSepoliaTestnet,
  metis,
  "metis-sepolia": metisSepolia,
  megaeth,
  "megaeth-testnet": megaethTestnet,
  abstract,
  "abstract-testnet": abstractTestnet,
  goat,
  robinhood,
  "robinhood-testnet": robinhoodTestnet,
};

export const networkToChain: Record<string, Chain> = {
  ...shared.networkToChain,
  sepolia,
  "polygon-amoy": polygonAmoy,
  monad,
  "monad-testnet": monadTestnet,
  bsc,
  "bsc-testnet": bscTestnet,
  linea,
  "linea-sepolia": lineaSepolia,
  gnosis,
  mantle,
  "mantle-sepolia": mantleSepoliaTestnet,
  metis,
  "metis-sepolia": metisSepolia,
  megaeth,
  "megaeth-testnet": megaethTestnet,
  abstract,
  "abstract-testnet": abstractTestnet,
  goat,
  robinhood,
  "robinhood-testnet": robinhoodTestnet,
};

// The legacy name is retained for compatibility. Robinhood uses USDG rather
// than USDC as its canonical x402 payment token.
export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  ...shared.USDC_ADDRESSES,
  [monad.id]: MONAD_USDC_ADDRESS,
  [monadTestnet.id]: MONAD_TESTNET_USDC_ADDRESS,
  [robinhood.id]: ROBINHOOD_USDG_ADDRESS,
  [robinhoodTestnet.id]: ROBINHOOD_TESTNET_USDG_ADDRESS,
};

export const CHAIN_IDS = {
  ...shared.CHAIN_IDS,
  MONAD: monad.id,
  MONAD_TESTNET: monadTestnet.id,
  ROBINHOOD: robinhood.id,
  ROBINHOOD_TESTNET: robinhoodTestnet.id,
} as const;

export type ChainId = (typeof CHAIN_IDS)[keyof typeof CHAIN_IDS];

export const SUPPORTED_NETWORKS = X402_PAYMENT_NETWORKS;

export type SupportedNetwork = X402PaymentNetwork;

export function getChainById(chainId: number): Chain | undefined {
  return Object.values(chains).find((chain) => chain.id === chainId);
}

export function getChainByNetwork(network: string): Chain | undefined {
  return chains[network] || networkToChain[network];
}

export function isTestnet(chainId: number): boolean {
  return getChainById(chainId)?.testnet === true;
}

export function getUSDCAddress(chainId: number): `0x${string}` | undefined {
  return USDC_ADDRESSES[chainId];
}

export function getRpcUrl(chainId: number): string | undefined {
  return getChainById(chainId)?.rpcUrls.default.http[0];
}

export function getNativeTokenSymbol(network: string): string {
  return chains[network]?.nativeCurrency?.symbol || "ETH";
}

export function getNativeTokenDecimals(network: string): number {
  return chains[network]?.nativeCurrency?.decimals || 18;
}

export function weiToNativeToken(weiAmount: string, network: string): string {
  try {
    const decimals = getNativeTokenDecimals(network);
    const wei = BigInt(weiAmount);
    const divisor = 10n ** BigInt(decimals);
    const whole = wei / divisor;
    const fraction = wei % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0");
    const trimmedFraction = fractionStr.slice(0, 6).replace(/0+$/, "");
    return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
  } catch {
    return "0";
  }
}

export function getChainIdFromNetwork(network: string): number | undefined {
  return getChainByNetwork(network)?.id;
}

export function getNetworkFromChainId(chainId: number): string | undefined {
  return Object.entries(chains).find(([, chain]) => chain.id === chainId)?.[0];
}

export function isSupportedNetwork(network: string): network is SupportedNetwork {
  return (SUPPORTED_NETWORKS as readonly string[]).includes(network);
}

export function getBlockExplorerUrl(chainId: number): string | undefined {
  return getChainById(chainId)?.blockExplorers?.default.url;
}

export function getTxUrl(chainId: number, txHash: string): string | undefined {
  const explorer = getBlockExplorerUrl(chainId);
  return explorer ? `${explorer}/tx/${txHash}` : undefined;
}

export function getAddressUrl(chainId: number, address: string): string | undefined {
  const explorer = getBlockExplorerUrl(chainId);
  return explorer ? `${explorer}/address/${address}` : undefined;
}

export const EXTENDED_SUPPORTED_NETWORKS = [
  ...SUPPORTED_NETWORKS,
  "stellar:pubnet" as const,
] as const;

export type ExtendedSupportedNetwork =
  | SupportedNetwork
  | "stellar:pubnet";
