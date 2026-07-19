import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, encodeFunctionData, http, type Address, type Hex } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";
import { IDENTITY_REGISTRY_ABI } from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * GET /api/erc8004/identity
 * Get agent info from Identity Registry (official ERC-8004 contracts)
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID to lookup (optional — returns registry info if not provided)
 * - owner: Get agent count for owner address (optional)
 * - action: "getWallet" to get agent wallet (optional, requires agentId)
 */
export async function GET(req: NextRequest) {
  // Rate limit: 60 requests per minute per IP
  const clientIp = getClientIp(req);
  const rateLimitResult = rateLimit(clientIp, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const owner = searchParams.get("owner");
    const action = searchParams.get("action");

    if (!network) {
      return NextResponse.json(
        { error: "Network parameter required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!hasErc8004Registries(network)) {
      return NextResponse.json(
        { error: `ERC-8004 registries not deployed on ${network}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const registries = getErc8004Registries(network);
    const chain = getChainByNetwork(network);

    if (!chain || !registries.identity) {
      return NextResponse.json(
        { error: `Chain config not found for ${network}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    // Get agent wallet
    if (action === "getWallet" && agentId) {
      try {
        const wallet = await client.readContract({
          address: registries.identity as Address,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "getAgentWallet",
          args: [BigInt(agentId)],
        });

        return NextResponse.json({
          agentId,
          wallet,
          network,
          registryAddress: registries.identity,
        }, { headers: corsHeaders });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("revert") || msg.includes("ERC721") || msg.includes("nonexistent")) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404, headers: corsHeaders });
        }
        throw err;
      }
    }

    // Get specific agent
    if (agentId) {
      try {
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

        let wallet: unknown = null;
        try {
          wallet = await client.readContract({
            address: registries.identity as Address,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: "getAgentWallet",
            args: [BigInt(agentId)],
          });
        } catch {
          // agentWallet may be unset
        }

        return NextResponse.json({
          agentId,
          tokenURI,
          owner: ownerAddress,
          wallet,
          network,
          registryAddress: registries.identity,
        }, { headers: corsHeaders });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("revert") || msg.includes("ERC721") || msg.includes("nonexistent")) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404, headers: corsHeaders });
        }
        throw err;
      }
    }

    // Get agent count for owner
    if (owner) {
      const balance = await client.readContract({
        address: registries.identity as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "balanceOf",
        args: [owner as Address],
      });

      return NextResponse.json({
        owner,
        agentCount: (balance as bigint).toString(),
        network,
        registryAddress: registries.identity,
}, { headers: corsHeaders });
    }

    // Return registry info (no totalAgents in official contract — use ERC-721 standard)
    let version = "unknown";
    try {
      version = await client.readContract({
        address: registries.identity as Address,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "getVersion",
      }) as string;
    } catch { /* may not exist */ }

    const name = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "name",
    });

    const symbol = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "symbol",
    });

    return NextResponse.json({
      network,
      registryAddress: registries.identity,
      name,
      symbol,
      version,
      spec: "ERC-8004",
}, { headers: corsHeaders });
  } catch (error) {
    console.error("Error in GET /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/erc8004/identity
 * Agent identity operations (returns unsigned transactions)
 *
 * Actions:
 * - register: Register a new agent
 * - setURI: Update agent URI
 * - setWallet: Set agent wallet (EIP-712 signature required)
 * - unsetWallet: Remove agent wallet
 *
 * Body:
 * - network: Network name (required)
 * - action: Operation to perform (default: "register")
 * - agentId: Agent ID (required for setURI, setWallet, unsetWallet)
 * - tokenURI/newURI: URI for registration/update
 * - metadata: Array of {metadataKey, metadataValue} pairs (optional, register only)
 * - newWallet: New wallet address (setWallet only)
 * - deadline: Signature deadline (setWallet only)
 * - signature: EIP-712/ERC-1271 signature (setWallet only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, action = "register" } = body;

    if (!network) {
      return NextResponse.json(
        { error: "Network parameter required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!hasErc8004Registries(network as SupportedNetwork)) {
      return NextResponse.json(
        { error: `ERC-8004 registries not deployed on ${network}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const registries = getErc8004Registries(network as SupportedNetwork);
    const chain = getChainByNetwork(network);
    if (!chain || !registries.identity) {
      return NextResponse.json(
        { error: `Chain config not found for ${network}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const transaction = (data: Hex, details: { function: string; args: unknown[]; description: string }) => ({
      to: registries.identity as Address,
      data,
      value: "0",
      chainId: chain.id,
      network,
      ...details,
    });

    // Register new agent
    if (action === "register") {
      const { tokenURI, metadata } = body;
      if (tokenURI) {
        try { new URL(tokenURI); } catch {
          return NextResponse.json({ error: "tokenURI must be a valid URL" }, { status: 400, headers: corsHeaders });
        }
      }
      if (metadata !== undefined && !Array.isArray(metadata)) {
        return NextResponse.json({ error: "metadata must be an array" }, { status: 400, headers: corsHeaders });
      }

      const hasMetadata = Array.isArray(metadata) && metadata.length > 0;
      if (hasMetadata && metadata.some((entry: unknown) => {
        if (!entry || typeof entry !== "object") return true;
        const value = entry as Record<string, unknown>;
        return typeof value.metadataKey !== "string" ||
          value.metadataKey.length === 0 ||
          value.metadataKey === "agentWallet" ||
          typeof value.metadataValue !== "string" ||
          !/^0x(?:[a-fA-F0-9]{2})*$/.test(value.metadataValue);
      })) {
        return NextResponse.json(
          { error: "Each metadata entry needs a non-reserved metadataKey and hex metadataValue" },
          { status: 400, headers: corsHeaders }
        );
      }
      const data = tokenURI && hasMetadata
        ? encodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, functionName: "register", args: [tokenURI, metadata] })
        : tokenURI
          ? encodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, functionName: "register", args: [tokenURI] })
          : encodeFunctionData({ abi: IDENTITY_REGISTRY_ABI, functionName: "register", args: [] });
      const registrationData = transaction(data, {
        function: tokenURI
          ? (hasMetadata ? "register(string,tuple[])" : "register(string)")
          : "register()",
        args: tokenURI ? (hasMetadata ? [tokenURI, metadata] : [tokenURI]) : [],
        description: "Register as an agent in the ERC-8004 Identity Registry",
      });

      return NextResponse.json({
        success: true,
        transaction: registrationData,
        message: "Sign and submit this transaction to register as an agent",
}, { headers: corsHeaders });
    }

    // Set agent URI
    if (action === "setURI") {
      const { agentId, newURI } = body;
      if (agentId === undefined || !newURI) {
        return NextResponse.json(
          { error: "agentId and newURI required for setURI" },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!/^(0|[1-9]\d*)$/.test(String(agentId))) {
        return NextResponse.json({ error: "agentId must be a non-negative integer" }, { status: 400, headers: corsHeaders });
      }
      try { new URL(newURI); } catch {
        return NextResponse.json({ error: "newURI must be a valid URL" }, { status: 400, headers: corsHeaders });
      }

      const data = encodeFunctionData({
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "setAgentURI",
        args: [BigInt(agentId), newURI],
      });

      return NextResponse.json({
        success: true,
        transaction: transaction(data, {
          function: "setAgentURI(uint256,string)",
          args: [agentId, newURI],
          description: `Update URI for agent ${agentId}`,
        }),
        message: "Sign and submit this transaction to update agent URI",
}, { headers: corsHeaders });
    }

    // Set agent wallet (EIP-712 signature verified)
    if (action === "setWallet") {
      const { agentId, newWallet, deadline, signature } = body;
      if (agentId === undefined || !newWallet || !deadline || !signature) {
        return NextResponse.json(
          { error: "agentId, newWallet, deadline, and signature required for setWallet" },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!/^(0|[1-9]\d*)$/.test(String(agentId)) || !/^[1-9]\d*$/.test(String(deadline))) {
        return NextResponse.json({ error: "agentId or deadline has an invalid format" }, { status: 400, headers: corsHeaders });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(newWallet) || !/^0x(?:[a-fA-F0-9]{2})+$/.test(signature)) {
        return NextResponse.json({ error: "newWallet or signature has an invalid format" }, { status: 400, headers: corsHeaders });
      }
      const data = encodeFunctionData({
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "setAgentWallet",
        args: [BigInt(agentId), newWallet as Address, BigInt(deadline), signature as Hex],
      });

      return NextResponse.json({
        success: true,
        transaction: transaction(data, {
          function: "setAgentWallet(uint256,address,uint256,bytes)",
          args: [agentId, newWallet, deadline, signature],
          description: `Set wallet for agent ${agentId} to ${newWallet}`,
        }),
        message: "Sign and submit this transaction to set agent wallet",
}, { headers: corsHeaders });
    }

    // Unset agent wallet
    if (action === "unsetWallet") {
      const { agentId } = body;
      if (agentId === undefined) {
        return NextResponse.json(
          { error: "agentId required for unsetWallet" },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!/^(0|[1-9]\d*)$/.test(String(agentId))) {
        return NextResponse.json({ error: "agentId must be a non-negative integer" }, { status: 400, headers: corsHeaders });
      }
      const data = encodeFunctionData({
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "unsetAgentWallet",
        args: [BigInt(agentId)],
      });

      return NextResponse.json({
        success: true,
        transaction: transaction(data, {
          function: "unsetAgentWallet(uint256)",
          args: [agentId],
          description: `Remove wallet for agent ${agentId}`,
        }),
        message: "Sign and submit this transaction to remove agent wallet",
}, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid: register, setURI, setWallet, unsetWallet` },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to prepare identity transaction" },
      { status: 500, headers: corsHeaders }
    );
  }
}
