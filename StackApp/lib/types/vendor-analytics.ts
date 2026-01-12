/**
 * Vendor Analytics Types
 *
 * Types for user-vendor association, rate limiting, and usage analytics
 */

// ============================================
// Domain Ownership Types
// ============================================

export type VerificationStatus = "pending" | "verified" | "failed" | "expired";
export type VerificationMethod = "dns_txt" | "meta_tag" | "file_upload";

/**
 * User's claimed vendor domain
 */
export interface UserVendorDomain {
  id: string;
  user_wallet_address: string;
  sponsor_wallet_id: string | null;
  domain_url: string;
  vendor_id: string | null;

  // Verification
  verification_status: VerificationStatus;
  verification_method: VerificationMethod | null;
  verification_token: string;
  verification_attempts: number;
  last_verification_at: string | null;
  verified_at: string | null;
  verification_expires_at: string | null;

  // Custom rate limits (null = use subscription default)
  custom_requests_per_minute: number | null;
  custom_requests_per_hour: number | null;
  custom_requests_per_day: number | null;

  // Status
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Domain claim request
 */
export interface ClaimDomainRequest {
  domain_url: string;
  sponsor_wallet_id: string;
  verification_method: VerificationMethod;
}

/**
 * Domain claim response with verification instructions
 */
export interface ClaimDomainResponse {
  success: boolean;
  domain: UserVendorDomain;
  verification_instructions: VerificationInstructions;
}

/**
 * Instructions for domain verification
 */
export interface VerificationInstructions {
  method: VerificationMethod;
  token: string;
  expires_at: string;

  // Method-specific instructions
  dns_txt?: {
    record_name: string; // "_perkos-verify"
    record_value: string; // The token
    example: string;
  };
  meta_tag?: {
    tag_name: string; // "perkos-verification"
    tag_content: string; // The token
    example: string;
  };
  file_upload?: {
    file_path: string; // "/.well-known/perkos-verify.txt"
    file_content: string; // The token
    example: string;
  };
}

// ============================================
// Rate Limiting Types
// ============================================

export type WindowType = "minute" | "hour" | "day";
export type LimitType = "minute" | "hour" | "day";

/**
 * Rate limit configuration per subscription tier
 */
export interface RateLimitConfig {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_allowance: number; // Extra requests allowed in burst
}

/**
 * Rate limit tiers based on subscription
 */
export const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  free: {
    requests_per_minute: 30,
    requests_per_hour: 500,
    requests_per_day: 5000,
    burst_allowance: 10,
  },
  pro: {
    requests_per_minute: 120,
    requests_per_hour: 3000,
    requests_per_day: 50000,
    burst_allowance: 50,
  },
  enterprise: {
    requests_per_minute: 600,
    requests_per_hour: 15000,
    requests_per_day: 250000,
    burst_allowance: 200,
  },
  // Default fallback (no subscription)
  default: {
    requests_per_minute: 30,
    requests_per_hour: 500,
    requests_per_day: 5000,
    burst_allowance: 10,
  },
};

/**
 * Current rate limit status for a domain
 */
export interface RateLimitStatus {
  domain_url: string;
  subscription_tier: string;

  // Limits
  limits: {
    minute: number;
    hour: number;
    day: number;
  };

  // Current usage
  usage: {
    minute: number;
    hour: number;
    day: number;
  };

  // Percentage used
  percent_used: {
    minute: number;
    hour: number;
    day: number;
  };

  // Warning/overage flags
  is_warning: boolean; // Usage > 80%
  is_overage: boolean; // Usage > 100%
  overage_percent: number; // How much over (0 if not over)

