import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { config, type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { REPUTATION_REGISTRY_ABI } from "@/lib/contracts/erc8004/ReputationRegistry";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/reputation
 * Get reputation data from Reputation Registry
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID to lookup (required)
 * - feedbackIndex: Specific feedback index (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const feedbackIndex = searchParams.get("feedbackIndex");

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

    // If feedbackIndex provided, get specific feedback
    if (feedbackIndex !== null && feedbackIndex !== undefined) {
      const feedback = await client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "readFeedback",
        args: [BigInt(agentId), BigInt(feedbackIndex)],
      });

      return NextResponse.json({
        agentId,
        feedbackIndex,
        feedback: formatFeedback(feedback),
        network,
        registryAddress: registries.reputation,
      });
    }

    // Get summary and all feedback
    const [summary, allFeedback, clients, lastIndex] = await Promise.all([
      client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getSummary",
        args: [BigInt(agentId)],
      }),
      client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "readAllFeedback",
        args: [BigInt(agentId)],
      }),
      client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getClients",
        args: [BigInt(agentId)],
      }),
      client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getLastIndex",
        args: [BigInt(agentId)],
      }),
    ]);

    return NextResponse.json({
      agentId,
      summary: formatSummary(summary),
      feedback: (allFeedback as unknown[]).map(formatFeedback),
      clients,
      lastIndex: (lastIndex as bigint).toString(),
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
 * Body:
 * - network: Network name (required)
 * - agentId: Agent ID (required)
 * - rating: Rating from -100 to +100 (required)
 * - comment: Feedback comment (required)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, agentId, rating, comment } = body;

    if (!network || !agentId || rating === undefined || !comment) {
      return NextResponse.json(
        { error: "Network, agentId, rating, and comment required" },
        { status: 400 }
      );
    }

    if (rating < -100 || rating > 100) {
      return NextResponse.json(
        { error: "Rating must be between -100 and +100" },
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

    // Build transaction data for giving feedback
    const feedbackData = {
      to: registries.reputation,
      network,
      function: "giveFeedback(uint256,int8,string)",
      args: [agentId, rating, comment],
      description: `Give feedback to agent ${agentId} with rating ${rating}`,
    };

    return NextResponse.json({
      success: true,
      transaction: feedbackData,
      message: "Sign and submit this transaction to give feedback",
    });
  } catch (error) {
    console.error("Error in POST /api/erc8004/reputation:", error);
    return NextResponse.json(
      { error: "Failed to prepare feedback transaction" },
      { status: 500 }
    );
  }
}

// Helper functions to format contract responses
function formatFeedback(feedback: unknown): Record<string, unknown> {
  const f = feedback as {
    client: string;
    rating: number;
    comment: string;
    timestamp: bigint;
    revoked: boolean;
    response: string;
  };

  return {
    client: f.client,
    rating: f.rating,
    comment: f.comment,
    timestamp: f.timestamp.toString(),
    revoked: f.revoked,
    response: f.response,
  };
}

function formatSummary(summary: unknown): Record<string, unknown> {
  const s = summary as {
    totalFeedback: bigint;
    activeFeedback: bigint;
    averageRating: bigint;
    positiveCount: bigint;
    negativeCount: bigint;
    neutralCount: bigint;
    lastUpdated: bigint;
  };

  return {
    totalFeedback: s.totalFeedback.toString(),
    activeFeedback: s.activeFeedback.toString(),
    averageRating: (Number(s.averageRating) / 100).toFixed(2),  // Unscale the rating
    positiveCount: s.positiveCount.toString(),
    negativeCount: s.negativeCount.toString(),
    neutralCount: s.neutralCount.toString(),
    lastUpdated: s.lastUpdated.toString(),
  };
}
