import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import {
  VALIDATION_REGISTRY_ABI,
  ValidationStatus,
  type ValidationRequest,
  type ValidationSummary,
  isValidationApproved,
  getValidationStatusString,
} from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/validation
 * Get validation data from Validation Registry (EIP-8004 request-response model)
 *
 * Query params:
 * - network: Network name (required)
 * - requestHash: Specific validation request hash (optional)
 * - agentId: Get all validations for agent (optional)
 * - validatorAddress: Get all requests assigned to validator (optional)
 * - tag: Filter by categorization tag (optional, requires agentId)
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
        { error: "Invalid network configuration" },
        { status: 500 }
      );
    }

    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(network)),
    });

    // If requestHash provided, get specific validation request
    if (requestHash) {
      const [status, validationAgentId, validator, response, responseTag] = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidationStatus",
        args: [requestHash as Hex],
      }) as [number, bigint, Address, number, string];

      // Get full validation details
      const validation = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidation",
        args: [requestHash as Hex],
      }) as ValidationRequest;

      return NextResponse.json({
        requestHash,
        status: getValidationStatusString(status as ValidationStatus),
        statusCode: status,
        agentId: validationAgentId.toString(),
        validatorAddress: validator,
        response,
        tag: responseTag,
        isApproved: isValidationApproved(status as ValidationStatus),
        validation: formatValidationRequest(validation),
        network,
        registryAddress: registries.validation,
      });
    }

    // If validatorAddress provided, get requests assigned to this validator
    if (validatorAddress) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidatorRequests",
        args: [validatorAddress as Address],
      }) as Hex[];

      // Get pending requests count
      const pendingRequests = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getPendingRequests",
        args: [validatorAddress as Address],
      }) as Hex[];

      return NextResponse.json({
        validatorAddress,
        totalRequests: requestHashes.length,
        pendingCount: pendingRequests.length,
        requestHashes,
        pendingRequestHashes: pendingRequests,
        network,
        registryAddress: registries.validation,
      });
    }

    // If agentId provided, get all validations for this agent
    if (agentId) {
      const requestHashes = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getAgentValidations",
        args: [BigInt(agentId)],
      }) as Hex[];

      // Get summary with optional tag and validator filtering
      const validatorAddresses: Address[] = [];
      const [count, averageResponse] = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getSummary",
        args: [BigInt(agentId), validatorAddresses, tag],
      }) as [bigint, number];

      // Check if agent has any approved validation with the tag
      const hasApproval = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "hasApprovedValidation",
        args: [BigInt(agentId), tag],
      }) as boolean;

      // Get validation statistics
      const statistics = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidationStatistics",
        args: [BigInt(agentId)],
      }) as ValidationSummary;

      return NextResponse.json({
        agentId,
        summary: {
          count: count.toString(),
          averageResponse,
          isPositiveAverage: averageResponse > 50,
        },
        hasApproval,
        statistics: formatValidationSummary(statistics),
        requestHashes,
        totalRequests: requestHashes.length,
        tag: tag || null,
        network,
        registryAddress: registries.validation,
      });
    }

    // Return registry info
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
      description: "EIP-8004 compliant validation registry using request-response model",
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
 * Create validation request or submit response (returns unsigned transaction)
 *
 * Body for validation request:
 * - network: Network name (required)
 * - action: "request" (required)
 * - validatorAddress: Address of validator to request (required)
 * - agentId: Agent ID being validated (required)
 * - requestURI: URI to validation request details (optional)
 * - requestDataHash: Hash of request data for verification (optional)
 *
 * Body for validation response (validator only):
 * - network: Network name (required)
 * - action: "respond" (required)
 * - requestHash: The unique request identifier (required)
 * - response: Response score from 0 to 100 (required)
 * - responseURI: URI to detailed response (optional)
 * - responseDataHash: Hash of response data (optional)
 * - tag: Categorization tag (required)
 *
 * Body for cancel request:
 * - network: Network name (required)
 * - action: "cancel" (required)
 * - requestHash: The unique request identifier (required)
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

    // Request validation from a validator
    if (action === "request") {
      const { validatorAddress, agentId, requestURI, requestDataHash } = body;

      if (!validatorAddress || !agentId) {
        return NextResponse.json(
          { error: "validatorAddress and agentId required for validation request" },
          { status: 400 }
        );
      }

      const requestData = {
        to: registries.validation,
        network,
        function: "validationRequest(address,uint256,string,bytes32)",
        args: [
          validatorAddress,
          agentId,
          requestURI || "",
          requestDataHash || "0x0000000000000000000000000000000000000000000000000000000000000000",
        ],
        description: `Request validation for agent ${agentId} from validator ${validatorAddress}`,
      };

      return NextResponse.json({
        success: true,
        transaction: requestData,
        message: "Sign and submit this transaction to request validation",
        info: {
          model: "request-response",
          note: "The validator will respond with a score (0-100) and categorization tag",
        },
      });
    }

    // Respond to a validation request (validator only)
    if (action === "respond") {
      const { requestHash, response, responseURI, responseDataHash, tag } = body;

      if (!requestHash || response === undefined || !tag) {
        return NextResponse.json(
          { error: "requestHash, response, and tag required for validation response" },
          { status: 400 }
        );
      }

      if (response < 0 || response > 100) {
        return NextResponse.json(
          { error: "Response must be between 0 and 100 (EIP-8004 compliant)" },
          { status: 400 }
        );
      }

      const responseData = {
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
        description: `Respond to validation request ${requestHash} with score ${response}`,
      };

      return NextResponse.json({
        success: true,
        transaction: responseData,
        message: "Sign and submit this transaction to respond to validation request",
        responseInfo: {
          response,
          willBeApproved: response > 50,
          tag,
          threshold: 50,
          description: response > 50 ? "Will be approved" : "Will be rejected",
        },
      });
    }

    // Cancel a pending validation request
    if (action === "cancel") {
      const { requestHash } = body;

      if (!requestHash) {
        return NextResponse.json(
          { error: "requestHash required for cancel action" },
          { status: 400 }
        );
      }

      const cancelData = {
        to: registries.validation,
        network,
        function: "cancelValidation(bytes32)",
        args: [requestHash],
        description: `Cancel validation request ${requestHash}`,
      };

      return NextResponse.json({
        success: true,
        transaction: cancelData,
        message: "Sign and submit this transaction to cancel the validation request",
        note: "Only the original requester or agent owner can cancel",
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid actions: request, respond, cancel` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in POST /api/erc8004/validation:", error);
    return NextResponse.json(
      { error: "Failed to prepare transaction" },
      { status: 500 }
    );
  }
}

// Helper functions to format contract responses
function formatValidationRequest(validation: ValidationRequest): Record<string, unknown> {
  return {
    agentId: validation.agentId.toString(),
    requester: validation.requester,
    validatorAddress: validation.validatorAddress,
    requestURI: validation.requestURI,
    requestDataHash: validation.requestDataHash,
    requestedAt: validation.requestedAt.toString(),
    status: getValidationStatusString(validation.status),
    statusCode: validation.status,
    response: validation.response,
    responseURI: validation.responseURI,
    responseDataHash: validation.responseDataHash,
    tag: validation.tag,
    respondedAt: validation.respondedAt.toString(),
    isApproved: isValidationApproved(validation.status),
    isPending: validation.status === ValidationStatus.Pending,
  };
}

function formatValidationSummary(summary: ValidationSummary): Record<string, unknown> {
  return {
    totalRequests: summary.totalRequests.toString(),
    approvedCount: summary.approvedCount.toString(),
    rejectedCount: summary.rejectedCount.toString(),
    pendingCount: summary.pendingCount.toString(),
    averageResponse: summary.averageResponse,
    isPositiveAverage: summary.averageResponse > 50,
  };
}
