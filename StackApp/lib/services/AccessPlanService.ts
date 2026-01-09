/**
 * Access Plan Service
 *
 * Handles user registration, subscription management, and transaction tracking
 * for Stack x402 services. Users authenticate via wallet connection.
 *
 * Flow:
 * 1. User connects wallet
 * 2. System checks if wallet is registered
 * 3. If not → User selects a plan and registers
 * 4. Each x402 transaction counts against their monthly limit
 */

import { supabaseAdmin } from "@/lib/db/supabase";
import { logger } from "@/lib/utils/logger";
import {
  ACCESS_PLANS,
  DEFAULT_PLAN,
  getPlanRateLimit,
  isNetworkAllowed,
  type PlanId,
} from "@/lib/config/access-plans";
import type { Address } from "@/lib/types/x402";
import type {
  UserSubscription,
  UsageSummary,
  RateLimitResult,
  UpgradePlanRequest,
  UpgradePlanResponse,
  SubscriptionStatus,
} from "@/lib/types/access-plans";

/**
 * Rate limit window in memory (for fast lookups)
 * Key: walletAddress, Value: { count, windowStart }
 */
const rateLimitCache = new Map<
  string,
  { count: number; windowStart: number }
>();

/**
 * Registration response
 */
export interface RegisterWalletResponse {
  success: boolean;
  subscription?: UserSubscription;
  error?: string;
}

/**
 * Transaction check response
 */
export interface TransactionCheckResult {
  allowed: boolean;
  subscription: UserSubscription | null;
  remainingTransactions: number;
  error?: string;
}

/**
 * Access Plan Service
 */
export class AccessPlanService {
  private static instance: AccessPlanService;

  private constructor() {}

  static getInstance(): AccessPlanService {
    if (!AccessPlanService.instance) {
      AccessPlanService.instance = new AccessPlanService();
    }
    return AccessPlanService.instance;
  }

  // ============ Wallet Registration ============

  /**
   * Check if a wallet is registered
   */
  async isRegistered(walletAddress: Address): Promise<boolean> {
    const subscription = await this.getSubscription(walletAddress);
    return subscription !== null;
  }

  /**
   * Register a wallet with a plan
   * No signature needed - wallet is already connected via frontend
   */
  async registerWallet(
    walletAddress: Address,
    planId: PlanId = DEFAULT_PLAN
  ): Promise<RegisterWalletResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.getSubscription(walletAddress);
      if (existingUser) {
        return { success: false, error: "Wallet already registered" };
      }

      // Validate plan
      const plan = ACCESS_PLANS[planId];
      if (!plan || !plan.isActive) {
        return { success: false, error: "Invalid plan selected" };
      }

      // For paid plans, they should go through upgrade flow after free registration
      // Or implement payment verification here
      if (planId !== "free" && plan.priceUsd !== "0") {
        return {
          success: false,
          error: "Please register with free plan first, then upgrade",
        };
      }

