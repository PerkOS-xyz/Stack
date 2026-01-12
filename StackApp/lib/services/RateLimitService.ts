/**
 * RateLimitService
 *
 * Handles rate limiting for vendor endpoints with soft blocking mode.
 * - Soft block: Allows requests over limit but includes warning headers
 * - Tracks usage per minute/hour/day windows
 * - Integrates with subscription tiers for limit configuration
 */

import { firebaseAdmin } from "@/lib/db/firebase";
import type {
  RateLimitConfig,
  RateLimitStatus,
  RateLimitCheckResult,
  WindowType,
  LogUsageRequest,
  EndpointUsage,
} from "@/lib/types/vendor-analytics";
import { RATE_LIMIT_TIERS } from "@/lib/types/vendor-analytics";
import { getVendorOwnershipService } from "./VendorOwnershipService";
import { getSubscriptionService } from "./SubscriptionService";

// In-memory cache for rate limit status (reduces DB calls)
const rateLimitCache = new Map<
  string,
  { status: RateLimitStatus; cachedAt: number }
>();
const CACHE_TTL_MS = 5000; // 5 seconds

// Warning threshold (percentage of limit)
const WARNING_THRESHOLD = 0.8; // 80%

export class RateLimitService {
  /**
   * Check rate limits for a domain and get headers
   * Soft block mode: Always allows but returns overage info in headers
   */
  async checkRateLimit(
    domainUrl: string,
    callerAddress?: string
  ): Promise<RateLimitCheckResult> {
    const status = await this.getRateLimitStatus(domainUrl);

    // Calculate remaining and generate headers
    const headers = this.generateRateLimitHeaders(status);

    // In soft block mode, we always allow but indicate overage
    return {
      allowed: true, // Soft block - always allow
      status,
      headers,
    };
  }

  /**
   * Get current rate limit status for a domain
   */
  async getRateLimitStatus(domainUrl: string): Promise<RateLimitStatus> {
    const normalizedDomain = this.normalizeDomain(domainUrl);
    const now = Date.now();

    // Check cache
    const cached = rateLimitCache.get(normalizedDomain);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.status;
    }

    // Get domain owner and their subscription
    const vendorOwnershipService = getVendorOwnershipService();
    const domainOwner =
      await vendorOwnershipService.getDomainOwner(normalizedDomain);

    // Get rate limits based on subscription tier
    let config: RateLimitConfig;
    let subscriptionTier = "default";

    if (domainOwner) {
      // Check for custom limits first
      if (
        domainOwner.custom_requests_per_minute ||
        domainOwner.custom_requests_per_hour ||
        domainOwner.custom_requests_per_day
      ) {
        config = {
          requests_per_minute:
            domainOwner.custom_requests_per_minute ||
            RATE_LIMIT_TIERS.default.requests_per_minute,
          requests_per_hour:
            domainOwner.custom_requests_per_hour ||
            RATE_LIMIT_TIERS.default.requests_per_hour,
          requests_per_day:
            domainOwner.custom_requests_per_day ||
            RATE_LIMIT_TIERS.default.requests_per_day,
          burst_allowance: RATE_LIMIT_TIERS.default.burst_allowance,
        };
      } else {
        // Get from subscription tier
        const subscriptionService = getSubscriptionService();
        const subscription = await subscriptionService.getUserSubscription(
          domainOwner.user_wallet_address
        );
        subscriptionTier = subscription?.tier || "free";
        config =
          RATE_LIMIT_TIERS[subscriptionTier] || RATE_LIMIT_TIERS.default;
      }
    } else {
      // No owner - use default limits
      config = RATE_LIMIT_TIERS.default;
    }

    // Get current usage from database
    const usage = await this.getCurrentUsage(normalizedDomain);

    // Calculate percentages
    const minutePercent = (usage.minute / config.requests_per_minute) * 100;
    const hourPercent = (usage.hour / config.requests_per_hour) * 100;
    const dayPercent = (usage.day / config.requests_per_day) * 100;

    // Determine if warning or overage
    const maxPercent = Math.max(minutePercent, hourPercent, dayPercent);
    const isWarning = maxPercent >= WARNING_THRESHOLD * 100 && maxPercent < 100;
    const isOverage = maxPercent >= 100;

    // Calculate time until resets
    const nowDate = new Date();
    const resets = {
      minute: 60 - nowDate.getSeconds(),
      hour: (60 - nowDate.getMinutes()) * 60 - nowDate.getSeconds(),
      day:
        (24 - nowDate.getHours()) * 3600 -
        nowDate.getMinutes() * 60 -
        nowDate.getSeconds(),
    };

