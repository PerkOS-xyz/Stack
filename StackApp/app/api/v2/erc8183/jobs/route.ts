import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, encodeFunctionData, http, isAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { ERC8183_ABI } from "@/lib/contracts/erc8183/abi";
import { resolveErc8183Network } from "@/lib/erc8183/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { getRpcUrl } from "@/lib/utils/config";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { getClientIp, rateLimit } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uint = z.union([z.string().regex(/^(0|[1-9]\d*)$/), z.number().int().nonnegative().safe()]);
const address = z.string().refine(isAddress, "Invalid address");
const bytes = z.string().regex(/^0x(?:[a-fA-F0-9]{2})*$/);
const bytes32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const base = { network: z.string().min(1) };
const actionSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("createJob"), provider: address, evaluator: address, expiredAt: uint, description: z.string().min(1).max(4_096), hook: address, providerAgentId: uint }).strict(),
  z.object({ ...base, action: z.literal("setBudget"), jobId: uint, token: address, amount: uint, optParams: bytes.default("0x") }).strict(),
  z.object({ ...base, action: z.literal("fund"), jobId: uint, expectedToken: address, expectedBudget: uint, optParams: bytes.default("0x") }).strict(),
  z.object({ ...base, action: z.literal("submit"), jobId: uint, deliverable: bytes32, optParams: bytes.default("0x") }).strict(),
  z.object({ ...base, action: z.literal("complete"), jobId: uint, reason: bytes32, optParams: bytes.default("0x") }).strict(),
  z.object({ ...base, action: z.literal("reject"), jobId: uint, reason: bytes32, optParams: bytes.default("0x") }).strict(),
  z.object({ ...base, action: z.literal("claimRefund"), jobId: uint }).strict(),
]);

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: NextRequest) {
  try {
    const network = new URL(request.url).searchParams.get("network") || "";
    const jobId = new URL(request.url).searchParams.get("jobId");
    const resolved = resolveErc8183Network(network);
    if (!jobId) {
      return NextResponse.json({
        standard: "ERC-8183",
        status: "draft",
        network,
        chainId: resolved.capability.chainId,
        address: resolved.address,
      }, { headers: corsHeaders });
    }
    if (!/^(0|[1-9]\d*)$/.test(jobId)) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400, headers: corsHeaders });
    }
    const chain = getChainByNetwork(resolved.network);
    if (!chain) throw new Error(`Missing chain configuration for ${network}`);
    const client = createPublicClient({ chain, transport: http(getRpcUrl(resolved.network)) });
    const job = await client.readContract({
      address: resolved.address,
      abi: ERC8183_ABI,
      functionName: "getJob",
      args: [BigInt(jobId)],
    });
    return NextResponse.json({ network, contract: resolved.address, jobId, job: jsonSafe(job) }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read ERC-8183 job" }, { status: 400, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`erc8183:${getClientIp(request)}`, 60, 60_000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ERC-8183 action", details: parsed.error.flatten() }, { status: 400, headers: corsHeaders });
    }
    const input = parsed.data;
    const resolved = resolveErc8183Network(input.network);
    let data: `0x${string}`;
    switch (input.action) {
      case "createJob": {
        const expiredAt = BigInt(input.expiredAt);
        if (expiredAt > (1n << 48n) - 1n) throw new Error("expiredAt exceeds uint48");
        data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "createJob", args: [input.provider as Address, input.evaluator as Address, Number(expiredAt), input.description, input.hook as Address, BigInt(input.providerAgentId)] });
        break;
      }
      case "setBudget": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "setBudget", args: [BigInt(input.jobId), input.token as Address, BigInt(input.amount), input.optParams as Hex] }); break;
      case "fund": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "fund", args: [BigInt(input.jobId), input.expectedToken as Address, BigInt(input.expectedBudget), input.optParams as Hex] }); break;
      case "submit": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "submit", args: [BigInt(input.jobId), input.deliverable as Hex, input.optParams as Hex] }); break;
      case "complete": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "complete", args: [BigInt(input.jobId), input.reason as Hex, input.optParams as Hex] }); break;
      case "reject": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "reject", args: [BigInt(input.jobId), input.reason as Hex, input.optParams as Hex] }); break;
      case "claimRefund": data = encodeFunctionData({ abi: ERC8183_ABI, functionName: "claimRefund", args: [BigInt(input.jobId)] }); break;
    }
    return NextResponse.json({
      success: true,
      standard: "ERC-8183",
      transaction: { to: resolved.address, data, value: "0", chainId: resolved.capability.chainId, network: input.network },
      message: "Sign and submit this ERC-8183 transaction with the wallet for the required role",
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to prepare ERC-8183 action" }, { status: 400, headers: corsHeaders });
  }
}
