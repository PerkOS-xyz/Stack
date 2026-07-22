import { createPublicClient, http, type Address } from "viem";
import { getErc8004Registries, getRpcUrl, type SupportedNetwork } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import {
  getNetworkCapability,
  getNetworkCapabilityByChainId,
  isAgentReadyNetwork,
} from "@/lib/utils/network-capabilities";

export function resolveSiwaNetwork(network: string) {
  if (!isAgentReadyNetwork(network)) {
    throw new Error(`ERC-8004 identity is not available on ${network}`);
  }
  const supportedNetwork = network as SupportedNetwork;
  const capability = getNetworkCapability(network);
  const chain = getChainByNetwork(supportedNetwork);
  const registry = getErc8004Registries(supportedNetwork).identity;
  if (!capability || !chain || !registry) throw new Error(`Incomplete SIWA network configuration for ${network}`);

  return {
    network: supportedNetwork,
    chain,
    chainId: capability.chainId,
    registry: registry as Address,
    agentRegistry: `eip155:${capability.chainId}:${registry}`,
    client: createPublicClient({ chain, transport: http(getRpcUrl(supportedNetwork)) }),
  };
}

export function resolveSiwaNetworkByChainId(chainId: number) {
  const capability = getNetworkCapabilityByChainId(chainId);
  if (!capability) throw new Error(`Unsupported SIWA chain ID ${chainId}`);
  return resolveSiwaNetwork(capability.network);
}
