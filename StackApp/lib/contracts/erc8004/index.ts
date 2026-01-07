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

  // Identity Types
  type MetadataEntry,

  // Reputation Types (EIP-8004: score 0-100, tag filtering)
  type Feedback,
  type ReputationSummary,

  // Validation Types (EIP-8004: request-response model)
  ValidationStatus,
  type ValidationRequest,
  type ValidationSummary,

  // Utility Functions
  encodeMetadataValue,
  decodeMetadataValue,

  // Validation utilities (EIP-8004 compliant)
  isValidationApproved,
  getValidationStatusString,
  isScoreApproved,
} from "@perkos/contracts-erc8004";
