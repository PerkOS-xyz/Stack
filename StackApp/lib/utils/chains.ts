/**
 * Chain Utilities - Re-exported from @perkos/util-chains
 *
 * This file re-exports all chain configurations and utilities from the @perkos/util-chains package
 * for backward compatibility with existing imports.
 */

export {
  // Chain Definitions
  avalanche,
  avalancheFuji,
  celo,
  celoSepolia,
  base,
  baseSepolia,
  ethereum,
  sepolia,
  polygon,
  polygonAmoy,
  monad,
  monadTestnet,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  unichain,
  unichainSepolia,

  // Registries
  chains,
  networkToChain,

  // USDC Addresses
  USDC_ADDRESSES,

  // Chain IDs
  CHAIN_IDS,
  type ChainId,

  // Supported Networks
  SUPPORTED_NETWORKS,
  type SupportedNetwork,

  // Utility Functions
  getChainById,
  getChainByNetwork,
  isTestnet,
  getUSDCAddress,
  getRpcUrl,
  getNativeTokenSymbol,
  getNativeTokenDecimals,
  weiToNativeToken,
  getChainIdFromNetwork,
  getNetworkFromChainId,
  isSupportedNetwork,
  getBlockExplorerUrl,
  getTxUrl,
  getAddressUrl,

  // Types
  type Chain,
} from "@perkos/util-chains";
