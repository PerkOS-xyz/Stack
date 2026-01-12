/**
 * UsageAggregationService
 *
 * Handles monthly statistics aggregation for vendor analytics.
 * - Aggregates endpoint usage data into monthly summaries
 * - Calculates performance metrics (avg latency, error rates)
 * - Generates endpoint breakdowns
 * - Updates pre-aggregated monthly stats table
 */

import { firebaseAdmin } from "@/lib/db/firebase";
import type {
  MonthlyVendorStats,
  MonthlyStatsSummary,
  EndpointBreakdown,
  WindowType,
} from "@/lib/types/vendor-analytics";

export class UsageAggregationService {
  /**
   * Aggregate usage data for a specific month
   * Call this via cron job (recommended: daily at 2am UTC)
   */
  async aggregateMonthlyStats(
    yearMonth: string, // "2026-01"
    forceRefresh = false
  ): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    // Get all active domains
    const { data: domains, error: domainError } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("is_active", true)
      .eq("verification_status", "verified");

    if (domainError) {
      console.error("[Aggregation] Error fetching domains:", domainError);
      return { success: false, processed: 0, errors: [domainError.message] };
    }

    if (!domains || domains.length === 0) {
      return { success: true, processed: 0, errors: [] };
    }

    // Calculate date range for the month
    const [year, month] = yearMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Process each domain
    for (const domain of domains) {
      try {
        const stats = await this.aggregateDomainStats(
          domain.domain_url,
          domain.user_wallet_address,
          domain.vendor_id,
          yearMonth,
          startDate,
          endDate,
          forceRefresh
        );

        if (stats) {
          processed++;
        }
      } catch (err) {
        const errorMsg = `Failed to aggregate ${domain.domain_url}: ${err instanceof Error ? err.message : "Unknown error"}`;
        console.error("[Aggregation]", errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length === 0,
      processed,
      errors,
    };
  }

  /**
   * Get monthly stats summary for a user
   */
  async getUserMonthlySummary(
    userWalletAddress: string,
    yearMonth?: string
  ): Promise<MonthlyStatsSummary | null> {
    const address = userWalletAddress.toLowerCase();
    const targetMonth = yearMonth || this.getCurrentYearMonth();
    const previousMonth = this.getPreviousYearMonth(targetMonth);

    // Get current month stats
    const { data: currentStats } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("*")
      .eq("user_wallet_address", address)
      .eq("year_month", targetMonth);

    // Get previous month stats for comparison
    const { data: previousStats } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("*")
      .eq("user_wallet_address", address)
      .eq("year_month", previousMonth);

    // Aggregate current month
    const current = this.aggregateStats(currentStats || []);
    const previous = this.aggregateStats(previousStats || []);

    // Calculate percentage changes
    const calcChange = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100 * 100) / 100;
    };