    const status: RateLimitStatus = {
      domain_url: normalizedDomain,
      subscription_tier: subscriptionTier,
      limits: {
        minute: config.requests_per_minute,
        hour: config.requests_per_hour,
        day: config.requests_per_day,
      },
      usage: {
        minute: usage.minute,
        hour: usage.hour,
        day: usage.day,
      },
      percent_used: {
        minute: Math.round(minutePercent * 100) / 100,
        hour: Math.round(hourPercent * 100) / 100,
        day: Math.round(dayPercent * 100) / 100,
      },
      is_warning: isWarning,
      is_overage: isOverage,
      overage_percent: isOverage ? Math.round(maxPercent - 100) : 0,
      resets_in: resets,
    };

    // Cache the status
    rateLimitCache.set(normalizedDomain, { status, cachedAt: now });

    return status;
  }

  /**
   * Log usage for a request (call after processing)
   */
  async logUsage(request: LogUsageRequest): Promise<void> {
    const normalizedDomain = this.normalizeDomain(request.domain_url);
    const now = new Date();

    // Calculate window starts
    const minuteStart = new Date(now);
    minuteStart.setSeconds(0, 0);

    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    // Get domain owner for overage tracking
    const vendorOwnershipService = getVendorOwnershipService();
    const domainOwner =
      await vendorOwnershipService.getDomainOwner(normalizedDomain);

    // Upsert usage records for each window type
    const windowUpdates = [
      { type: "minute" as WindowType, start: minuteStart },
      { type: "hour" as WindowType, start: hourStart },
      { type: "day" as WindowType, start: dayStart },
    ];

    for (const window of windowUpdates) {
      await this.upsertUsage(
        normalizedDomain,
        request.endpoint_path,
        request.http_method,
        request.caller_address,
        window.type,
        window.start,
        request.success,
        request.latency_ms,
        request.amount_usd
      );
    }

    // Check for overage and log if needed (soft block mode)
    if (domainOwner) {
      const status = await this.getRateLimitStatus(normalizedDomain);
      if (status.is_overage) {
        await this.logOverage(
          domainOwner.user_wallet_address,
          normalizedDomain,
          status
        );
      }
    }

    // Invalidate cache
    rateLimitCache.delete(normalizedDomain);
  }

  /**
   * Get usage statistics for a time range
   */
  async getUsageStats(
    domainUrl: string,
    windowType: WindowType,
    startTime: Date,
    endTime: Date
  ): Promise<EndpointUsage[]> {
    const normalizedDomain = this.normalizeDomain(domainUrl);

    const { data, error } = await firebaseAdmin
      .from("perkos_endpoint_usage")
      .select("*")
      .eq("domain_url", normalizedDomain)
      .eq("window_type", windowType)
      .gte("window_start", startTime.toISOString())
      .lte("window_start", endTime.toISOString())
      .order("window_start", { ascending: false });

    if (error) {
      console.error("[RateLimit] Error fetching usage stats:", error);
      return [];
    }

    return data as EndpointUsage[];
  }

  /**
   * Clear cache for a domain (call after limit changes)
   */
  clearCache(domainUrl: string): void {
    const normalizedDomain = this.normalizeDomain(domainUrl);
    rateLimitCache.delete(normalizedDomain);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private normalizeDomain(domain: string): string {
    let normalized = domain.replace(/^https?:\/\//, "");
    normalized = normalized.replace(/\/$/, "");
    normalized = normalized.replace(/^www\./, "");
    return normalized.toLowerCase();
  }

  private async getCurrentUsage(
    domainUrl: string
  ): Promise<{ minute: number; hour: number; day: number }> {
    const now = new Date();

    // Calculate window starts
    const minuteStart = new Date(now);
    minuteStart.setSeconds(0, 0);

    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    // Query all three windows in parallel
    const [minuteData, hourData, dayData] = await Promise.all([
      firebaseAdmin
        .from("perkos_endpoint_usage")
        .select("request_count")
        .eq("domain_url", domainUrl)
        .eq("window_type", "minute")
        .gte("window_start", minuteStart.toISOString()),
      firebaseAdmin
        .from("perkos_endpoint_usage")
        .select("request_count")
        .eq("domain_url", domainUrl)
        .eq("window_type", "hour")
        .gte("window_start", hourStart.toISOString()),
      firebaseAdmin
        .from("perkos_endpoint_usage")
        .select("request_count")
        .eq("domain_url", domainUrl)
        .eq("window_type", "day")
        .gte("window_start", dayStart.toISOString()),
    ]);

    // Sum up request counts
    const sumCounts = (
      data: { data: { request_count: number }[] | null }
    ): number => {
      if (!data.data) return 0;
      return data.data.reduce((sum, row) => sum + (row.request_count || 0), 0);
    };

    return {
      minute: sumCounts(minuteData),
      hour: sumCounts(hourData),
      day: sumCounts(dayData),
    };
  }

  private async upsertUsage(
    domainUrl: string,
    endpointPath: string,
    httpMethod: string,
    callerAddress: string | null,
    windowType: WindowType,
    windowStart: Date,
    success: boolean,
    latencyMs: number,
    amountUsd?: number
  ): Promise<void> {
    // Check if record exists
    const { data: existing } = await firebaseAdmin
      .from("perkos_endpoint_usage")
      .select("id, request_count, success_count, error_count, total_latency_ms, total_amount_usd")
      .eq("domain_url", domainUrl)
      .eq("endpoint_path", endpointPath)
      .eq("window_type", windowType)
      .eq("window_start", windowStart.toISOString())
      .eq("caller_address", callerAddress || "")
      .single();

    if (existing) {
      // Update existing record
      await firebaseAdmin
        .from("perkos_endpoint_usage")
        .update({
          request_count: existing.request_count + 1,
          success_count: existing.success_count + (success ? 1 : 0),
          error_count: existing.error_count + (success ? 0 : 1),
          total_latency_ms: existing.total_latency_ms + latencyMs,
          total_amount_usd: (existing.total_amount_usd || 0) + (amountUsd || 0),
        })
        .eq("id", existing.id);
    } else {
      // Insert new record
      await firebaseAdmin.from("perkos_endpoint_usage").insert({
        domain_url: domainUrl,
        endpoint_path: endpointPath,
        http_method: httpMethod,
        caller_address: callerAddress || "",
        window_type: windowType,
        window_start: windowStart.toISOString(),
        request_count: 1,
        success_count: success ? 1 : 0,
        error_count: success ? 0 : 1,
        total_latency_ms: latencyMs,
        total_amount_usd: amountUsd || 0,
      });
    }
  }

  private async logOverage(
    userWalletAddress: string,
    domainUrl: string,
    status: RateLimitStatus
  ): Promise<void> {
    // Find which limit was exceeded
    let limitType: "minute" | "hour" | "day" = "minute";
    let limitValue = status.limits.minute;
    let actualValue = status.usage.minute;

    if (status.percent_used.hour >= 100) {
      limitType = "hour";
      limitValue = status.limits.hour;
      actualValue = status.usage.hour;
    } else if (status.percent_used.day >= 100) {
      limitType = "day";
      limitValue = status.limits.day;
      actualValue = status.usage.day;
    }

    const now = new Date();
    let windowStart: Date;

    switch (limitType) {
      case "minute":
        windowStart = new Date(now);
        windowStart.setSeconds(0, 0);
        break;
      case "hour":
        windowStart = new Date(now);
        windowStart.setMinutes(0, 0, 0);
        break;
      case "day":
        windowStart = new Date(now);
        windowStart.setHours(0, 0, 0, 0);
        break;
    }

    // Check if we already logged an overage for this window
    const { data: existing } = await firebaseAdmin
      .from("perkos_rate_limit_overages")
      .select("id")
      .eq("domain_url", domainUrl)
      .eq("limit_type", limitType)
      .eq("window_start", windowStart.toISOString())
      .single();

    if (!existing) {
      // Log new overage
      await firebaseAdmin.from("perkos_rate_limit_overages").insert({
        user_wallet_address: userWalletAddress,
        domain_url: domainUrl,
        limit_type: limitType,
        limit_value: limitValue,
        actual_value: actualValue,
        overage_percent: Math.round((actualValue / limitValue) * 100),
        window_start: windowStart.toISOString(),
        subscription_tier: status.subscription_tier,
      });
    }
  }

  private generateRateLimitHeaders(
    status: RateLimitStatus
  ): RateLimitCheckResult["headers"] {
    const headers: RateLimitCheckResult["headers"] = {
      "X-RateLimit-Limit-Minute": String(status.limits.minute),
      "X-RateLimit-Remaining-Minute": String(
        Math.max(0, status.limits.minute - status.usage.minute)
      ),
      "X-RateLimit-Reset-Minute": String(status.resets_in.minute),
      "X-RateLimit-Limit-Hour": String(status.limits.hour),
      "X-RateLimit-Remaining-Hour": String(
        Math.max(0, status.limits.hour - status.usage.hour)
      ),
      "X-RateLimit-Limit-Day": String(status.limits.day),
      "X-RateLimit-Remaining-Day": String(
        Math.max(0, status.limits.day - status.usage.day)
      ),
    };

    if (status.is_warning) {
      headers["X-RateLimit-Warning"] = `Usage at ${Math.round(Math.max(status.percent_used.minute, status.percent_used.hour, status.percent_used.day))}% of limit`;
    }

    if (status.is_overage) {
      headers["X-RateLimit-Overage"] = `Exceeded by ${status.overage_percent}%`;
    }

    return headers;
  }
}

// Singleton instance
let rateLimitService: RateLimitService | null = null;

export function getRateLimitService(): RateLimitService {
  if (!rateLimitService) {
    rateLimitService = new RateLimitService();
  }
  return rateLimitService;
}
