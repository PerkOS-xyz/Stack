/**
 * SubscriptionService - Manages user subscriptions and usage limits
 *
 * Features:
 * - Check user subscription tier
 * - Track monthly transaction usage
 * - Enforce rate limits
 * - Validate resource access based on tier
 */

import { firebaseAdmin } from "../db/firebase";
import {
  SubscriptionTier,
  TierLimits,
  getTierLimits,
  getTierConfig,
  DEFAULT_TIER,
  tierAtLeast,
} from "../config/subscriptions";

// Types for subscription data
export interface UserSubscription {
  id: string;
  user_wallet_address: string;
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  started_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  user_wallet_address: string;
  period_start: string; // First day of the month
  period_end: string; // Last day of the month
  transaction_count: number;
  request_count: number;
  last_request_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface UsageLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  periodEnd: Date;
  percentUsed: number;
}

// In-memory rate limit tracking (for single-instance deployment)
// For production, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// In-memory subscription cache to avoid redundant DB calls
// TTL of 10 seconds to balance freshness with performance
const SUBSCRIPTION_CACHE_TTL_MS = 10000;
const subscriptionCache = new Map<string, { subscription: UserSubscription | null; cachedAt: number }>();

export class SubscriptionService {
  /**
   * Clear subscription cache for a specific user (call after updates)
   */
  clearCache(userWalletAddress: string): void {
    const address = userWalletAddress.toLowerCase();
    subscriptionCache.delete(address);
  }
  /**
   * Get user's current active subscription (with caching)
   */
  async getUserSubscription(userWalletAddress: string): Promise<UserSubscription | null> {
    try {
      const address = userWalletAddress.toLowerCase();
      const now = Date.now();

      // Check cache first
      const cached = subscriptionCache.get(address);
      if (cached && (now - cached.cachedAt) < SUBSCRIPTION_CACHE_TTL_MS) {
        return cached.subscription;
      }

      // Fetch from database
      const { data, error } = await firebaseAdmin
        .from("perkos_subscriptions")
        .select("*")
        .eq("user_wallet_address", address)
        .eq("status", "active")
        .limit(1)
        .single();

      if (error) {
        // Check if it's a "no rows" error (expected for new users)
        if ((error as Error & { code?: string }).code === 'PGRST116') {
          // Cache the null result
          subscriptionCache.set(address, { subscription: null, cachedAt: now });
          return null;
        }
        console.error(`[Subscription] Error fetching subscription for ${address}:`, error);
        return null;
      }

      if (!data) {
        subscriptionCache.set(address, { subscription: null, cachedAt: now });
        return null;
      }

      const subscription = data as UserSubscription;

      // Cache the result
      subscriptionCache.set(address, { subscription, cachedAt: now });

      // Only log on actual DB fetch (not cached)
      console.log(`[Subscription] Found active subscription for ${address}:`, {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
      });

      return subscription;
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      return null;
    }
  }

  /**
   * Get any subscription for a user (regardless of status)
   * Used for updating existing records instead of creating duplicates
   */
  async getAnySubscription(userWalletAddress: string): Promise<UserSubscription | null> {
    try {
      const address = userWalletAddress.toLowerCase();

      // Query without status filter to find ANY subscription
      const { data, error } = await firebaseAdmin
        .from("perkos_subscriptions")
        .select("*")
        .eq("user_wallet_address", address)
        .limit(1)
        .single();

      if (error) {
        // "No rows" is expected for new users
        if ((error as Error & { code?: string }).code === 'PGRST116') {
          console.log(`[Subscription] No existing subscription found for ${address}`);
          return null;
        }
        console.error(`[Subscription] Error in getAnySubscription for ${address}:`, error);
        return null;
      }

      if (!data) {
        console.log(`[Subscription] getAnySubscription: No data for ${address}`);
        return null;
      }

      console.log(`[Subscription] getAnySubscription found for ${address}:`, {
        id: data.id,
        tier: data.tier,
        status: data.status,
      });

      return data as UserSubscription;
    } catch (error) {
      console.error("Error fetching any user subscription:", error);
      return null;
    }
  }

  /**
   * Get user's subscription tier (defaults to 'free' if no subscription)
   */
  async getUserTier(userWalletAddress: string): Promise<SubscriptionTier> {
    const subscription = await this.getUserSubscription(userWalletAddress);

    if (!subscription) {
      return DEFAULT_TIER;
    }

    // Check if subscription is expired
    if (subscription.expires_at) {
      const expiresAt = new Date(subscription.expires_at);
      if (expiresAt < new Date()) {
        return DEFAULT_TIER;
      }
    }

    // Check if trial has ended
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      const trialEndsAt = new Date(subscription.trial_ends_at);
      if (trialEndsAt < new Date()) {
        return DEFAULT_TIER;
      }
    }

