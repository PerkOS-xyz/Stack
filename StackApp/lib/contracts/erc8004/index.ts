/**
 * ERC-8004 Contract ABIs - Re-exported from @perkos/contracts-erc8004
 *
 * This file re-exports all ERC-8004 registry ABIs and utilities from the @perkos/contracts-erc8004 package
 * for backward compatibility with existing imports.
 */

export {
  // Registry ABIs
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,

  // Types
  type Feedback,
  type ReputationSummary,
  type ValidatorInfo,
  type Attestation,
  type ValidationSummary,

  // Utility Functions
  encodeMetadataValue,
  decodeMetadataValue,
  isAttestationValid,
  getAttestationStatus,
} from "@perkos/contracts-erc8004";
