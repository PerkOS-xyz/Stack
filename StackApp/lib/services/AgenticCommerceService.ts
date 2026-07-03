/**
 * AgenticCommerceService — server surface for ERC-8183 (Agentic Commerce) Jobs.
 *
 * Config-gated: reads the deployed `AgenticCommerce` contract address per network
 * from `NEXT_PUBLIC_<NETWORK>_ACP_CONTRACT` (empty until Julio deploys it). Reads
 * job state on-chain; builds UNSIGNED calldata for the mutating actions so the
 * right party (client funds, provider submits, evaluator completes/rejects) signs
 * client-side — same pattern as the ERC-8004 identity routes.
 */
import {
  createPublicClient,
  http,
  encodeFunctionData,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { config } from "@/lib/utils/config";
import { chains, getChainByNetwork } from "@/lib/utils/chains";
import { AGENTIC_COMMERCE_ABI, ACP_JOB_STATUS, type AcpJobStatus } from "@/lib/abi/agenticCommerce";

export type AcpAction = "create" | "setBudget" | "fund" | "submit" | "complete" | "reject" | "claimRefund";

export interface UnsignedTx {
  to: Address;
  data: Hex;
  value: string; // wei, always "0" for ACP (funds move via ERC-20 transferFrom inside fund)
  network: string;
  chainId: number | undefined;
}

/** ACP contract address for a network, or null if not configured. */
export function getAcpContractAddress(network: string): Address | null {
  const key = `NEXT_PUBLIC_${network.toUpperCase().replace(/-/g, "_")}_ACP_CONTRACT`;
  const addr = process.env[key];
  return addr && isAddress(addr) ? (addr as Address) : null;
}

export function isAcpEnabled(network: string): boolean {
  return getAcpContractAddress(network) !== null;
}

/** Networks that have an ACP contract configured. */
export function getAcpNetworks(): string[] {
  return Object.keys(chains).filter((n) => isAcpEnabled(n));
}

export class AgenticCommerceService {
  private requireAddress(network: string): Address {
    const addr = getAcpContractAddress(network);
    if (!addr) {
      throw new Error(
        `ACP (ERC-8183) not configured for network "${network}". Deploy AgenticCommerce and set NEXT_PUBLIC_${network
          .toUpperCase()
          .replace(/-/g, "_")}_ACP_CONTRACT.`
      );
    }
    return addr;
  }

  /** Read a job's on-chain state. Throws if ACP isn't configured for the network. */
  async getJob(network: string, jobId: bigint) {
    const address = this.requireAddress(network);
    const chain = getChainByNetwork(network as never);
    const rpc = config.rpcUrls[network as keyof typeof config.rpcUrls];
    const client = createPublicClient({ chain, transport: http(rpc) });

    const job = (await client.readContract({
      address,
      abi: AGENTIC_COMMERCE_ABI,
      functionName: "getJob",
      args: [jobId],
    })) as {
      client: Address;
      provider: Address;
      evaluator: Address;
      description: string;
      budget: bigint;
      expiredAt: bigint;
      status: number;
      hook: Address;
    };

    const statusName: AcpJobStatus = ACP_JOB_STATUS[job.status] ?? ("Open" as AcpJobStatus);
    return {
      jobId: jobId.toString(),
      contract: address,
      network,
      client: job.client,
      provider: job.provider,
      evaluator: job.evaluator,
      description: job.description,
      budget: job.budget.toString(),
      expiredAt: job.expiredAt.toString(),
      status: statusName,
      statusCode: job.status,
      hook: job.hook,
    };
  }

  /** Build the unsigned tx for an ACP action. Returns { to, data, value }. */
  buildActionTx(network: string, action: AcpAction, params: Record<string, unknown>): UnsignedTx {
    const to = this.requireAddress(network);
    const chain = getChainByNetwork(network as never);
    const ZERO: Hex = "0x";

    let data: Hex;
    switch (action) {
      case "create":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "createJob",
          args: [
            params.provider as Address,
            params.evaluator as Address,
            BigInt(params.expiredAt as string | number),
            (params.description as string) ?? "",
            ((params.hook as Address) ?? "0x0000000000000000000000000000000000000000") as Address,
          ],
        });
        break;
      case "setBudget":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "setBudget",
          args: [BigInt(params.jobId as string), BigInt(params.amount as string), ZERO],
        });
        break;
      case "fund":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "fund",
          args: [BigInt(params.jobId as string), BigInt(params.expectedBudget as string), ZERO],
        });
        break;
      case "submit":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "submit",
          args: [BigInt(params.jobId as string), params.deliverable as Hex, ZERO],
        });
        break;
      case "complete":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "complete",
          args: [BigInt(params.jobId as string), (params.reason as Hex) ?? `0x${"0".repeat(64)}`, ZERO],
        });
        break;
      case "reject":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "reject",
          args: [BigInt(params.jobId as string), (params.reason as Hex) ?? `0x${"0".repeat(64)}`, ZERO],
        });
        break;
      case "claimRefund":
        data = encodeFunctionData({
          abi: AGENTIC_COMMERCE_ABI,
          functionName: "claimRefund",
          args: [BigInt(params.jobId as string)],
        });
        break;
      default:
        throw new Error(`Unknown ACP action: ${action}`);
    }

    return { to, data, value: "0", network, chainId: chain?.id };
  }
}

let singleton: AgenticCommerceService | null = null;
export function getAgenticCommerceService(): AgenticCommerceService {
  if (!singleton) singleton = new AgenticCommerceService();
  return singleton;
}
