import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { REPUTATION_REGISTRY_ABI, type Feedback, isScoreApproved } from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/reputation
 * Get reputation data from Reputation Registry (EIP-8004 compliant)
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID to lookup (required)
 * - clientAddress: Filter by specific client (optional)
 * - feedbackIndex: Specific feedback index for a client (optional, requires clientAddress)
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

    // If clientAddress and feedbackIndex provided, get specific feedback
    if (clientAddress && feedbackIndex !== null && feedbackIndex !== undefined) {
      const [score, feedbackTag1, feedbackTag2, isRevoked] = await client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "readFeedback",
        args: [BigInt(agentId), clientAddress as Address, BigInt(feedbackIndex)],
      }) as [number, string, string, boolean];

      return NextResponse.json({
        agentId,
        clientAddress,
        feedbackIndex,
        feedback: {
          score,
          tag1: feedbackTag1,
          tag2: feedbackTag2,
          isRevoked,
          isPositive: isScoreApproved(score),
        },
        network,
        registryAddress: registries.reputation,
      });
    }

    // Get summary with optional tag filtering
    const clientAddresses = clientAddress ? [clientAddress as Address] : [];

    const [count, averageScore] = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getSummary",
      args: [BigInt(agentId), clientAddresses, tag1, tag2],
    }) as [bigint, number];

    // Get all clients who have given feedback
    const clients = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getClients",
      args: [BigInt(agentId)],
    }) as Address[];

    // Get all feedback with filtering
    const [
      feedbackClients,
      scores,
      tag1s,
      tag2s,
      revoked
    ] = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "readAllFeedback",
      args: [BigInt(agentId), clientAddresses, tag1, tag2, includeRevoked],
    }) as [Address[], number[], string[], string[], boolean[]];

    // Format feedback array
    const feedback = feedbackClients.map((client, i) => ({
      client,
      score: scores[i],
      tag1: tag1s[i],
      tag2: tag2s[i],
      isRevoked: revoked[i],
      isPositive: isScoreApproved(scores[i]),
    }));

    return NextResponse.json({
      agentId,
      summary: {
        count: count.toString(),
        averageScore,
        isPositiveAverage: isScoreApproved(averageScore),
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
 * Submit feedback (returns unsigned transaction for user to sign)
 *
 * Body for simple feedback:
 * - network: Network name (required)
 * - agentId: Agent ID (required)
 * - score: Score from 0 to 100 (required)
 *
 * Body for full feedback (EIP-8004 compliant):
 * - network: Network name (required)
 * - agentId: Agent ID (required)
 * - score: Score from 0 to 100 (required)
 * - tag1: Categorization tag (optional)
 * - tag2: Secondary tag (optional)
 * - endpoint: Endpoint reference (optional)
 * - feedbackURI: URI to detailed feedback (optional)
 * - feedbackHash: Hash of off-chain feedback (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, agentId, score, tag1, tag2, endpoint, feedbackURI, feedbackHash } = body;

    if (!network || !agentId || score === undefined) {
      return NextResponse.json(
        { error: "Network, agentId, and score required" },
        { status: 400 }
      );
    }

    if (score < 0 || score > 100) {
      return NextResponse.json(
        { error: "Score must be between 0 and 100 (EIP-8004 compliant)" },
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

    // Determine if using simple or full feedback function
    const hasExtendedParams = tag1 || tag2 || endpoint || feedbackURI || feedbackHash;

    let feedbackData;
    if (hasExtendedParams) {
      // Full EIP-8004 compliant feedback
      feedbackData = {
        to: registries.reputation,
        network,
        function: "giveFeedback(uint256,uint8,string,string,string,string,bytes32)",
        args: [
          agentId,
          score,
          tag1 || "",
          tag2 || "",
          endpoint || "",
          feedbackURI || "",
          feedbackHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
        description: `Give feedback to agent ${agentId} with score ${score}`,
      };
    } else {
      // Simple feedback with just score
      feedbackData = {
        to: registries.reputation,
        network,
        function: "giveFeedback(uint256,uint8)",
        args: [agentId, score],
        description: `Give simple feedback to agent ${agentId} with score ${score}`,
      };
    }

    return NextResponse.json({
      success: true,
      transaction: feedbackData,
      message: "Sign and submit this transaction to give feedback",
      scoreInfo: {
        score,
        isPositive: isScoreApproved(score),
        threshold: 50,
        description: score > 50 ? "Positive feedback" : score === 50 ? "Neutral feedback" : "Negative feedback",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/erc8004/reputation:", error);
    return NextResponse.json(
      { error: "Failed to prepare feedback transaction" },
      { status: 500 }
    );
  }
}