    return subscription.tier;
  }

  /**
   * Get user's tier limits
   */
  async getUserLimits(userWalletAddress: string): Promise<TierLimits> {
    const tier = await this.getUserTier(userWalletAddress);
    return getTierLimits(tier);
  }

  /**
   * Get or create usage record for current billing period
   */
  async getOrCreateUsageRecord(userWalletAddress: string): Promise<UsageRecord> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    try {
      // Try to find existing record
      const { data: existingRecord, error: fetchError } = await firebaseAdmin
        .from("perkos_usage")
        .select("*")
        .eq("user_wallet_address", userWalletAddress.toLowerCase())
        .eq("period_start", periodStartStr)
        .single();

      if (existingRecord && !fetchError) {
        return existingRecord as UsageRecord;
      }

      // Create new record
      const { data: newRecord, error: createError } = await firebaseAdmin
        .from("perkos_usage")
        .insert({
          user_wallet_address: userWalletAddress.toLowerCase(),
          period_start: periodStartStr,
          period_end: periodEndStr,
          transaction_count: 0,
          request_count: 0,
          last_request_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        // Record might have been created by another request, try fetching again
        const { data: retryRecord } = await firebaseAdmin
          .from("perkos_usage")
          .select("*")
          .eq("user_wallet_address", userWalletAddress.toLowerCase())
          .eq("period_start", periodStartStr)
          .single();

        if (retryRecord) {
          return retryRecord as UsageRecord;
        }

        throw createError;
      }

      return newRecord as UsageRecord;
    } catch (error) {
      console.error("Error getting/creating usage record:", error);
      // Return a default record to prevent blocking
      return {
        id: 'temp',
        user_wallet_address: userWalletAddress.toLowerCase(),
        period_start: periodStartStr,
        period_end: periodEndStr,
        transaction_count: 0,
        request_count: 0,
        last_request_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if user can make a transaction (within monthly limit)
   */
  async checkTransactionLimit(userWalletAddress: string): Promise<UsageLimitResult> {
    const [tier, usage] = await Promise.all([
      this.getUserTier(userWalletAddress),
      this.getOrCreateUsageRecord(userWalletAddress),
    ]);

    const limits = getTierLimits(tier);
    const limit = limits.monthlyTxLimit;
    const used = usage.transaction_count;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        used,
        limit: -1,
        remaining: -1,
        periodEnd: new Date(usage.period_end),
        percentUsed: 0,
      };
    }

    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;
    const percentUsed = Math.round((used / limit) * 100);

    return {
      allowed,
      used,
      limit,
      remaining,
      periodEnd: new Date(usage.period_end),
      percentUsed,
    };
  }

  /**
   * Increment transaction count for user
   */
  async incrementTransactionCount(userWalletAddress: string, count: number = 1): Promise<void> {
    try {
      const usage = await this.getOrCreateUsageRecord(userWalletAddress);

      await firebaseAdmin
        .from("perkos_usage")
        .update({
          transaction_count: usage.transaction_count + count,
          updated_at: new Date().toISOString(),
        })
        .eq("id", usage.id);
    } catch (error) {
      console.error("Error incrementing transaction count:", error);
    }
  }

  /**
   * Check rate limit for user (requests per minute)
   */
  async checkRateLimit(userWalletAddress: string): Promise<RateLimitResult> {
    const tier = await this.getUserTier(userWalletAddress);
    const limits = getTierLimits(tier);
    const rateLimit = limits.rateLimit;

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const key = `rate:${userWalletAddress.toLowerCase()}`;

    let record = rateLimitStore.get(key);

    // Reset if window has passed
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    }

    const allowed = record.count < rateLimit;
    const remaining = Math.max(0, rateLimit - record.count);

    if (allowed) {
      record.count++;
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetAt: new Date(record.resetAt),
      limit: rateLimit,
    };
  }

  /**
   * Check if user can create more wallets
   */
  async checkWalletLimit(userWalletAddress: string): Promise<UsageLimitResult> {
    const tier = await this.getUserTier(userWalletAddress);
    const limits = getTierLimits(tier);
    const limit = limits.maxWallets;

    // Count existing wallets
    const { count, error } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*", { count: "exact", head: true })
      .eq("user_wallet_address", userWalletAddress.toLowerCase());

    const used = count || 0;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        used,
        limit: -1,
        remaining: -1,
        periodEnd: new Date(), // Not applicable for wallets
        percentUsed: 0,
      };
    }

    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;
    const percentUsed = Math.round((used / limit) * 100);

    return {
      allowed,
      used,
      limit,
      remaining,
      periodEnd: new Date(),
      percentUsed,
    };
  }

  /**
   * Check if user can create more rules for a wallet
   */
  async checkRulesLimit(userWalletAddress: string, walletId: string): Promise<UsageLimitResult> {
    const tier = await this.getUserTier(userWalletAddress);
    const limits = getTierLimits(tier);
    const limit = limits.maxRulesPerWallet;

    // Count existing rules for this wallet
    const { count, error } = await firebaseAdmin
      .from("perkos_sponsor_rules")
      .select("*", { count: "exact", head: true })
      .eq("wallet_id", walletId);

    const used = count || 0;

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        used,
        limit: -1,
        remaining: -1,
        periodEnd: new Date(),
        percentUsed: 0,
      };
    }

    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;
    const percentUsed = Math.round((used / limit) * 100);

    return {
      allowed,
      used,
      limit,
      remaining,
      periodEnd: new Date(),
      percentUsed,
    };
  }

  /**
   * Check if user has access to a feature
   */
  async checkFeatureAccess(
    userWalletAddress: string,
    feature: keyof TierLimits
  ): Promise<boolean> {
    const tier = await this.getUserTier(userWalletAddress);
    const limits = getTierLimits(tier);
    const value = limits[feature];

    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0 && value !== -1;
    return true;
  }

  /**
   * Check if user's tier meets minimum requirement
   */
  async checkMinimumTier(
    userWalletAddress: string,
    minimumTier: SubscriptionTier
  ): Promise<boolean> {
    const userTier = await this.getUserTier(userWalletAddress);
    return tierAtLeast(userTier, minimumTier);
  }

  /**
   * Get comprehensive subscription status for user
   */
  async getSubscriptionStatus(userWalletAddress: string): Promise<{
    tier: SubscriptionTier;
    tierConfig: ReturnType<typeof getTierConfig>;
    subscription: UserSubscription | null;
    usage: UsageRecord;
    limits: {
      transactions: UsageLimitResult;
      wallets: UsageLimitResult;
    };
  }> {
    const [subscription, tier, usage, transactionLimit, walletLimit] = await Promise.all([
      this.getUserSubscription(userWalletAddress),
      this.getUserTier(userWalletAddress),
      this.getOrCreateUsageRecord(userWalletAddress),
      this.checkTransactionLimit(userWalletAddress),
      this.checkWalletLimit(userWalletAddress),
    ]);

    return {
      tier,
      tierConfig: getTierConfig(tier),
      subscription,
      usage,
      limits: {
        transactions: transactionLimit,
        wallets: walletLimit,
      },
    };
  }

  /**
   * Create or update a subscription for a user
   */
  async createOrUpdateSubscription(
    userWalletAddress: string,
    tier: SubscriptionTier,
    options: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      expiresAt?: Date;
      trialEndsAt?: Date;
    } = {}
  ): Promise<UserSubscription> {
    const now = new Date();
    const address = userWalletAddress.toLowerCase();

    console.log(`[Subscription] Creating/updating subscription for ${address}:`, {
      tier,
      expiresAt: options.expiresAt?.toISOString(),
      trialEndsAt: options.trialEndsAt?.toISOString(),
    });

    // Check for any existing subscription (not just active ones)
    // This ensures we update existing records instead of creating duplicates
    const existing = await this.getAnySubscription(address);

    console.log(`[Subscription] Existing subscription found:`, existing ? {
      id: existing.id,
      tier: existing.tier,
      status: existing.status,
    } : 'none');

    const subscriptionData = {
      user_wallet_address: address,
      tier,
      status: options.trialEndsAt ? 'trial' : 'active' as const,
      started_at: now.toISOString(),
      expires_at: options.expiresAt?.toISOString() || null,
      trial_ends_at: options.trialEndsAt?.toISOString() || null,
      cancelled_at: null,
      stripe_customer_id: options.stripeCustomerId || existing?.stripe_customer_id || null,
      stripe_subscription_id: options.stripeSubscriptionId || existing?.stripe_subscription_id || null,
      updated_at: now.toISOString(),
    };

    if (existing) {
      // Update existing subscription
      console.log(`[Subscription] Updating existing subscription ${existing.id}`);
      const { data, error } = await firebaseAdmin
        .from("perkos_subscriptions")
        .update(subscriptionData)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error(`[Subscription] Error updating subscription:`, error);
        throw error;
      }
      console.log(`[Subscription] Successfully updated subscription:`, {
        id: data?.id,
        tier: data?.tier,
        status: data?.status,
      });
      // Clear cache after update
      this.clearCache(address);
      return data as UserSubscription;
    } else {
      // Create new subscription
      console.log(`[Subscription] Creating new subscription`);
      const { data, error } = await firebaseAdmin
        .from("perkos_subscriptions")
        .insert({
          ...subscriptionData,
          created_at: now.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(`[Subscription] Error creating subscription:`, error);
        throw error;
      }
      console.log(`[Subscription] Successfully created subscription:`, {
        id: data?.id,
        tier: data?.tier,
        status: data?.status,
      });
      // Clear cache after create
      this.clearCache(address);
      return data as UserSubscription;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userWalletAddress: string): Promise<void> {
    const address = userWalletAddress.toLowerCase();

    await firebaseAdmin
      .from("perkos_subscriptions")
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_wallet_address", address)
      .eq("status", "active");

    // Clear cache after cancellation
    this.clearCache(address);
  }
}

// Singleton instance
let subscriptionService: SubscriptionService | null = null;

/**
 * Get the subscription service singleton
 */
export function getSubscriptionService(): SubscriptionService {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService();
  }
  return subscriptionService;
}