    return {
      year_month: targetMonth,
      total_transactions: current.totalTransactions,
      total_volume_usd: current.totalVolumeUsd,
      total_requests: current.totalRequests,
      unique_callers: current.uniqueCallers,
      error_rate: current.errorRate,
      avg_latency_ms: current.avgLatencyMs,
      transactions_change_percent: calcChange(
        current.totalTransactions,
        previous.totalTransactions
      ),
      volume_change_percent: calcChange(
        current.totalVolumeUsd,
        previous.totalVolumeUsd
      ),
      requests_change_percent: calcChange(
        current.totalRequests,
        previous.totalRequests
      ),
    };
  }

  /**
   * Get monthly stats for a specific domain
   */
  async getDomainMonthlyStats(
    domainUrl: string,
    yearMonth?: string
  ): Promise<MonthlyVendorStats | null> {
    const normalizedDomain = this.normalizeDomain(domainUrl);
    const targetMonth = yearMonth || this.getCurrentYearMonth();

    const { data, error } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("*")
      .eq("domain_url", normalizedDomain)
      .eq("year_month", targetMonth)
      .single();

    if (error || !data) {
      return null;
    }

    return data as MonthlyVendorStats;
  }

  /**
   * Get monthly stats history for a domain
   */
  async getDomainStatsHistory(
    domainUrl: string,
    months = 12
  ): Promise<MonthlyVendorStats[]> {
    const normalizedDomain = this.normalizeDomain(domainUrl);

    const { data, error } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("*")
      .eq("domain_url", normalizedDomain)
      .order("year_month", { ascending: false })
      .limit(months);

    if (error) {
      console.error("[Aggregation] Error fetching stats history:", error);
      return [];
    }

    return data as MonthlyVendorStats[];
  }

  /**
   * Get all monthly stats for a user
   */
  async getUserMonthlyStats(
    userWalletAddress: string,
    yearMonth?: string
  ): Promise<MonthlyVendorStats[]> {
    const address = userWalletAddress.toLowerCase();
    const targetMonth = yearMonth || this.getCurrentYearMonth();

    const { data, error } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("*")
      .eq("user_wallet_address", address)
      .eq("year_month", targetMonth)
      .order("total_requests", { ascending: false });

    if (error) {
      console.error("[Aggregation] Error fetching user stats:", error);
      return [];
    }

    return data as MonthlyVendorStats[];
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async aggregateDomainStats(
    domainUrl: string,
    userWalletAddress: string,
    vendorId: string | null,
    yearMonth: string,
    startDate: Date,
    endDate: Date,
    forceRefresh: boolean
  ): Promise<MonthlyVendorStats | null> {
    // Check if stats already exist
    const { data: existing } = await firebaseAdmin
      .from("perkos_monthly_vendor_stats")
      .select("id")
      .eq("domain_url", domainUrl)
      .eq("year_month", yearMonth)
      .single();

    if (existing && !forceRefresh) {
      // Stats already exist, skip unless forced
      return null;
    }

    // Fetch day-level usage data for the month
    const { data: usageData, error: usageError } = await firebaseAdmin
      .from("perkos_endpoint_usage")
      .select("*")
      .eq("domain_url", domainUrl)
      .eq("window_type", "day" as WindowType)
      .gte("window_start", startDate.toISOString())
      .lte("window_start", endDate.toISOString());

    if (usageError) {
      throw new Error(`Failed to fetch usage data: ${usageError.message}`);
    }

    if (!usageData || usageData.length === 0) {
      // No usage data for this domain this month
      return null;
    }

    // Aggregate metrics
    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalLatencyMs = 0;
    let totalAmountUsd = 0;
    const uniqueCallers = new Set<string>();
    const endpointBreakdown: EndpointBreakdown = {};

    for (const record of usageData) {
      totalRequests += record.request_count || 0;
      successCount += record.success_count || 0;
      errorCount += record.error_count || 0;
      totalLatencyMs += record.total_latency_ms || 0;
      totalAmountUsd += parseFloat(record.total_amount_usd || "0");

      if (record.caller_address) {
        uniqueCallers.add(record.caller_address);
      }

      // Build endpoint breakdown
      const path = record.endpoint_path || "/";
      if (!endpointBreakdown[path]) {
        endpointBreakdown[path] = {
          requests: 0,
          volume_usd: "0",
          errors: 0,
          avg_latency_ms: 0,
        };
      }

      endpointBreakdown[path].requests += record.request_count || 0;
      endpointBreakdown[path].volume_usd = (
        parseFloat(endpointBreakdown[path].volume_usd) +
        parseFloat(record.total_amount_usd || "0")
      ).toFixed(6);
      endpointBreakdown[path].errors += record.error_count || 0;

      // Calculate running average latency per endpoint
      const currentEndpointRequests = endpointBreakdown[path].requests;
      const previousAvg = endpointBreakdown[path].avg_latency_ms;
      const newLatency = record.total_latency_ms / (record.request_count || 1);
      endpointBreakdown[path].avg_latency_ms = Math.round(
        ((previousAvg * (currentEndpointRequests - (record.request_count || 0)) +
          newLatency * (record.request_count || 0)) /
          currentEndpointRequests) *
          100
      ) / 100;
    }

    // Calculate final metrics
    const errorRate =
      totalRequests > 0
        ? Math.round((errorCount / totalRequests) * 10000) / 10000
        : 0;
    const avgLatencyMs =
      totalRequests > 0
        ? Math.round((totalLatencyMs / totalRequests) * 100) / 100
        : null;

    // Calculate platform fees (example: 0.5% of volume)
    const platformFeesUsd = Math.round(totalAmountUsd * 0.005 * 1000000) / 1000000;

    const stats: Partial<MonthlyVendorStats> = {
      year_month: yearMonth,
      user_wallet_address: userWalletAddress,
      vendor_id: vendorId,
      domain_url: domainUrl,
      total_transactions: successCount,
      successful_transactions: successCount,
      failed_transactions: errorCount,
      total_volume_usd: totalAmountUsd,
      total_requests: totalRequests,
      unique_callers: uniqueCallers.size,
      endpoint_breakdown: endpointBreakdown,
      avg_latency_ms: avgLatencyMs,
      error_rate: errorRate,
      platform_fees_usd: platformFeesUsd,
    };

    // Upsert stats
    if (existing) {
      const { data, error } = await firebaseAdmin
        .from("perkos_monthly_vendor_stats")
        .update(stats)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update stats: ${error.message}`);
      }

      return data as MonthlyVendorStats;
    } else {
      const { data, error } = await firebaseAdmin
        .from("perkos_monthly_vendor_stats")
        .insert(stats)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert stats: ${error.message}`);
      }

      return data as MonthlyVendorStats;
    }
  }

  private aggregateStats(stats: MonthlyVendorStats[]): {
    totalTransactions: number;
    totalVolumeUsd: number;
    totalRequests: number;
    uniqueCallers: number;
    errorRate: number;
    avgLatencyMs: number;
  } {
    if (stats.length === 0) {
      return {
        totalTransactions: 0,
        totalVolumeUsd: 0,
        totalRequests: 0,
        uniqueCallers: 0,
        errorRate: 0,
        avgLatencyMs: 0,
      };
    }

    let totalTransactions = 0;
    let totalVolumeUsd = 0;
    let totalRequests = 0;
    let uniqueCallersSum = 0;
    let totalErrors = 0;
    let weightedLatencySum = 0;

    for (const stat of stats) {
      totalTransactions += stat.total_transactions || 0;
      totalVolumeUsd += parseFloat(String(stat.total_volume_usd) || "0");
      totalRequests += stat.total_requests || 0;
      uniqueCallersSum += stat.unique_callers || 0;
      totalErrors += stat.failed_transactions || 0;
      weightedLatencySum +=
        (stat.avg_latency_ms || 0) * (stat.total_requests || 0);
    }

    return {
      totalTransactions,
      totalVolumeUsd: Math.round(totalVolumeUsd * 100) / 100,
      totalRequests,
      uniqueCallers: uniqueCallersSum, // Note: may have duplicates across domains
      errorRate:
        totalRequests > 0
          ? Math.round((totalErrors / totalRequests) * 10000) / 10000
          : 0,
      avgLatencyMs:
        totalRequests > 0
          ? Math.round((weightedLatencySum / totalRequests) * 100) / 100
          : 0,
    };
  }

  private normalizeDomain(domain: string): string {
    let normalized = domain.replace(/^https?:\/\//, "");
    normalized = normalized.replace(/\/$/, "");
    normalized = normalized.replace(/^www\./, "");
    return normalized.toLowerCase();
  }

  private getCurrentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  private getPreviousYearMonth(yearMonth: string): string {
    const [year, month] = yearMonth.split("-").map(Number);
    if (month === 1) {
      return `${year - 1}-12`;
    }
    return `${year}-${String(month - 1).padStart(2, "0")}`;
  }
}

// Singleton instance
let usageAggregationService: UsageAggregationService | null = null;

export function getUsageAggregationService(): UsageAggregationService {
  if (!usageAggregationService) {
    usageAggregationService = new UsageAggregationService();
  }
  return usageAggregationService;
}
