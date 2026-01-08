/**
 * x402 Types - Re-exported from @perkos/types-x402
 *
 * This file re-exports all types from the @perkos/types-x402 package
 * for backward compatibility with existing imports.
 *
 * Supports both V1 and V2 specification formats.
 */

export {
  // Base Types
  type Address,
  type Hex,

  // V2 Types
  type Resource,
  type Extensions,

  // Standard x402 Types
  type X402VerifyRequest,
  type X402SettleRequest,
  type PaymentPayload,
  type PaymentRequirements,
  type DeferredExtra,

  // Exact Scheme (EIP-3009)
  type ExactPayload,
  type TransferAuthorization,

  // Deferred Scheme (EIP-712)
  type DeferredPayload,
  type Voucher,

  // Response Types
  type VerifyResponse,
  type SettleResponse,
  type SupportedResponse,

  // Deferred Scheme Extended
  type DeferredInfoResponse,
  type StoredVoucher,

  // ERC-8004 Agent Discovery
  type AgentInfo,
  type PaymentMethod,
  type ReputationScore,

  // Bazaar Discovery
  type BazaarService,
  type ServicePricing,

  // Well-Known Types
  type AgentCard,
  type X402PaymentConfig,

  // Type Guards
  isExactPayload,
  isDeferredPayload,
  isAddress,
  isHex,
  isCAIP2,
  isResourceObject,

  // V1/V2 Compatibility Helpers
  getPaymentAmount,
  getResourceUrl,
  getResourceDescription,
  getResourceMimeType,
} from "@perkos/types-x402";
