import { isAddress, type Address } from "viem";
import { type SupportedNetwork } from "@/lib/utils/config";
import { getNetworkCapability, isX402PaymentNetwork } from "@/lib/utils/network-capabilities";

export function getErc8183Address(network: string): Address | undefined {
  if (!isX402PaymentNetwork(network)) return undefined;
  const key = `NEXT_PUBLIC_${network.toUpperCase().replace(/-/g, "_")}_ERC8183_ADDRESS`;
  const value = process.env[key];
  return value && isAddress(value) ? value : undefined;
}

export function resolveErc8183Network(network: string) {
  if (!isX402PaymentNetwork(network)) throw new Error(`Unsupported ERC-8183 network ${network}`);
  const capability = getNetworkCapability(network);
  const address = getErc8183Address(network);
  if (!capability || !address) throw new Error(`ERC-8183 is not deployed on ${network}`);
  return { network: network as SupportedNetwork, capability, address };
}
