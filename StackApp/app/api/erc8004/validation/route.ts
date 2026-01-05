import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { config, type SupportedNetwork, getErc8004Registries, hasErc8004Registries, getRpcUrl } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { VALIDATION_REGISTRY_ABI } from "@/lib/contracts/erc8004";

export const dynamic = "force-dynamic";

/**
 * GET /api/erc8004/validation
 * Get validation data from Validation Registry
 *
 * Query params:
 * - network: Network name (required)
 * - agentId: Agent ID to lookup (optional)
 * - validator: Validator address to lookup (optional)
 * - attestationType: Filter by attestation type (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const network = searchParams.get("network") as SupportedNetwork;
    const agentId = searchParams.get("agentId");
    const validator = searchParams.get("validator");
    const attestationType = searchParams.get("attestationType");

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

    // If validator address provided, get validator info
    if (validator) {
      const validatorInfo = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidator",
        args: [validator as Address],
      });

      const isActive = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "isActiveValidator",
        args: [validator as Address],
      });

      return NextResponse.json({
        validator,
        info: formatValidator(validatorInfo),
        isActive,
        network,
        registryAddress: registries.validation,
      });
    }

    // If agentId provided, get attestations
    if (agentId) {
      let attestations;

      if (attestationType) {
        // Filter by type
        attestations = await client.readContract({
          address: registries.validation as Address,
          abi: VALIDATION_REGISTRY_ABI,
          functionName: "getAttestationsByType",
          args: [BigInt(agentId), attestationType],
        });
      } else {
        // Get all active attestations
        attestations = await client.readContract({
          address: registries.validation as Address,
          abi: VALIDATION_REGISTRY_ABI,
          functionName: "getActiveAttestations",
          args: [BigInt(agentId)],
        });
      }

      const summary = await client.readContract({
        address: registries.validation as Address,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: "getValidationSummary",
        args: [BigInt(agentId)],
      });

      return NextResponse.json({
        agentId,
        summary: formatValidationSummary(summary),
        attestations: (attestations as unknown[]).map(formatAttestation),
        network,
        registryAddress: registries.validation,
      });
    }

    // Return registry info
    const minimumStake = await client.readContract({
      address: registries.validation as Address,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: "minimumStake",
    });

    return NextResponse.json({
      network,
      registryAddress: registries.validation,
      minimumStake: (minimumStake as bigint).toString(),
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
 * Create attestation or register as validator (returns unsigned transaction)
 *
 * Body for attestation:
 * - network: Network name (required)
 * - action: "attest" (required)
 * - agentId: Agent ID (required)
 * - attestationType: Type of attestation (required)
 * - dataHash: Hash of attestation data (required)
 * - dataURI: URI to attestation details (required)
 * - validityPeriod: Validity in seconds (required)
 * - confidenceScore: 0-100 (required)
 *
 * Body for validator registration:
 * - network: Network name (required)
 * - action: "registerValidator" (required)
 * - name: Validator name (required)
 * - metadataURI: URI to validator info (required)
 * - stakeAmount: Amount to stake (required)
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

    if (action === "attest") {
      const { agentId, attestationType, dataHash, dataURI, validityPeriod, confidenceScore } = body;

      if (!agentId || !attestationType || !dataHash || !dataURI || !validityPeriod || confidenceScore === undefined) {
        return NextResponse.json(
          { error: "Missing required attestation parameters" },
          { status: 400 }
        );
      }

      if (confidenceScore < 0 || confidenceScore > 100) {
        return NextResponse.json(
          { error: "Confidence score must be between 0 and 100" },
          { status: 400 }
        );
      }

      const attestData = {
        to: registries.validation,
        network,
        function: "attest(uint256,string,bytes32,string,uint256,uint8)",
        args: [agentId, attestationType, dataHash, dataURI, validityPeriod, confidenceScore],
        description: `Create ${attestationType} attestation for agent ${agentId}`,
      };

      return NextResponse.json({
        success: true,
        transaction: attestData,
        message: "Sign and submit this transaction to create an attestation",
      });
    }

    if (action === "registerValidator") {
      const { name, metadataURI, stakeAmount } = body;

      if (!name || !metadataURI || !stakeAmount) {
        return NextResponse.json(
          { error: "Missing required validator registration parameters" },
          { status: 400 }
        );
      }

      const registerData = {
        to: registries.validation,
        network,
        function: "registerValidator(string,string)",
        args: [name, metadataURI],
        value: stakeAmount,
        description: `Register as validator "${name}" with stake ${stakeAmount}`,
      };

      return NextResponse.json({
        success: true,
        transaction: registerData,
        message: "Sign and submit this transaction to register as a validator",
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
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
function formatValidator(validator: unknown): Record<string, unknown> {
  const v = validator as {
    name: string;
    metadataURI: string;
    stake: bigint;
    registeredAt: bigint;
    active: boolean;
    attestationCount: bigint;
  };

  return {
    name: v.name,
    metadataURI: v.metadataURI,
    stake: v.stake.toString(),
    registeredAt: v.registeredAt.toString(),
    active: v.active,
    attestationCount: v.attestationCount.toString(),
  };
}

function formatAttestation(attestation: unknown): Record<string, unknown> {
  const a = attestation as {
    validator: string;
    attestationType: string;
    dataHash: string;
    dataURI: string;
    createdAt: bigint;
    expiresAt: bigint;
    revoked: boolean;
    confidenceScore: number;
  };

  return {
    validator: a.validator,
    attestationType: a.attestationType,
    dataHash: a.dataHash,
    dataURI: a.dataURI,
    createdAt: a.createdAt.toString(),
    expiresAt: a.expiresAt.toString(),
    revoked: a.revoked,
    confidenceScore: a.confidenceScore,
    isExpired: BigInt(Date.now() / 1000) > a.expiresAt,
  };
}

function formatValidationSummary(summary: unknown): Record<string, unknown> {
  const s = summary as {
    totalAttestations: bigint;
    activeAttestations: bigint;
    expiredAttestations: bigint;
    revokedAttestations: bigint;
    validatorCount: bigint;
    averageConfidence: number;
    lastUpdated: bigint;
  };

  return {
    totalAttestations: s.totalAttestations.toString(),
    activeAttestations: s.activeAttestations.toString(),
    expiredAttestations: s.expiredAttestations.toString(),
    revokedAttestations: s.revokedAttestations.toString(),
    validatorCount: s.validatorCount.toString(),
    averageConfidence: s.averageConfidence,
    lastUpdated: s.lastUpdated.toString(),
  };
}
