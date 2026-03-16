import { NextRequest, NextResponse } from "next/server";
import { logger } from "../utils/logger";

/**
 * In-memory rate limiting for Stellar x402 payments.
 *
 * - Max 10 x402 payments per minute per user
 * - Configurable spending limit per user (default $100/24h)
 */

const MAX_PAYMENTS_PER_MINUTE = parseInt(
  process.env.STELLAR_MAX_PAYMENTS_PER_MINUTE || "10",
  10,
);

const MAX_SPENDING_24H_CENTS = parseInt(
  process.env.STELLAR_MAX_SPENDING_24H_CENTS || "10000", // $100 in cents
  10,
);

interface UserRateState {
  /** Timestamps of recent payment attempts (ms) */
  timestamps: number[];
  /** Total spent in current 24h window (in cents) */
  spentCents: number;
  /** Window start (ms) */
  windowStart: number;
}

const userStates = new Map<string, UserRateState>();

function getOrCreateState(userId: string): UserRateState {
  let state = userStates.get(userId);
  if (!state) {
    state = { timestamps: [], spentCents: 0, windowStart: Date.now() };
    userStates.set(userId, state);
  }
  return state;
}

function pruneState(state: UserRateState, now: number): void {
  // Remove timestamps older than 1 minute
  const oneMinuteAgo = now - 60_000;
  state.timestamps = state.timestamps.filter((t) => t > oneMinuteAgo);

  // Reset 24h spending window if expired
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (now - state.windowStart > twentyFourHours) {
    state.spentCents = 0;
    state.windowStart = now;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

/**
 * Check if a user can make a Stellar x402 payment.
 *
 * @param userId - User identifier
 * @param amountCents - Payment amount in cents (e.g., 100 = $1.00)
 * @returns Whether the payment is allowed
 */
export function checkStellarRateLimit(
  userId: string,
  amountCents: number,
): RateLimitResult {
  const now = Date.now();
  const state = getOrCreateState(userId);
  pruneState(state, now);

  // Check per-minute rate
  if (state.timestamps.length >= MAX_PAYMENTS_PER_MINUTE) {
    const oldestInWindow = state.timestamps[0];
    const retryAfterMs = oldestInWindow + 60_000 - now;

    logger.warn("Stellar rate limit exceeded (per-minute)", {
      userId,
      count: state.timestamps.length,
      limit: MAX_PAYMENTS_PER_MINUTE,
    });

    return {
      allowed: false,
      reason: `Rate limit exceeded: max ${MAX_PAYMENTS_PER_MINUTE} payments per minute`,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  // Check 24h spending limit
  if (state.spentCents + amountCents > MAX_SPENDING_24H_CENTS) {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const retryAfterMs = state.windowStart + twentyFourHours - now;

    logger.warn("Stellar spending limit exceeded (24h)", {
      userId,
      currentSpentCents: state.spentCents,
      requestedCents: amountCents,
      limitCents: MAX_SPENDING_24H_CENTS,
    });

    return {
      allowed: false,
      reason: `Spending limit exceeded: max $${(MAX_SPENDING_24H_CENTS / 100).toFixed(2)} per 24 hours`,
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  return { allowed: true };
}

/**
 * Record a successful payment for rate limiting purposes.
 */
export function recordStellarPayment(
  userId: string,
  amountCents: number,
): void {
  const now = Date.now();
  const state = getOrCreateState(userId);
  pruneState(state, now);

  state.timestamps.push(now);
  state.spentCents += amountCents;
}

/**
 * Next.js middleware-style helper for Stellar x402 rate limiting.
 * Extract userId and amount from request, check limits.
 */
export function stellarRateLimitMiddleware(
  userId: string,
  amountCents: number,
): NextResponse | null {
  const result = checkStellarRateLimit(userId, amountCents);

  if (!result.allowed) {
    return NextResponse.json(
      { error: result.reason },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.retryAfterMs || 60_000) / 1000)),
        },
      },
    );
  }

  return null; // Allowed — proceed
}
