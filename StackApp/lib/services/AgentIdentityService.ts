import { createPublicClient, http, type Address } from "viem";
import {
  type SupportedNetwork,
  getErc8004Registries,
  hasErc8004Registries,
  getRpcUrl,
} from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";

const IDENTITY_ABI = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "getAgentWallet", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export interface AgentIdentityResult {
  exists: boolean;
  owner?: string;
  wallet?: string;
  error?: string;
}

/** Verify agent existence on-chain via the ERC-8004 Identity Registry. */
export async function verifyAgentIdentity(
  agentId: string | number,
  network: SupportedNetwork
): Promise<AgentIdentityResult> {
  try {
    if (!hasErc8004Registries(network)) {
      return { exists: false, error: `ERC-8004 not available on ${network}` };
    }

    const registries = getErc8004Registries(network);
    const chain = getChainByNetwork(network);

    if (!chain || !registries.identity) {
      return { exists: false, error: `Chain config not found for ${network}` };
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    const owner = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [BigInt(agentId)],
    });

    return { exists: true, owner: owner as string };
  } catch {
    return { exists: false };
  }
}

/** Get the on-chain wallet address for an agent. */
export async function getAgentWallet(
  agentId: string | number,
  network: SupportedNetwork
): Promise<string | null> {
  try {
    if (!hasErc8004Registries(network)) return null;

    const registries = getErc8004Registries(network);
    const chain = getChainByNetwork(network);

    if (!chain || !registries.identity) return null;

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    const wallet = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_ABI,
      functionName: "getAgentWallet",
      args: [BigInt(agentId)],
    });

    const walletStr = wallet as string;
    if (walletStr === "0x0000000000000000000000000000000000000000") return null;
    return walletStr;
  } catch {
    return null;
  }
}

/** Build an unsigned transaction for submitting reputation feedback. */
export function buildReputationFeedbackTx(params: {
  network: SupportedNetwork;
  agentId: string | number;
  value: number;
  valueDecimals?: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: string;
}): {
  to: string;
  function: string;
  args: unknown[];
  network: string;
} | null {
  if (!hasErc8004Registries(params.network)) return null;

  const registries = getErc8004Registries(params.network);
  if (!registries.reputation) return null;

  return {
    to: registries.reputation,
    function: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    args: [
      params.agentId.toString(),
      params.value,
      params.valueDecimals ?? 0,
      params.tag1 ?? "x402",
      params.tag2 ?? "settlement",
      params.endpoint ?? "",
      params.feedbackURI ?? "",
      params.feedbackHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    ],
    description: `Auto reputation feedback for agent ${params.agentId} after x402 settlement`,
  };
}
