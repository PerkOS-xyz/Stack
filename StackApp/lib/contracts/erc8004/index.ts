/**
 * ERC-8004 Contract ABIs - Re-exported from @perkos/contracts-erc8004
 *
 * This file re-exports all ERC-8004 registry ABIs and utilities from the @perkos/contracts-erc8004 package
 * for backward compatibility with existing imports.
 *
 * Updated for EIP-8004 compliance (v2.0.0):
 * - Reputation: score 0-100, tag1/tag2 filtering
 * - Validation: request-response model (replaces stake-based attestations)
 */

export {
  // Registry ABIs
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,

  // Utility Functions
  encodeMetadataValue,
  decodeMetadataValue,
} from "@perkos/contracts-erc8004";

// ============ Local Type Definitions ============

/**
 * Metadata entry for Identity Registry
 */
export interface MetadataEntry {
  key: string;
  value: `0x${string}`;
}

/**
 * Feedback entry from Reputation Registry (EIP-8004: score 0-100)
 */
export interface Feedback {
  client: `0x${string}`;
  score: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  timestamp: bigint;
  revoked: boolean;
  response: string;
}

/**
 * Reputation summary from Reputation Registry
 */
export interface ReputationSummary {
  totalFeedback: bigint;
  averageScore: number;
  positiveCount: bigint;
  negativeCount: bigint;
}

/**
 * Validation status enum (EIP-8004 request-response model)
 */
export enum ValidationStatus {
  None = 0,
  Pending = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
}

/**
 * Validation request from Validation Registry
 */
export interface ValidationRequest {
  agentId: bigint;
  requester: `0x${string}`;
  validatorAddress: `0x${string}`;
  requestURI: string;
  requestDataHash: `0x${string}`;
  requestedAt: bigint;
  status: ValidationStatus;
  response: number;
  responseURI: string;
  responseDataHash: `0x${string}`;
  tag: string;
  respondedAt: bigint;
}

/**
 * Validation summary from Validation Registry
 */
export interface ValidationSummary {
  totalRequests: bigint;
  approvedCount: bigint;
  rejectedCount: bigint;
  pendingCount: bigint;
  averageResponse: number;
}

// ============ Utility Functions ============

/**
 * Check if a validation is approved (response > 50)
 * EIP-8004 compliant approval threshold
 */
export function isValidationApproved(status: ValidationStatus): boolean {
  return status === ValidationStatus.Approved;
}

/**
 * Get human-readable validation status string
 */
export function getValidationStatusString(status: ValidationStatus): string {
  const statusMap: Record<ValidationStatus, string> = {
    [ValidationStatus.None]: "None",
    [ValidationStatus.Pending]: "Pending",
    [ValidationStatus.Approved]: "Approved",
    [ValidationStatus.Rejected]: "Rejected",
    [ValidationStatus.Cancelled]: "Cancelled",
  };
  return statusMap[status] || "Unknown";
}

/**
 * Check if a score is considered approved (> 50)
 * EIP-8004 compliant: scores 0-100, threshold at 50
 */
export function isScoreApproved(score: number): boolean {
  return score > 50;
}
