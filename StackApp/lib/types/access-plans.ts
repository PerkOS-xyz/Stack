/**
 * Access Plan Types for Stack
 *
 * Types for user registration, subscriptions, and usage tracking.
 */

import type { Address } from "./x402";
import type { PlanId } from "@/lib/config/access-plans";

// ============ User Subscription Types ============

/**
 * User subscription status
 */
export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "cancelled"
  | "expired"
  | "pending";

/**
 * Payment method for subscription
 */
export type PaymentMethod = "x402" | "stripe" | "crypto" | "invoice";

/**
 * User subscription record
 */
export interface UserSubscription {
  /** Unique subscription ID */
  id: string;

  /** User's wallet address */
  walletAddress: Address;

  /** Current plan ID */
  planId: PlanId;

  /** Subscription status */
  status: SubscriptionStatus;

  /** Monthly API calls limit */
  monthlyApiLimit: number;

  /** API calls used this period */
  apiCallsUsed: number;

  /** Current billing period start */
  periodStart: Date;

  /** Current billing period end */
  periodEnd: Date;

  /** Payment method */
  paymentMethod: PaymentMethod | null;

  /** Last payment transaction hash (for x402/crypto) */
  lastPaymentTxHash: string | null;

  /** Last payment amount in atomic units */
  lastPaymentAmount: string | null;

  /** Last payment date */
  lastPaymentAt: Date | null;

  /** Next billing date */
  nextBillingAt: Date | null;

  /** Cancellation date (if cancelled) */
  cancelledAt: Date | null;

  /** Trial end date (if on trial) */
  trialEndsAt: Date | null;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

// ============ API Key Types (DEPRECATED) ============
// API keys are no longer used. Authentication is wallet-based via x402 payment payloads.

/**
 * @deprecated API keys are no longer used. Users authenticate via wallet connection.
 */
export interface ApiKey {
  id: string;
  walletAddress: Address;
  keyHash: string;
  keyPrefix: string;
  name: string;
  lastFour: string;
  allowedNetworks: string[];
  rateLimitOverride: number | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  totalRequests: number;
  expiresAt: Date | null;
  createdAt: Date;
}

// ============ Usage Tracking Types ============

/**
 * Daily usage record
 */
export interface DailyUsage {
  /** Record ID */
  id: string;

  /** User's wallet address */
  walletAddress: Address;

  /** Date (YYYY-MM-DD) */
  date: string;

  /** API calls made */
  apiCalls: number;

  /** Calls by endpoint */
  callsByEndpoint: Record<string, number>;

  /** Calls by network */
  callsByNetwork: Record<string, number>;

  /** Total data transferred (bytes) */
  dataTransferred: number;

  /** Number of errors */
  errorCount: number;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Usage summary for a period
 */
export interface UsageSummary {
  /** Total API calls */
  totalCalls: number;

  /** Calls remaining in period */
  callsRemaining: number;

  /** Usage percentage (0-100) */
  usagePercentage: number;

  /** Period start */
  periodStart: Date;

  /** Period end */
  periodEnd: Date;

  /** Days remaining in period */
  daysRemaining: number;

  /** Average daily usage */
  avgDailyUsage: number;

  /** Projected month-end usage */
  projectedUsage: number;

  /** Will exceed limit */
  willExceedLimit: boolean;
}

// ============ Rate Limiting Types ============

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Is request allowed */
  allowed: boolean;

  /** Remaining requests in window */
  remaining: number;

  /** Total limit for window */
  limit: number;

  /** Window reset timestamp */
  resetAt: Date;

  /** Retry after seconds (if blocked) */
  retryAfter: number | null;

  /** Reason for blocking */
  reason?: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per window */
  limit: number;

  /** Window duration in seconds */
  windowSeconds: number;

  /** Burst limit (max concurrent) */
  burstLimit?: number;
}

// ============ Registration Types ============

/**
 * Wallet registration request
 *
 * Users register by connecting their wallet - no signature required.
 * The wallet connection itself proves ownership.
 */
export interface RegisterWalletRequest {
  /** Wallet address (verified via frontend wallet connection) */
  walletAddress: Address;

  /** Initial plan (defaults to free) */
  planId?: PlanId;

  /** Referral code */
  referralCode?: string;
}

/**
 * Wallet registration response
 */
export interface RegisterWalletResponse {
  /** Success flag */
  success: boolean;

  /** User subscription */
  subscription?: UserSubscription;

  /** Error message */
  error?: string;
}

/**
 * @deprecated Use RegisterWalletRequest instead
 */
export interface RegisterUserRequest {
  /** Wallet address */
  walletAddress: Address;

  /** @deprecated No longer required - kept for backwards compatibility */
  signature?: string;

  /** @deprecated No longer required - kept for backwards compatibility */
  message?: string;

  /** Initial plan (defaults to free) */
  planId?: PlanId;

  /** Referral code */
  referralCode?: string;
}

/**
 * @deprecated Use RegisterWalletResponse instead
 */
export interface RegisterUserResponse {
  /** Success flag */
  success: boolean;

  /** User subscription */
  subscription?: UserSubscription;

  /** @deprecated API keys are no longer used */
  apiKey?: string;

  /** Error message */
  error?: string;
}

// ============ Plan Management Types ============

/**
 * Upgrade plan request
 */
export interface UpgradePlanRequest {
  /** New plan ID */
  planId: PlanId;

  /** Payment payload (for paid plans) */
  paymentPayload?: {
    scheme: "exact" | "deferred";
    network: string;
    signature: string;
    amount: string;
  };
}

/**
 * Upgrade plan response
 */
export interface UpgradePlanResponse {
  /** Success flag */
  success: boolean;

  /** Updated subscription */
  subscription?: UserSubscription;

  /** Payment transaction hash */
  transactionHash?: string;

  /** Error message */
  error?: string;
}

/**
 * Cancel subscription request
 */
export interface CancelSubscriptionRequest {
  /** Reason for cancellation */
  reason?: string;

  /** Cancel immediately or at period end */
  immediate: boolean;
}

// ============ API Response Types ============

/**
 * Current user status response
 */
export interface UserStatusResponse {
  /** Is user registered */
  isRegistered: boolean;

  /** User's wallet address */
  walletAddress: Address;

  /** Current subscription */
  subscription: UserSubscription | null;

  /** Usage summary */
  usage: UsageSummary | null;

  /** Rate limit status */
  rateLimit: RateLimitResult;
}

/**
 * @deprecated API keys are no longer used. Users authenticate via wallet connection.
 */
export interface CreateApiKeyResponse {
  success: boolean;
  apiKey?: string;
  keyInfo?: Omit<ApiKey, "keyHash">;
  error?: string;
}

// ============ Webhook Types ============

/**
 * Subscription event types
 */
export type SubscriptionEventType =
  | "subscription.created"
  | "subscription.upgraded"
  | "subscription.downgraded"
  | "subscription.cancelled"
  | "subscription.renewed"
  | "subscription.expired"
  | "usage.limit_warning"
  | "usage.limit_exceeded"
  | "payment.succeeded"
  | "payment.failed";

/**
 * Subscription webhook event
 */
export interface SubscriptionEvent {
  /** Event ID */
  id: string;

  /** Event type */
  type: SubscriptionEventType;

  /** User wallet address */
  walletAddress: Address;

  /** Event data */
  data: {
    subscriptionId: string;
    planId: PlanId;
    previousPlanId?: PlanId;
    usagePercentage?: number;
    paymentAmount?: string;
    paymentTxHash?: string;
  };

  /** Event timestamp */
  timestamp: Date;
}
