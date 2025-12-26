import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { config, type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts/erc8004/IdentityRegistry";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/identity
 * Get agent info from Identity Registry
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID to lookup (optional - returns all agents if not provided)
 * - owner: Filter by owner address (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const owner = searchParams.get("owner");

    if (!network) {
      return NextResponse.json(
        { error: "Network parameter required" },
        { status: 400 }
      );
    }

    if (!hasErc8004Registries(network)) {
      return NextResponse.json(
        { error: `ERC-8004 registries not deployed on ${network}` },
        { status: 400 }
      );
    }

    const registries = getErc8004Registries(network);
    const chain = chains[network];

    if (!chain || !registries.identity) {
      return NextResponse.json(
        { error: "Invalid network configuration" },
        { status: 500 }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    // If agentId provided, get specific agent
    if (agentId) {
      const tokenURI = await client.readContract({
        address: registries.identity as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "tokenURI",
        args: [BigInt(agentId)],
      });

      const ownerAddress = await client.readContract({
        address: registries.identity as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
      });

      return NextResponse.json({
        agentId,
        tokenURI,
        owner: ownerAddress,
        network,
        registryAddress: registries.identity,
      });
    }

    // If owner provided, get agents by owner
    if (owner) {
      const agentIds = await client.readContract({
        address: registries.identity as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "getAgentsByOwner",
        args: [owner as Address],
      });

      return NextResponse.json({
        owner,
        agentIds: (agentIds as bigint[]).map(id => id.toString()),
        count: (agentIds as bigint[]).length,
        network,
        registryAddress: registries.identity,
      });
    }

    // Return registry info
    const totalAgents = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "totalAgents",
    });

    const nextAgentId = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "nextAgentId",
    });

    return NextResponse.json({
      network,
      registryAddress: registries.identity,
      totalAgents: (totalAgents as bigint).toString(),
      nextAgentId: (nextAgentId as bigint).toString(),
    });
  } catch (error) {
    console.error("Error in GET /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erc8004/identity
 * Register a new agent (returns unsigned transaction for user to sign)
 *
 * Body:
 * - network: Network name (required)
 * - tokenURI: URI pointing to agent registration file (optional)
 * - metadata: Array of {key, value} pairs (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, tokenURI, metadata } = body;

    if (!network) {
      return NextResponse.json(
        { error: "Network parameter required" },
        { status: 400 }
      );
    }

    if (!hasErc8004Registries(network as SupportedNetwork)) {
      return NextResponse.json(
        { error: `ERC-8004 registries not deployed on ${network}` },
        { status: 400 }
      );
    }

    const registries = getErc8004Registries(network as SupportedNetwork);

    // Build transaction data for registration
    // User will sign this transaction themselves
    const registrationData = {
      to: registries.identity,
      network,
      function: tokenURI
        ? (metadata?.length > 0 ? "register(string,tuple[])" : "register(string)")
        : "register()",
      args: tokenURI
        ? (metadata?.length > 0 ? [tokenURI, metadata] : [tokenURI])
        : [],
      description: "Register as an agent in the ERC-8004 Identity Registry",
    };

    return NextResponse.json({
      success: true,
      transaction: registrationData,
      message: "Sign and submit this transaction to register as an agent",
    });
  } catch (error) {
    console.error("Error in POST /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to prepare registration transaction" },
      { status: 500 }
    );
  }
}