  // Time until reset
  resets_in: {
    minute: number; // seconds
    hour: number;
    day: number;
  };
}

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  status: RateLimitStatus;

  // Headers to include in response
  headers: {
    "X-RateLimit-Limit-Minute": string;
    "X-RateLimit-Remaining-Minute": string;
    "X-RateLimit-Reset-Minute": string;
    "X-RateLimit-Limit-Hour": string;
    "X-RateLimit-Remaining-Hour": string;
    "X-RateLimit-Limit-Day": string;
    "X-RateLimit-Remaining-Day": string;
    "X-RateLimit-Warning"?: string; // Present if usage > 80%
    "X-RateLimit-Overage"?: string; // Present if usage > 100%
  };
}

/**
 * Endpoint usage record (for tracking)
 */
export interface EndpointUsage {
  id: string;
  vendor_id: string | null;
  endpoint_id: string | null;
  domain_url: string;
  endpoint_path: string;
  http_method: string;
  caller_address: string | null;
  request_count: number;
  window_start: string;
  window_type: WindowType;
  success_count: number;
  error_count: number;
  total_latency_ms: number;
  total_amount_usd: number;
  created_at: string;
}

/**
 * Rate limit overage record
 */
export interface RateLimitOverage {
  id: string;
  user_wallet_address: string;
  domain_url: string;
  limit_type: LimitType;
  limit_value: number;
  actual_value: number;
  overage_percent: number;
  window_start: string;
  occurred_at: string;
  subscription_tier: string | null;
  created_at: string;
}

// ============================================
// Monthly Analytics Types
// ============================================

/**
 * Monthly vendor statistics
 */
export interface MonthlyVendorStats {
  id: string;
  year_month: string; // "2026-01"
  user_wallet_address: string;
  vendor_id: string;
  domain_url: string;

  // Transaction metrics
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;

  // Volume metrics
  total_volume_usd: number;

  // Request metrics
  total_requests: number;
  unique_callers: number;

  // Endpoint breakdown
  endpoint_breakdown: EndpointBreakdown;

  // Performance metrics
  avg_latency_ms: number | null;
  error_rate: number | null; // 0.0000 to 1.0000

  // Platform fees
  platform_fees_usd: number;

  created_at: string;
  updated_at: string;
}

/**
 * Endpoint breakdown in monthly stats
 */
export interface EndpointBreakdown {
  [endpoint_path: string]: {
    requests: number;
    volume_usd: string;
    errors: number;
    avg_latency_ms: number;
  };
}

/**
 * Monthly stats summary for dashboard
 */
export interface MonthlyStatsSummary {
  year_month: string;
  total_transactions: number;
  total_volume_usd: number;
  total_requests: number;
  unique_callers: number;
  error_rate: number;
  avg_latency_ms: number;

  // Comparison with previous month
  transactions_change_percent: number;
  volume_change_percent: number;
  requests_change_percent: number;
}

/**
 * User's vendor analytics dashboard data
 */
export interface VendorAnalyticsDashboard {
  user_wallet_address: string;

  // All claimed domains
  domains: UserVendorDomain[];

  // Current month summary (all domains combined)
  current_month: MonthlyStatsSummary;

  // Per-domain stats for current month
  domain_stats: MonthlyVendorStats[];

  // Rate limit status for each domain
  rate_limits: RateLimitStatus[];

  // Recent overages (last 30 days)
  recent_overages: RateLimitOverage[];
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Request to verify domain ownership
 */
export interface VerifyDomainRequest {
  domain_id: string;
}

/**
 * Response from domain verification
 */
export interface VerifyDomainResponse {
  success: boolean;
  verified: boolean;
  message: string;
  domain?: UserVendorDomain;
}

/**
 * Request to get usage stats
 */
export interface GetUsageStatsRequest {
  domain_url?: string; // Optional: filter by domain
  year_month?: string; // Optional: specific month (default: current)
}

/**
 * Log usage request (called by x402 endpoints)
 */
export interface LogUsageRequest {
  domain_url: string;
  endpoint_path: string;
  http_method: string;
  caller_address: string | null;
  success: boolean;
  latency_ms: number;
  amount_usd?: number;
}

/**
 * Aggregate stats request (for cron job)
 */
export interface AggregateStatsRequest {
  year_month: string;
  force_refresh?: boolean;
}
