/**
 * Rate Limiting Middleware Helper
 *
 * Provides rate limiting functionality for API routes based on user subscription.
 * Uses wallet-based authentication - no API keys required.
 * Users authenticate via connected wallet, and transactions count against their plan limit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessPlanService } from "@/lib/services/AccessPlanService";
import type { RateLimitResult, UserSubscription } from "@/lib/types/access-plans";
import type { Address } from "@/lib/types/x402";

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  subscription: UserSubscription | null;
  rateLimit: RateLimitResult;
  walletAddress: Address | null;
  error?: string;
}

/**
 * Rate limit response headers
 */
export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "X-RateLimit-Policy"?: string;
}

/**
 * Extract payer wallet address from x402 payment payload
 */
export function extractPayerFromPayload(body: unknown): Address | null {
  if (!body || typeof body !== "object") return null;

  const payload = body as Record<string, unknown>;
  const paymentPayload = payload.paymentPayload as Record<string, unknown> | undefined;

  if (!paymentPayload?.payload) return null;

  const innerPayload = paymentPayload.payload as Record<string, unknown>;

  // Exact scheme: check authorization.from
  const authorization = innerPayload.authorization as Record<string, unknown> | undefined;
  if (authorization?.from) {
    return authorization.from as Address;
  }

  // Deferred scheme: check voucher.buyer
  const voucher = innerPayload.voucher as Record<string, unknown> | undefined;
  if (voucher?.buyer) {
    return voucher.buyer as Address;
  }

  // Fallback: check top-level from
  if (innerPayload.from) {
    return innerPayload.from as Address;
  }

  return null;
}

/**
 * Check rate limit for an x402 request using wallet address from payment payload
 *
 * @param walletAddress - Wallet address of the payer
 * @param endpoint - API endpoint being accessed
 * @param network - Network being accessed
 */
export async function checkWalletRateLimit(
  walletAddress: Address,
  endpoint?: string,
  network?: string
): Promise<RateLimitCheckResult> {
  const service = getAccessPlanService();

  // Check if wallet can perform transaction
  const transactionCheck = await service.checkTransaction(walletAddress);

  if (!transactionCheck.allowed) {
    return {
      allowed: false,
      subscription: transactionCheck.subscription,
      walletAddress,
      rateLimit: {
        allowed: false,
        remaining: transactionCheck.remainingTransactions,
        limit: transactionCheck.subscription?.monthlyApiLimit || 0,
        resetAt: transactionCheck.subscription?.periodEnd || new Date(),
        retryAfter: null,
        reason: transactionCheck.error,
      },
      error: transactionCheck.error,
    };
  }

  // Check per-minute rate limit
  const rateLimit = await service.checkRateLimit(walletAddress);

  if (!rateLimit.allowed) {
    return {
      allowed: false,
      subscription: transactionCheck.subscription,
      walletAddress,
      rateLimit,
      error: rateLimit.reason || "Rate limit exceeded",
    };
  }

  // Check network access (if network is specified)
  if (network && transactionCheck.subscription) {
    const networkAllowed = await service.checkNetworkAccess(walletAddress, network);
    if (!networkAllowed) {
      return {
        allowed: false,
        subscription: transactionCheck.subscription,
        walletAddress,
        rateLimit: {
          ...rateLimit,
          allowed: false,
          reason: `Network ${network} not available on ${transactionCheck.subscription.planId} plan`,
        },
        error: `Network ${network} not available on your plan`,
      };
    }
  }

  return {
    allowed: true,
    subscription: transactionCheck.subscription,
    walletAddress,
    rateLimit,
  };
}

/**
 * Record a successful transaction for a wallet
 * Call this after successful x402 verify or settle
 */
export async function recordWalletTransaction(
  walletAddress: Address,
  endpoint: string,
  network: string
): Promise<{ success: boolean; remaining: number }> {
  const service = getAccessPlanService();
  return service.recordTransaction(walletAddress, endpoint, network);
}

/**
 * Generate rate limit response headers
 */
export function getRateLimitHeaders(rateLimit: RateLimitResult): RateLimitHeaders {
  return {
    "X-RateLimit-Limit": rateLimit.limit.toString(),
    "X-RateLimit-Remaining": Math.max(0, rateLimit.remaining).toString(),
    "X-RateLimit-Reset": Math.floor(rateLimit.resetAt.getTime() / 1000).toString(),
    "X-RateLimit-Policy": `${rateLimit.limit};w=60`,
  };
}

/**
 * Create a rate limit exceeded response
 */
export function createRateLimitExceededResponse(
  result: RateLimitCheckResult
): NextResponse {
  const headers = result.rateLimit
    ? getRateLimitHeaders(result.rateLimit)
    : {};

  return NextResponse.json(
    {
      success: false,
      error: result.error || "Rate limit exceeded",
      retryAfter: result.rateLimit?.retryAfter,
      remainingTransactions: result.rateLimit?.remaining || 0,
    },
    {
      status: 429,
      headers: {
        ...headers,
        "Retry-After": result.rateLimit?.retryAfter?.toString() || "60",
      },
    }
  );
}

/**
 * Create an unauthorized/unregistered response
 */
export function createUnauthorizedResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      registrationRequired: true,
      registrationUrl: "/api/v2/access/register",
    },
    { status: 401 }
  );
}

/**
 * Higher-order function to wrap x402 API route handlers with wallet-based rate limiting
 *
 * @example
 * ```ts
 * export const POST = withWalletRateLimit(async (request, context) => {
 *   // Your handler logic here
 *   // context.subscription has the user's subscription
 *   // context.walletAddress has the payer's wallet
 *   return NextResponse.json({ data: "..." });
 * });
 * ```
 */
export function withWalletRateLimit(
  handler: (
    request: NextRequest,
    context: {
      subscription: UserSubscription;
      walletAddress: Address;
    }
  ) => Promise<NextResponse>,
  options?: {
    endpoint?: string;
    network?: string;
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Clone request to read body
    const clonedRequest = request.clone();
    let body: unknown;

    try {
      body = await clonedRequest.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Extract payer wallet from payment payload
    const walletAddress = extractPayerFromPayload(body);

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not determine payer wallet from payment payload",
        },
        { status: 400 }
      );
    }

    // Extract network from body if not provided
    const bodyRecord = body as Record<string, unknown>;
    const paymentPayload = bodyRecord.paymentPayload as Record<string, unknown> | undefined;
    const network = options?.network || (paymentPayload?.network as string) || undefined;

    // Check rate limit
    const result = await checkWalletRateLimit(
      walletAddress,
      options?.endpoint,
      network
    );

    if (!result.allowed) {
      if (result.error?.includes("not registered")) {
        return createUnauthorizedResponse(result.error);
      }
      return createRateLimitExceededResponse(result);
    }

    // Call the actual handler with subscription context
    const response = await handler(request, {
      subscription: result.subscription!,
      walletAddress,
    });

    // Add rate limit headers to response
    const headers = getRateLimitHeaders(result.rateLimit);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

