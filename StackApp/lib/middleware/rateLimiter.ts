/**
 * Rate Limiter Middleware
 *
 * Enforces rate limits based on user subscription tier.
 * Uses in-memory storage for single-instance deployments.
 * For production with multiple instances, use Redis.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionService } from "../services/SubscriptionService";
import { getTierLimits, SubscriptionTier, DEFAULT_TIER } from "../config/subscriptions";

// Rate limit headers
const RATE_LIMIT_HEADER = "X-RateLimit-Limit";
const RATE_LIMIT_REMAINING_HEADER = "X-RateLimit-Remaining";
const RATE_LIMIT_RESET_HEADER = "X-RateLimit-Reset";
const RETRY_AFTER_HEADER = "Retry-After";

export interface RateLimitConfig {
  /** Extract user identifier from request */
  getUserId: (req: NextRequest) => string | null | Promise<string | null>;
  /** Custom error message */
  errorMessage?: string;
  /** Skip rate limiting for certain requests */
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
}

export interface RateLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  error?: string;
}

/**
 * In-memory rate limit storage
 * Key: user identifier
 * Value: { count: number, resetAt: timestamp }
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Check rate limit for a user
 */
export async function checkRateLimit(
  userId: string,
  tier: SubscriptionTier = DEFAULT_TIER
): Promise<RateLimitResponse> {
  const limits = getTierLimits(tier);
  const rateLimit = limits.rateLimit;
  const windowMs = 60 * 1000; // 1 minute window

  const now = Date.now();
  const key = `rate:${userId.toLowerCase()}`;

  let record = rateLimitStore.get(key);

  // Reset if window has passed
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, record);
  }

  const success = record.count < rateLimit;
  const remaining = Math.max(0, rateLimit - record.count);

  if (success) {
    record.count++;
  }

  return {
    success,
    limit: rateLimit,
    remaining: success ? remaining - 1 : remaining,
    resetAt: new Date(record.resetAt),
    error: success ? undefined : "Rate limit exceeded",
  };
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResponse): Headers {
  const headers = new Headers();
  headers.set(RATE_LIMIT_HEADER, result.limit.toString());
  headers.set(RATE_LIMIT_REMAINING_HEADER, result.remaining.toString());
  headers.set(RATE_LIMIT_RESET_HEADER, Math.ceil(result.resetAt.getTime() / 1000).toString());

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    headers.set(RETRY_AFTER_HEADER, Math.max(1, retryAfter).toString());
  }

  return headers;
}

/**
 * Rate limiter middleware wrapper for API routes
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Check if we should skip rate limiting
    if (config.skip) {
      const shouldSkip = await config.skip(req);
      if (shouldSkip) {
        return handler(req);
      }
    }

    // Get user identifier
    const userId = await config.getUserId(req);

    if (!userId) {
      // No user identified, use IP-based rate limiting
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                 req.headers.get("x-real-ip") ||
                 "unknown";
      const result = await checkRateLimit(`ip:${ip}`, DEFAULT_TIER);

      if (!result.success) {
        const headers = createRateLimitHeaders(result);
        return NextResponse.json(
          {
            error: config.errorMessage || "Too many requests. Please try again later.",
            retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
          },
          { status: 429, headers }
        );
      }

      const response = await handler(req);
      const headers = createRateLimitHeaders(result);
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Get user's subscription tier
    const subscriptionService = getSubscriptionService();
    const tier = await subscriptionService.getUserTier(userId);

    // Check rate limit
    const result = await checkRateLimit(userId, tier);

    if (!result.success) {
      const headers = createRateLimitHeaders(result);
      return NextResponse.json(
        {
          error: config.errorMessage || "Rate limit exceeded. Please upgrade your plan or try again later.",
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
          tier,
          limit: result.limit,
        },
        { status: 429, headers }
      );
    }

    // Execute handler
    const response = await handler(req);

    // Add rate limit headers to response
    const headers = createRateLimitHeaders(result);
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Simple rate limit check for use within route handlers
 */
export async function enforceRateLimit(
  userWalletAddress: string | null,
  req: NextRequest
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const subscriptionService = getSubscriptionService();

  let tier: SubscriptionTier = DEFAULT_TIER;
  let userId: string;

  if (userWalletAddress) {
    tier = await subscriptionService.getUserTier(userWalletAddress);
    userId = userWalletAddress;
  } else {
    // Fall back to IP-based limiting
    userId = `ip:${
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown"
    }`;
  }

  const result = await checkRateLimit(userId, tier);

  if (!result.success) {
    const headers = createRateLimitHeaders(result);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
          limit: result.limit,
          remaining: result.remaining,
        },
        { status: 429, headers }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Check transaction limit for a user
 */
export async function enforceTransactionLimit(
  userWalletAddress: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const subscriptionService = getSubscriptionService();
  const result = await subscriptionService.checkTransactionLimit(userWalletAddress);

  if (!result.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Monthly transaction limit exceeded. Please upgrade your plan.",
          used: result.used,
          limit: result.limit,
          periodEnd: result.periodEnd.toISOString(),
          percentUsed: result.percentUsed,
        },
        { status: 402 } // Payment Required
      ),
    };
  }

  return { allowed: true };
}

/**
 * Check wallet creation limit for a user
 */
export async function enforceWalletLimit(
  userWalletAddress: string
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const subscriptionService = getSubscriptionService();
  const result = await subscriptionService.checkWalletLimit(userWalletAddress);

  if (!result.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Maximum wallet limit reached. Please upgrade your plan to create more wallets.",
          used: result.used,
          limit: result.limit,
        },
        { status: 402 } // Payment Required
      ),
    };
  }

  return { allowed: true };
}

/**
 * Check feature access for a user
 */
export async function enforceFeatureAccess(
  userWalletAddress: string,
  feature: string,
  minimumTier: SubscriptionTier
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const subscriptionService = getSubscriptionService();
  const hasAccess = await subscriptionService.checkMinimumTier(userWalletAddress, minimumTier);

  if (!hasAccess) {
    const userTier = await subscriptionService.getUserTier(userWalletAddress);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `This feature requires ${minimumTier} tier or higher. Your current tier is ${userTier}.`,
          requiredTier: minimumTier,
          currentTier: userTier,
          feature,
        },
        { status: 402 } // Payment Required
      ),
    };
  }

  return { allowed: true };
}
