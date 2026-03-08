import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { REPUTATION_REGISTRY_ABI, formatValue, isPositiveResponse } from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/reputation
 * Get reputation data from Reputation Registry (EIP-8004 v2: int128 value + valueDecimals)
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID (required)
 * - clientAddress: Filter by specific client (optional)
 * - feedbackIndex: Specific feedback index (optional, requires clientAddress)
 * - tag1: Filter by tag1 (optional)
 * - tag2: Filter by tag2 (optional)
 * - includeRevoked: Include revoked feedback (optional, default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const clientAddress = searchParams.get("clientAddress");
    const feedbackIndex = searchParams.get("feedbackIndex");
    const tag1 = searchParams.get("tag1") || "";
    const tag2 = searchParams.get("tag2") || "";
    const includeRevoked = searchParams.get("includeRevoked") === "true";

    if (!network || !agentId) {
      return NextResponse.json(
        { error: "Network and agentId parameters required" },
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

    if (!chain || !registries.reputation) {
      return NextResponse.json(
        { error: "Invalid network configuration" },
        { status: 500 }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    // Read specific feedback entry
    if (clientAddress && feedbackIndex !== null && feedbackIndex !== undefined) {
      const [value, valueDecimals, feedbackTag1, feedbackTag2, isRevoked] = await client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "readFeedback",
        args: [BigInt(agentId), clientAddress as Address, BigInt(feedbackIndex)],
      }) as [bigint, number, string, string, boolean];

      return NextResponse.json({
        agentId,
        clientAddress,
        feedbackIndex,
        feedback: {
          value: value.toString(),
          valueDecimals,
          formattedValue: formatValue(value, valueDecimals),
          tag1: feedbackTag1,
          tag2: feedbackTag2,
          isRevoked,
        },
        network,
        registryAddress: registries.reputation,
      });
    }

    // Get summary
    const clientAddresses = clientAddress ? [clientAddress as Address] : [];

    const [count, summaryValue, summaryValueDecimals] = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getSummary",
      args: [BigInt(agentId), clientAddresses, tag1, tag2],
    }) as [bigint, bigint, number];

    // Get all clients
    const clients = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getClients",
      args: [BigInt(agentId)],
    }) as Address[];

    // Get all feedback with filtering
    const [
      feedbackClients,
      feedbackIndexes,
      values,
      valueDecimalsArr,
      tag1s,
      tag2s,
      revoked
    ] = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "readAllFeedback",
      args: [BigInt(agentId), clientAddresses, tag1, tag2, includeRevoked],
    }) as [Address[], bigint[], bigint[], number[], string[], string[], boolean[]];

    // Format feedback array
    const feedback = feedbackClients.map((fbClient, i) => ({
      client: fbClient,
      feedbackIndex: feedbackIndexes[i].toString(),
      value: values[i].toString(),
      valueDecimals: valueDecimalsArr[i],
      formattedValue: formatValue(values[i], valueDecimalsArr[i]),
      tag1: tag1s[i],
      tag2: tag2s[i],
      isRevoked: revoked[i],
    }));

    return NextResponse.json({
      agentId,
      summary: {
        count: count.toString(),
        summaryValue: summaryValue.toString(),
        summaryValueDecimals,
        formattedSummary: formatValue(summaryValue, summaryValueDecimals),
      },
      feedback,
      clients,
      totalClients: clients.length,
      network,
      registryAddress: registries.reputation,
    });
  } catch (error) {
    console.error("Error in GET /api/erc8004/reputation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reputation data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/erc8004/reputation
 * Reputation operations (returns unsigned transactions)
 *
 * Actions:
 * - giveFeedback (default): Submit feedback with int128 value + valueDecimals
 * - appendResponse: Respond to feedback
 * - revokeFeedback: Revoke own feedback
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, action = "giveFeedback" } = body;

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

    // Give feedback (v2: int128 value + uint8 valueDecimals)
    if (action === "giveFeedback") {
      const { agentId, value, valueDecimals = 0, tag1, tag2, endpoint, feedbackURI, feedbackHash } = body;

      if (!agentId || value === undefined) {
        return NextResponse.json(
          { error: "agentId and value required" },
          { status: 400 }
        );
      }

      if (valueDecimals < 0 || valueDecimals > 18) {
        return NextResponse.json(
          { error: "valueDecimals must be 0-18" },
          { status: 400 }
        );
      }

      const hasExtendedParams = tag1 || tag2 || endpoint || feedbackURI || feedbackHash;

      const feedbackData = hasExtendedParams ? {
        to: registries.reputation,
        network,
        function: "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
        args: [
          agentId,
          value,
          valueDecimals,
          tag1 || "",
          tag2 || "",
          endpoint || "",
          feedbackURI || "",
          feedbackHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
        description: `Give feedback to agent ${agentId} with value ${value} (${valueDecimals} decimals)`,
      } : {
        to: registries.reputation,
        network,
        function: "giveFeedback(uint256,int128,uint8)",
        args: [agentId, value, valueDecimals],
        description: `Give feedback to agent ${agentId} with value ${value}`,
      };

      return NextResponse.json({
        success: true,
        transaction: feedbackData,
        message: "Sign and submit this transaction to give feedback",
        valueInfo: {
          value,
          valueDecimals,
          formattedValue: formatValue(BigInt(value), valueDecimals),
        },
      });
    }

    // Append response to feedback
    if (action === "appendResponse") {
      const { agentId, clientAddress, feedbackIndex, responseURI, responseHash } = body;

      if (!agentId || !clientAddress || feedbackIndex === undefined || !responseURI) {
        return NextResponse.json(
          { error: "agentId, clientAddress, feedbackIndex, and responseURI required" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.reputation,
          network,
          function: "appendResponse(uint256,address,uint64,string,bytes32)",
          args: [
            agentId,
            clientAddress,
            feedbackIndex,
            responseURI,
            responseHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
          ],
          description: `Append response to feedback #${feedbackIndex} for agent ${agentId}`,
        },
        message: "Sign and submit this transaction to respond to feedback",
      });
    }

    // Revoke feedback
    if (action === "revokeFeedback") {
      const { agentId, feedbackIndex } = body;

      if (!agentId || feedbackIndex === undefined) {
        return NextResponse.json(
          { error: "agentId and feedbackIndex required" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.reputation,
          network,
          function: "revokeFeedback(uint256,uint64)",
          args: [agentId, feedbackIndex],
          description: `Revoke feedback #${feedbackIndex} for agent ${agentId}`,
        },
        message: "Sign and submit this transaction to revoke feedback",
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid: giveFeedback, appendResponse, revokeFeedback` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/reputation:", error);
    return NextResponse.json(
      { error: "Failed to prepare reputation transaction" },
      { status: 500 }
    );
  }
}
