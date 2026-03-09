import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { getChainByNetwork } from "@/lib/utils/chains";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
// Inline ABI matching official ValidationRegistryUpgradeable
const VALIDATION_ABI = [
  { name: "validationRequest", type: "function", stateMutability: "nonpayable", inputs: [{ name: "validatorAddress", type: "address" }, { name: "agentId", type: "uint256" }, { name: "requestURI", type: "string" }, { name: "requestHash", type: "bytes32" }], outputs: [] },
  { name: "validationResponse", type: "function", stateMutability: "nonpayable", inputs: [{ name: "requestHash", type: "bytes32" }, { name: "response", type: "uint8" }, { name: "responseURI", type: "string" }, { name: "responseHash", type: "bytes32" }, { name: "tag", type: "string" }], outputs: [] },
  { name: "getValidationStatus", type: "function", stateMutability: "view", inputs: [{ name: "requestHash", type: "bytes32" }], outputs: [{ name: "validatorAddress", type: "address" }, { name: "agentId", type: "uint256" }, { name: "response", type: "uint8" }, { name: "responseHash", type: "bytes32" }, { name: "tag", type: "string" }, { name: "lastUpdate", type: "uint256" }] },
  { name: "getSummary", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "validatorAddresses", type: "address[]" }, { name: "tag", type: "string" }], outputs: [{ name: "count", type: "uint64" }, { name: "averageResponse", type: "uint8" }] },
  { name: "getAgentValidations", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "bytes32[]" }] },
  { name: "getValidatorRequests", type: "function", stateMutability: "view", inputs: [{ name: "validatorAddress", type: "address" }], outputs: [{ name: "", type: "bytes32[]" }] },
  { name: "getIdentityRegistry", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "getVersion", type: "function", stateMutability: "pure", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

/**
 * GET /api/erc8004/validation
 * Get validation data from Validation Registry (EIP-8004 v2: simplified, no enum)
 *
 * Query params:
 * - network: Network name (required)
 * - requestHash: Specific validation request hash (optional)
 * - agentId: Get all validations for agent (optional)
 * - validatorAddress: Get all requests for validator (optional)
 * - tag: Filter by tag (optional, requires agentId)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const requestHash = searchParams.get("requestHash");
    const agentId = searchParams.get("agentId");
    const validatorAddress = searchParams.get("validatorAddress");
    const tag = searchParams.get("tag") || "";

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

    if (!chain || !registries.validation) {
      return NextResponse.json(
        { error: "Validation registry not available on this network" },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    // Get specific validation by requestHash
    if (requestHash) {
      const [validator, validationAgentId, response, responseHash, responseTag, lastUpdate] =
        await client.readContract({
          address: registries.validation as Address,
          abi: VALIDATION_ABI,
          functionName: "getValidationStatus",
          args: [requestHash as Hex],
        }) as [Address, bigint, number, Hex, string, bigint];

      return NextResponse.json({
        requestHash,
        validatorAddress: validator,
        agentId: validationAgentId.toString(),
        response,
        responseHash,
        tag: responseTag,
        lastUpdate: lastUpdate.toString(),
        isPositive: response > 50,
        network,
        registryAddress: registries.validation,
    }, { headers: corsHeaders });
    }

    // Get requests for a validator
    if (validatorAddress) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_ABI,
        functionName: "getValidatorRequests",
        args: [validatorAddress as Address],
      }) as Hex[];

      return NextResponse.json({
        validatorAddress,
        totalRequests: requestHashes.length,
        requestHashes,
        network,
        registryAddress: registries.validation,
    }, { headers: corsHeaders });
    }

    // Get validations for an agent
    if (agentId) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_ABI,
        functionName: "getAgentValidations",
        args: [BigInt(agentId)],
      }) as Hex[];

      // Get summary
      const validatorAddresses: Address[] = [];
      const [count, averageResponse] = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_ABI,
        functionName: "getSummary",
        args: [BigInt(agentId), validatorAddresses, tag],
      }) as [bigint, number];

      return NextResponse.json({
        agentId,
        summary: {
          count: count.toString(),
          averageResponse,
          isPositive: averageResponse > 50,
        },
        requestHashes,
        totalRequests: requestHashes.length,
        tag: tag || null,
        network,
        registryAddress: registries.validation,
    }, { headers: corsHeaders });
    }

    // Registry info
    const identityRegistry = await client.readContract({
      address: registries.validation as Address,
      abi: VALIDATION_ABI,
      functionName: "getIdentityRegistry",
    }) as Address;

    return NextResponse.json({
      network,
      registryAddress: registries.validation,
      identityRegistry,
      model: "request-response",
      description: "EIP-8004 v2 validation registry — progressive responses, no status enum",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error in GET /api/erc8004/validation:", error);
    return NextResponse.json(
      { error: "Failed to fetch validation data" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/erc8004/validation
 * Validation operations (returns unsigned transactions)
 *
 * Actions:
 * - request: Request validation from a validator
 * - respond: Submit validation response (can be called multiple times — progressive)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network, action } = body;

    if (!network || !action) {
      return NextResponse.json(
        { error: "Network and action parameters required" },
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

    if (!registries.validation) {
      return NextResponse.json(
        { error: "Validation registry not available on this network" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Request validation
    if (action === "request") {
      const { validatorAddress, agentId, requestURI, requestDataHash } = body;

      if (!validatorAddress || !agentId) {
        return NextResponse.json(
          { error: "validatorAddress and agentId required" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.validation,
          network,
          function: "validationRequest(address,uint256,string,bytes32)",
          args: [
            validatorAddress,
            agentId,
            requestURI || "",
            requestDataHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
          ],
          description: `Request validation for agent ${agentId} from ${validatorAddress}`,
        },
        message: "Sign and submit this transaction to request validation",
    }, { headers: corsHeaders });
    }

    // Respond to validation (progressive — can be called multiple times)
    if (action === "respond") {
      const { requestHash, response, responseURI, responseDataHash, tag } = body;

      if (!requestHash || response === undefined || !tag) {
        return NextResponse.json(
          { error: "requestHash, response, and tag required" },
          { status: 400, headers: corsHeaders }
        );
      }

      if (response < 0 || response > 100) {
        return NextResponse.json(
          { error: "Response must be 0-100" },
          { status: 400, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        success: true,
        transaction: {
          to: registries.validation,
          network,
          function: "validationResponse(bytes32,uint8,string,bytes32,string)",
          args: [
            requestHash,
            response,
            responseURI || "",
            responseDataHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
            tag,
          ],
          description: `Respond to validation ${requestHash} with score ${response}`,
        },
        message: "Sign and submit this transaction to respond to validation",
        note: "Progressive validation: this function can be called multiple times to update the response",
        responseInfo: {
          response,
          isPositive: response > 50,
          tag,
        },
    }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid: request, respond` },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/validation:", error);
    return NextResponse.json(
      { error: "Failed to prepare validation transaction" },
      { status: 500, headers: corsHeaders }
    );
  }
}
