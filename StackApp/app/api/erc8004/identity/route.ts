import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

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

/** GET /api/erc8004/identity — Query agent info from Identity Registry. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const owner = searchParams.get("owner");
    const action = searchParams.get("action");

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
    const chain = getChainByNetwork(network);

    if (!chain || !registries.identity) {
      return NextResponse.json(
        { error: `Chain config not found for ${network}` },
        { status: 500 }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    if (action === "getWallet" && agentId) {
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
      });
    }

    if (agentId) {
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
      });
    }

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
      });
    }

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
    });
  } catch (error) {
    console.error("Error in GET /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 }
    );
  }
}

/** POST /api/erc8004/identity — Agent identity operations (returns unsigned transactions). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, action = "register" } = body;

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
      };

      return NextResponse.json({
        success: true,
        transaction: registrationData,
      });
    }

    // Set agent URI
    if (action === "setURI") {
      const { agentId, newURI } = body;
      if (!agentId || !newURI) {
        return NextResponse.json(
          { error: "agentId and newURI required for setURI" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "setAgentURI(uint256,string)",
          args: [agentId, newURI],
        },
      });
    }

    // Set agent wallet (EIP-712 signature verified)
    if (action === "setWallet") {
      const { agentId, newWallet, deadline, signature } = body;
      if (!agentId || !newWallet || !deadline || !signature) {
        return NextResponse.json(
          { error: "agentId, newWallet, deadline, and signature required for setWallet" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "setAgentWallet(uint256,address,uint256,bytes)",
          args: [agentId, newWallet, deadline, signature],
        },
      });
    }

    // Unset agent wallet
    if (action === "unsetWallet") {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: "agentId required for unsetWallet" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.identity,
          network,
          function: "unsetAgentWallet(uint256)",
          args: [agentId],
        },
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid: register, setURI, setWallet, unsetWallet` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/identity:", error);
    return NextResponse.json(
      { error: "Failed to prepare identity transaction" },
      { status: 500 }
    );
  }
}
