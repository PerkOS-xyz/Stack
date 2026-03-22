import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

// Minimal ABI matching the official IdentityRegistryUpgradeable contract
const IDENTITY_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getAgentWallet", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "getMetadata", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "metadataKey", type: "string" }], outputs: [{ type: "bytes" }] },
  { name: "getVersion", type: "function", stateMutability: "pure", inputs: [], outputs: [{ type: "string" }] },
  { name: "isAuthorizedOrOwner", type: "function", stateMutability: "view", inputs: [{ name: "spender", type: "address" }, { name: "agentId", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

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
          abi: IDENTITY_ABI,
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
          abi: IDENTITY_ABI,
          functionName: "tokenURI",
          args: [BigInt(agentId)],
        });

        const ownerAddress = await client.readContract({
          address: registries.identity as Address,
          abi: IDENTITY_ABI,
          functionName: "ownerOf",
          args: [BigInt(agentId)],
        });

        let wallet: unknown = null;
        try {
          wallet = await client.readContract({
            address: registries.identity as Address,
            abi: IDENTITY_ABI,
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
        abi: IDENTITY_ABI,
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
        abi: IDENTITY_ABI,
        functionName: "getVersion",
      }) as string;
    } catch { /* may not exist */ }

    const name = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_ABI,
      functionName: "name",
    });

    const symbol = await client.readContract({
      address: registries.identity as Address,
      abi: IDENTITY_ABI,
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

    // Register new agent
    if (action === "register") {
      const { tokenURI, metadata } = body;
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
}, { headers: corsHeaders });
    }

    // Set agent URI
    if (action === "setURI") {
      const { agentId, newURI } = body;
      if (!agentId || !newURI) {
        return NextResponse.json(
          { error: "agentId and newURI required for setURI" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "setAgentURI(uint256,string)",
          args: [agentId, newURI],
          description: `Update URI for agent ${agentId}`,
        },
        message: "Sign and submit this transaction to update agent URI",
}, { headers: corsHeaders });
    }

    // Set agent wallet (EIP-712 signature verified)
    if (action === "setWallet") {
      const { agentId, newWallet, deadline, signature } = body;
      if (!agentId || !newWallet || !deadline || !signature) {
        return NextResponse.json(
          { error: "agentId, newWallet, deadline, and signature required for setWallet" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "setAgentWallet(uint256,address,uint256,bytes)",
          args: [agentId, newWallet, deadline, signature],
          description: `Set wallet for agent ${agentId} to ${newWallet}`,
        },
        message: "Sign and submit this transaction to set agent wallet",
}, { headers: corsHeaders });
    }

    // Unset agent wallet
    if (action === "unsetWallet") {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: "agentId required for unsetWallet" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "unsetAgentWallet(uint256)",
          args: [agentId],
          description: `Remove wallet for agent ${agentId}`,
        },
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
