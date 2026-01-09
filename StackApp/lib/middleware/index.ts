/**
 * Middleware Exports
 *
 * Wallet-based rate limiting and subscription helpers for API routes.
 * No API keys required - authentication is via wallet connection.
 */

export {
  // Wallet-based rate limiting
  checkWalletRateLimit,
  recordWalletTransaction,
  extractPayerFromPayload,
  withWalletRateLimit,

  // Response helpers
  getRateLimitHeaders,
  createRateLimitExceededResponse,
  createUnauthorizedResponse,

  // Types
  type RateLimitCheckResult,
  type RateLimitHeaders,
} from "./rate-limiter";
