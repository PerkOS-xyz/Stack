/**
 * ERC-8004 Contract ABIs & Types — v2 Spec Compliant
 *
 * Updated for EIP-8004 v2:
 * - Reputation: int128 value + uint8 valueDecimals (signed, decimal-aware)
 * - Validation: simplified, no ValidationStatus enum, progressive responses
 * - Identity: MetadataEntry uses metadataKey/metadataValue, wallet functions
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

// ============ Identity Types ============

/**
 * Metadata entry for Identity Registry (v2: renamed fields)
 */
export interface MetadataEntry {
  metadataKey: string;
  metadataValue: `0x${string}`;
}

/**
 * @deprecated Use MetadataEntry with metadataKey/metadataValue
 */
export interface MetadataEntryLegacy {
  key: string;
  value: `0x${string}`;
}

// ============ Reputation Types (v2: int128 + valueDecimals) ============

/**
 * Feedback entry from Reputation Registry
 * v2: score replaced with int128 value + uint8 valueDecimals
 */
export interface Feedback {
  client: `0x${string}`;
  value: bigint;           // int128 — can be negative
  valueDecimals: number;   // uint8 (0-18)
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: `0x${string}`;
  timestamp: bigint;
  revoked: boolean;
}

/**
 * Reputation summary from Reputation Registry (v2)
 */
export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;         // int128
  summaryValueDecimals: number; // uint8
}

/**
 * Response entry for feedback
 */
export interface FeedbackResponse {
  responder: `0x${string}`;
  responseURI: string;
  responseHash: `0x${string}`;
}

// ============ Validation Types (v2: simplified) ============

/**
 * Validation request from Validation Registry (v2: no enum)
 */
export interface ValidationRequest {
  agentId: bigint;
  requester: `0x${string}`;
  validatorAddress: `0x${string}`;
  requestURI: string;
  requestDataHash: `0x${string}`;
  requestedAt: bigint;
  response: number;          // uint8 (0-100)
  responseHash: `0x${string}`;
  responseURI: string;
  responseDataHash: `0x${string}`;
  tag: string;
  lastUpdate: bigint;
}

/**
 * Validation summary from Validation Registry (v2: simplified)
 */
export interface ValidationSummary {
  count: bigint;
  averageResponse: number; // uint8 (0-100)
}

// ============ Utility Functions ============

/**
 * Format a value with decimals for display
 * e.g. formatValue(9977n, 2) => "99.77"
 */
export function formatValue(value: bigint, valueDecimals: number): string {
  if (valueDecimals === 0) return value.toString();
  const str = value.toString();
  const isNegative = value < 0n;
  const abs = isNegative ? str.slice(1) : str;
  const padded = abs.padStart(valueDecimals + 1, "0");
  const intPart = padded.slice(0, padded.length - valueDecimals);
  const decPart = padded.slice(padded.length - valueDecimals);
  return `${isNegative ? "-" : ""}${intPart}.${decPart}`;
}

/**
 * Check if a validation response is considered positive (> 50)
 */
export function isPositiveResponse(response: number): boolean {
  return response > 50;
}