      // Create subscription
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: subscription, error: subError } = await supabaseAdmin
        .from("perkos_user_subscriptions")
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          plan_id: planId,
          status: "active" as SubscriptionStatus,
          monthly_api_limit: plan.monthlyApiCalls,
          api_calls_used: 0,
          period_start: now.toISOString(),
          period_end: periodEnd.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single();

      if (subError) {
        logger.error("Failed to create subscription", { error: subError });
        return { success: false, error: "Failed to register wallet" };
      }

      logger.info("Wallet registered", { walletAddress, planId });

      return {
        success: true,
        subscription: this.mapSubscription(subscription),
      };
    } catch (error) {
      logger.error("Wallet registration failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "Registration failed" };
    }
  }

  // ============ Subscription Management ============

  /**
   * Get user's subscription by wallet address
   */
  async getSubscription(walletAddress: Address): Promise<UserSubscription | null> {
    const { data, error } = await supabaseAdmin
      .from("perkos_user_subscriptions")
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    if (error || !data) return null;
    return this.mapSubscription(data);
  }

  /**
   * Upgrade user's plan
   */
  async upgradePlan(
    walletAddress: Address,
    request: UpgradePlanRequest
  ): Promise<UpgradePlanResponse> {
    try {
      const { planId, paymentPayload } = request;

      // Get current subscription
      const subscription = await this.getSubscription(walletAddress);
      if (!subscription) {
        return { success: false, error: "Wallet not registered" };
      }

      const newPlan = ACCESS_PLANS[planId];
      if (!newPlan) {
        return { success: false, error: "Invalid plan" };
      }

      // For paid plans, verify payment
      let transactionHash: string | undefined;
      if (newPlan.priceUsd !== "0" && newPlan.priceUsd !== "custom") {
        if (!paymentPayload) {
          return { success: false, error: "Payment required for this plan" };
        }

        // TODO: Verify payment via X402Service
        transactionHash = paymentPayload.signature;
      }

      // Update subscription
      const { data, error } = await supabaseAdmin
        .from("perkos_user_subscriptions")
        .update({
          plan_id: planId,
          monthly_api_limit: newPlan.monthlyApiCalls,
          last_payment_tx_hash: transactionHash || null,
          last_payment_amount: newPlan.priceAtomicUnits,
          last_payment_at: new Date().toISOString(),
          payment_method: paymentPayload ? "x402" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", walletAddress.toLowerCase())
        .select()
        .single();

      if (error) {
        return { success: false, error: "Failed to upgrade plan" };
      }

      logger.info("Plan upgraded", {
        walletAddress,
        oldPlan: subscription.planId,
        newPlan: planId,
      });

      return {
        success: true,
        subscription: this.mapSubscription(data),
        transactionHash,
      };
    } catch (error) {
      logger.error("Plan upgrade failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, error: "Upgrade failed" };
    }
  }

  // ============ Transaction Tracking ============

  /**
   * Check if wallet can perform a transaction
   * Returns whether allowed and remaining transactions
   */
  async checkTransaction(walletAddress: Address): Promise<TransactionCheckResult> {
    const subscription = await this.getSubscription(walletAddress);

    if (!subscription) {
      return {
        allowed: false,
        subscription: null,
        remainingTransactions: 0,
        error: "Wallet not registered. Please register first.",
      };
    }

    // Check subscription status
    if (subscription.status !== "active" && subscription.status !== "trial") {
      return {
        allowed: false,
        subscription,
        remainingTransactions: 0,
        error: `Subscription is ${subscription.status}. Please renew.`,
      };
    }

    // Check period expiry
    if (new Date() > subscription.periodEnd) {
      return {
        allowed: false,
        subscription,
        remainingTransactions: 0,
        error: "Billing period expired. Please renew.",
      };
    }

    // Check transaction limit (skip for unlimited: -1)
    if (subscription.monthlyApiLimit >= 0) {
      if (subscription.apiCallsUsed >= subscription.monthlyApiLimit) {
        return {
          allowed: false,
          subscription,
          remainingTransactions: 0,
          error: "Monthly transaction limit reached. Please upgrade your plan.",
        };
      }
    }

    const remaining =
      subscription.monthlyApiLimit === -1
        ? -1 // Unlimited
        : subscription.monthlyApiLimit - subscription.apiCallsUsed;

    return {
      allowed: true,
      subscription,
      remainingTransactions: remaining,
    };
  }

  /**
   * Record a transaction (verify or settle)
   * Call this after successful x402 operation
   */
  async recordTransaction(
    walletAddress: Address,
    endpoint: string,
    network: string
  ): Promise<{ success: boolean; remaining: number }> {
    try {
      // Increment transaction counter using the prefixed function
      const { data, error } = await supabaseAdmin.rpc("perkos_increment_api_calls", {
        p_wallet_address: walletAddress.toLowerCase(),
        p_endpoint: endpoint,
        p_network: network,
      });

      if (error) {
        logger.error("Failed to record transaction", { error });
        return { success: false, remaining: 0 };
      }

      const result = data?.[0];
      if (!result?.success) {
        return { success: false, remaining: 0 };
      }

      return {
        success: true,
        remaining: result.remaining,
      };
    } catch (error) {
      logger.warn("Failed to record transaction", {
        walletAddress,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { success: false, remaining: 0 };
    }
  }

  // ============ Rate Limiting ============

  /**
   * Check rate limit for a wallet (requests per minute)
   */
  async checkRateLimit(walletAddress: Address): Promise<RateLimitResult> {
    const subscription = await this.getSubscription(walletAddress);
    if (!subscription) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date(),
        retryAfter: null,
        reason: "Wallet not registered",
      };
    }

    const limit = getPlanRateLimit(subscription.planId as PlanId);
    const windowSeconds = 60; // 1 minute window
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);

    const cacheKey = walletAddress.toLowerCase();
    const cached = rateLimitCache.get(cacheKey);

    if (cached && cached.windowStart === windowStart) {
      if (cached.count >= limit) {
        const resetAt = new Date(windowStart + windowSeconds * 1000);
        return {
          allowed: false,
          remaining: 0,
          limit,
          resetAt,
          retryAfter: Math.ceil((resetAt.getTime() - now) / 1000),
          reason: "Rate limit exceeded",
        };
      }

      cached.count++;
      return {
        allowed: true,
        remaining: limit - cached.count,
        limit,
        resetAt: new Date(windowStart + windowSeconds * 1000),
        retryAfter: null,
      };
    }

    // New window
    rateLimitCache.set(cacheKey, { count: 1, windowStart });

    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetAt: new Date(windowStart + windowSeconds * 1000),
      retryAfter: null,
    };
  }

  // ============ Network Access ============

  /**
   * Check if network is allowed for user's plan
   */
  async checkNetworkAccess(
    walletAddress: Address,
    network: string
  ): Promise<boolean> {
    const subscription = await this.getSubscription(walletAddress);
    if (!subscription) return false;

    return isNetworkAllowed(subscription.planId as PlanId, network);
  }

  // ============ Usage Summary ============

  /**
   * Get usage summary for a wallet
   */
  async getUsageSummary(walletAddress: Address): Promise<UsageSummary | null> {
    const subscription = await this.getSubscription(walletAddress);
    if (!subscription) return null;

    const now = new Date();
    const periodStart = new Date(subscription.periodStart);
    const periodEnd = new Date(subscription.periodEnd);

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.max(
      1,
      Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const callsRemaining =
      subscription.monthlyApiLimit === -1
        ? -1
        : Math.max(0, subscription.monthlyApiLimit - subscription.apiCallsUsed);

    const usagePercentage =
      subscription.monthlyApiLimit === -1
        ? 0
        : (subscription.apiCallsUsed / subscription.monthlyApiLimit) * 100;

    const avgDailyUsage = subscription.apiCallsUsed / daysElapsed;
    const projectedUsage = avgDailyUsage * totalDays;

    return {
      totalCalls: subscription.apiCallsUsed,
      callsRemaining,
      usagePercentage,
      periodStart,
      periodEnd,
      daysRemaining,
      avgDailyUsage,
      projectedUsage,
      willExceedLimit:
        subscription.monthlyApiLimit !== -1 &&
        projectedUsage > subscription.monthlyApiLimit,
    };
  }

  /**
   * Get wallet status - everything needed for the UI
   */
  async getWalletStatus(walletAddress: Address): Promise<{
    isRegistered: boolean;
    subscription: UserSubscription | null;
    usage: UsageSummary | null;
    canTransact: boolean;
    error?: string;
  }> {
    const subscription = await this.getSubscription(walletAddress);

    if (!subscription) {
      return {
        isRegistered: false,
        subscription: null,
        usage: null,
        canTransact: false,
        error: "Wallet not registered",
      };
    }

    const usage = await this.getUsageSummary(walletAddress);
    const check = await this.checkTransaction(walletAddress);

    return {
      isRegistered: true,
      subscription,
      usage,
      canTransact: check.allowed,
      error: check.error,
    };
  }

  // ============ Helper Methods ============

  private mapSubscription(data: Record<string, unknown>): UserSubscription {
    return {
      id: data.id as string,
      walletAddress: data.wallet_address as Address,
      planId: data.plan_id as PlanId,
      status: data.status as SubscriptionStatus,
      monthlyApiLimit: data.monthly_api_limit as number,
      apiCallsUsed: data.api_calls_used as number,
      periodStart: new Date(data.period_start as string),
      periodEnd: new Date(data.period_end as string),
      paymentMethod: data.payment_method as UserSubscription["paymentMethod"],
      lastPaymentTxHash: data.last_payment_tx_hash as string | null,
      lastPaymentAmount: data.last_payment_amount as string | null,
      lastPaymentAt: data.last_payment_at
        ? new Date(data.last_payment_at as string)
        : null,
      nextBillingAt: data.next_billing_at
        ? new Date(data.next_billing_at as string)
        : null,
      cancelledAt: data.cancelled_at
        ? new Date(data.cancelled_at as string)
        : null,
      trialEndsAt: data.trial_ends_at
        ? new Date(data.trial_ends_at as string)
        : null,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

/**
 * Get AccessPlanService singleton instance
 */
export function getAccessPlanService(): AccessPlanService {
  return AccessPlanService.getInstance();
}
