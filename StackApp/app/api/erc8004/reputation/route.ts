import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
// Inline ABI matching official ReputationRegistryUpgradeable
const REPUTATION_ABI = [
  { name: "giveFeedback", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "value", type: "int128" }, { name: "valueDecimals", type: "uint8" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "endpoint", type: "string" }, { name: "feedbackURI", type: "string" }, { name: "feedbackHash", type: "bytes32" }], outputs: [] },
  { name: "revokeFeedback", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "feedbackIndex", type: "uint64" }], outputs: [] },
  { name: "appendResponse", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddress", type: "address" }, { name: "feedbackIndex", type: "uint64" }, { name: "responseURI", type: "string" }, { name: "responseHash", type: "bytes32" }], outputs: [] },
  { name: "readFeedback", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddress", type: "address" }, { name: "feedbackIndex", type: "uint64" }], outputs: [{ name: "value", type: "int128" }, { name: "valueDecimals", type: "uint8" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "isRevoked", type: "bool" }] },
  { name: "getSummary", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }], outputs: [{ name: "count", type: "uint64" }, { name: "summaryValue", type: "int128" }, { name: "summaryValueDecimals", type: "uint8" }] },
  { name: "readAllFeedback", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddresses", type: "address[]" }, { name: "tag1", type: "string" }, { name: "tag2", type: "string" }, { name: "includeRevoked", type: "bool" }], outputs: [{ name: "clients", type: "address[]" }, { name: "feedbackIndexes", type: "uint64[]" }, { name: "values", type: "int128[]" }, { name: "valueDecimalsArr", type: "uint8[]" }, { name: "tag1s", type: "string[]" }, { name: "tag2s", type: "string[]" }, { name: "revokedStatuses", type: "bool[]" }] },
  { name: "getClients", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "address[]" }] },
  { name: "getLastIndex", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddress", type: "address" }], outputs: [{ name: "", type: "uint64" }] },
  { name: "getResponseCount", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "clientAddress", type: "address" }, { name: "feedbackIndex", type: "uint64" }, { name: "responders", type: "address[]" }], outputs: [{ name: "count", type: "uint64" }] },
  { name: "getIdentityRegistry", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "getVersion", type: "function", stateMutability: "pure", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

function formatValue(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const str = value.toString().padStart(decimals + 1, '0');
  return str.slice(0, -decimals) + '.' + str.slice(-decimals);
}

export const dynamic = "force-dynamic";

/** GET /api/erc8004/reputation — Query reputation data from Reputation Registry. */
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
    const chain = getChainByNetwork(network);

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

    if (clientAddress && feedbackIndex !== null && feedbackIndex !== undefined) {
      const [value, valueDecimals, feedbackTag1, feedbackTag2, isRevoked] = await client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_ABI,
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

    const clients = await client.readContract({
      address: registries.reputation as Address,
      abi: REPUTATION_ABI,
      functionName: "getClients",
      args: [BigInt(agentId)],
    }) as Address[];

    const clientAddresses = clientAddress
      ? [clientAddress as Address]
      : clients.length > 0 ? clients : [];

    let count = 0n, summaryValue = 0n, summaryValueDecimals = 0;
    if (clientAddresses.length > 0) {
      [count, summaryValue, summaryValueDecimals] = await client.readContract({
        address: registries.reputation as Address,
        abi: REPUTATION_ABI,
        functionName: "getSummary",
        args: [BigInt(agentId), clientAddresses, tag1, tag2],
      }) as [bigint, bigint, number];
    }

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
      abi: REPUTATION_ABI,
      functionName: "readAllFeedback",
      args: [BigInt(agentId), clientAddresses, tag1, tag2, includeRevoked],
    }) as [Address[], bigint[], bigint[], number[], string[], string[], boolean[]];

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

/** POST /api/erc8004/reputation — Reputation operations (returns unsigned transactions). */
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
      } : {
        to: registries.reputation,
        network,
        function: "giveFeedback(uint256,int128,uint8)",
        args: [agentId, value, valueDecimals],
      };

      return NextResponse.json({
        success: true,
        transaction: feedbackData,
        valueInfo: {
          value,
          valueDecimals,
          formattedValue: formatValue(BigInt(value), valueDecimals),
        },
      });
    }

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
        },
      });
    }

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
        },
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
