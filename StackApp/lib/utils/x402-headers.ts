/**
 * x402 V2 HTTP Headers Utility - re-exports from @perkos/util-x402-headers
 */
export {
  // Request ID
  generateRequestId,

  // Chain utilities
  getChainId,
  networkToCAIP2,
  caip2ToNetwork,
  getBlockExplorerTxUrl,

  // HTTP Headers
  getBaseHeaders,
  getVerifyHeaders,
  getSettleHeaders,

  // V2 Receipt
  createV2Receipt,

  // WWW-Authenticate header
  buildWWWAuthenticateHeader,
  parseWWWAuthenticateHeader,

  // Types
  type VerifyHeadersParams,
  type SettleHeadersParams,
  type V2Receipt,
  type CreateReceiptParams,
  type PaymentRequirementsHeader,
} from "@perkos/util-x402-headers";
