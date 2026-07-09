import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address } from "viem";
import {
  type SupportedNetwork,
  getErc8004Registries,
  hasErc8004Registries,
  getRpcUrl,
} from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

const IDENTITY_ABI = [
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "getAgentWallet", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "isAuthorizedOrOwner", type: "function", stateMutability: "view", inputs: [{ name: "spender", type: "address" }, { name: "agentId", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

type IdentityClient = ReturnType<typeof createPublicClient>;

function makeClient(network: SupportedNetwork): { client: IdentityClient; registry: Address } | NextResponse {
  if (!hasErc8004Registries(network)) {
    return NextResponse.json(
      { error: `ERC-8004 registries not deployed on ${network}` },
      { status: 400, headers: corsHeaders }
    );
  }
  const registries = getErc8004Registries(network);
  const chain = getChainByNetwork(network);
  if (!chain || !registries.identity) {
    return NextResponse.json({ error: `Chain config not found for ${network}` }, { status: 500, headers: corsHeaders });
  }
  return {
    client: createPublicClient({ chain, transport: http(getRpcUrl(network)) }),
    registry: registries.identity as Address,
  };
}

/** Read the agent's on-chain identity (owner, bound wallet, tokenURI). null if it doesn't exist. */
async function readAgent(client: IdentityClient, registry: Address, agentId: bigint) {
  let owner: Address;
  try {
    owner = (await client.readContract({ address: registry, abi: IDENTITY_ABI, functionName: "ownerOf", args: [agentId] })) as Address;
  } catch {
    return null; // nonexistent agent
  }
  let tokenURI: string | null = null;
  try {
    tokenURI = (await client.readContract({ address: registry, abi: IDENTITY_ABI, functionName: "tokenURI", args: [agentId] })) as string;
  } catch { /* optional */ }
  let agentWallet: Address | null = null;
  try {
    const w = (await client.readContract({ address: registry, abi: IDENTITY_ABI, functionName: "getAgentWallet", args: [agentId] })) as Address;
    agentWallet = w && w !== ZERO ? w : null;
  } catch { /* wallet may be unset */ }
  return { owner, tokenURI, agentWallet };
}

/**
 * GET /api/erc8004/verify?network=base-sepolia&agentId=1[&wallet=0x..]
 * Returns an agent identity card (exists, owner, bound wallet, tokenURI). If
 * `wallet` is supplied, also reports whether that wallet controls the agent
 * (read-only — no signature). For a cryptographic proof use POST.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(getClientIp(req), 60, 60000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } });
  }
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const wallet = searchParams.get("wallet");

    if (!network || agentId === null) {
      return NextResponse.json({ error: "network and agentId are required" }, { status: 400, headers: corsHeaders });
    }
    const made = makeClient(network);
    if (made instanceof NextResponse) return made;

    const agent = await readAgent(made.client, made.registry, BigInt(agentId));
    if (!agent) {
      return NextResponse.json({ agentId, network, exists: false }, { status: 404, headers: corsHeaders });
    }

    const registries = getErc8004Registries(network);
    const card = {
      spec: "ERC-8004",
      network,
      agentId,
      exists: true,
      owner: agent.owner,
      agentWallet: agent.agentWallet,
      tokenURI: agent.tokenURI,
      registries: { identity: registries.identity, reputation: registries.reputation ?? null, validation: registries.validation ?? null },
      reputation: registries.reputation ? `/api/erc8004/reputation?network=${network}&agentId=${agentId}` : null,
    };

    if (wallet) {
      if (!isAddress(wallet)) {
        return NextResponse.json({ error: "Invalid wallet address" }, { status: 400, headers: corsHeaders });
      }
      const w = wallet.toLowerCase();
      const isOwner = agent.owner.toLowerCase() === w;
      const isAgentWallet = !!agent.agentWallet && agent.agentWallet.toLowerCase() === w;
      return NextResponse.json(
        { ...card, walletCheck: { wallet, isOwner, isAgentWallet, controls: isOwner || isAgentWallet } },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(card, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/erc8004/verify
 * Cryptographically verify that `wallet` controls agent `agentId`:
 *   1. verify the EIP-191 signature over `message` (EOA + ERC-1271 smart wallets),
 *   2. confirm the signer is the agent owner / bound wallet / authorized on-chain.
 *
 * Body: { network, agentId, wallet, message, signature }
 * The relying app should put a fresh nonce in `message` to prevent replay.
 * Returns { verified, signatureValid, controlType, owner, agentWallet, ... }.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req), 60, 60000).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } });
  }
  try {
    const body = await req.json();
    const { network, agentId, wallet, message, signature } = body ?? {};

    if (!network || agentId === undefined || agentId === null || !wallet || !message || !signature) {
      return NextResponse.json(
        { error: "network, agentId, wallet, message and signature are required" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400, headers: corsHeaders });
    }

    const made = makeClient(network as SupportedNetwork);
    if (made instanceof NextResponse) return made;

    // 1) signature (handles EOA + ERC-1271 smart-contract wallets)
    let signatureValid = false;
    try {
      signatureValid = await made.client.verifyMessage({
        address: wallet as Address,
        message: String(message),
        signature: signature as `0x${string}`,
      });
    } catch {
      signatureValid = false;
    }

    // 2) on-chain control
    const agent = await readAgent(made.client, made.registry, BigInt(agentId));
    if (!agent) {
      return NextResponse.json(
        { verified: false, signatureValid, agentId, network, exists: false, error: "Agent not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const w = (wallet as string).toLowerCase();
    const isOwner = agent.owner.toLowerCase() === w;
    const isAgentWallet = !!agent.agentWallet && agent.agentWallet.toLowerCase() === w;
    let authorized = false;
    if (!isOwner && !isAgentWallet) {
      try {
        authorized = (await made.client.readContract({
          address: made.registry,
          abi: IDENTITY_ABI,
          functionName: "isAuthorizedOrOwner",
          args: [wallet as Address, BigInt(agentId)],
        })) as boolean;
      } catch { /* optional */ }
    }

    const controlType = isOwner ? "owner" : isAgentWallet ? "agentWallet" : authorized ? "authorized" : "none";

    return NextResponse.json(
      {
        verified: signatureValid && controlType !== "none",
        signatureValid,
        controlType,
        network,
        agentId: String(agentId),
        wallet,
        owner: agent.owner,
        agentWallet: agent.agentWallet,
        registry: made.registry,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify" },
      { status: 500, headers: corsHeaders }
    );
  }
}
