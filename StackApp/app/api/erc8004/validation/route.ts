import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { VALIDATION_REGISTRY_ABI, isPositiveResponse } from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

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

    if (!chain || !registries.validation) {
      return NextResponse.json(
        { error: "Validation registry not available on this network" },
        { status: 400 }
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
          abi: VALIDATION_REGISTRY_ABI,
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
        isPositive: isPositiveResponse(response),
        network,
        registryAddress: registries.validation,
      });
    }

    // Get requests for a validator
    if (validatorAddress) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidatorRequests",
        args: [validatorAddress as Address],
      }) as Hex[];

      return NextResponse.json({
        validatorAddress,
        totalRequests: requestHashes.length,
        requestHashes,
        network,
        registryAddress: registries.validation,
      });
    }

    // Get validations for an agent
    if (agentId) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getAgentValidations",
        args: [BigInt(agentId)],
      }) as Hex[];

      // Get summary
      const validatorAddresses: Address[] = [];
      const [count, averageResponse] = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getSummary",
        args: [BigInt(agentId), validatorAddresses, tag],
      }) as [bigint, number];

      return NextResponse.json({
        agentId,
        summary: {
          count: count.toString(),
          averageResponse,
          isPositive: isPositiveResponse(averageResponse),
        },
        requestHashes,
        totalRequests: requestHashes.length,
        tag: tag || null,
        network,
        registryAddress: registries.validation,
      });
    }

    // Registry info
    const identityRegistry = await client.readContract({
      address: registries.validation as Address,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: "identityRegistry",
    }) as Address;

    return NextResponse.json({
      network,
      registryAddress: registries.validation,
      identityRegistry,
      model: "request-response",
      description: "EIP-8004 v2 validation registry — progressive responses, no status enum",
    });
  } catch (error) {
    console.error("Error in GET /api/erc8004/validation:", error);
    return NextResponse.json(
      { error: "Failed to fetch validation data" },
      { status: 500 }
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

    if (!registries.validation) {
      return NextResponse.json(
        { error: "Validation registry not available on this network" },
        { status: 400 }
      );
    }

    // Request validation
    if (action === "request") {
      const { validatorAddress, agentId, requestURI, requestDataHash } = body;

      if (!validatorAddress || !agentId) {
        return NextResponse.json(
          { error: "validatorAddress and agentId required" },
          { status: 400 }
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
      });
    }

    // Respond to validation (progressive — can be called multiple times)
    if (action === "respond") {
      const { requestHash, response, responseURI, responseDataHash, tag } = body;

      if (!requestHash || response === undefined || !tag) {
        return NextResponse.json(
          { error: "requestHash, response, and tag required" },
          { status: 400 }
        );
      }

      if (response < 0 || response > 100) {
        return NextResponse.json(
          { error: "Response must be 0-100" },
          { status: 400 }
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
          isPositive: isPositiveResponse(response),
          tag,
        },
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid: request, respond` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/validation:", error);
    return NextResponse.json(
      { error: "Failed to prepare validation transaction" },
      { status: 500 }
    );
  }
}
