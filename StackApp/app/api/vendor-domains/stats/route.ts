/**
 * Vendor Domain Statistics API
 *
 * GET - Get monthly usage statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { getUsageAggregationService } from "@/lib/services/UsageAggregationService";

// GET - Get monthly usage statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userWalletAddress = searchParams.get("wallet");
    const domainUrl = searchParams.get("domain");
    const yearMonth = searchParams.get("month"); // Format: "2026-01"
    const history = searchParams.get("history"); // Number of months for history

    if (!userWalletAddress && !domainUrl) {
      return NextResponse.json(
        { error: "Missing wallet or domain parameter" },
        { status: 400 }
      );
    }

    const usageAggregationService = getUsageAggregationService();

    // If domain is specified, get domain-specific stats
    if (domainUrl) {
      if (history) {
        const months = parseInt(history, 10) || 12;
        const statsHistory = await usageAggregationService.getDomainStatsHistory(
          domainUrl,
          months
        );

        return NextResponse.json({
          success: true,
          domain: domainUrl,
          history: statsHistory,
        });
      } else {
        const stats = await usageAggregationService.getDomainMonthlyStats(
          domainUrl,
          yearMonth || undefined
        );

        return NextResponse.json({
          success: true,
          domain: domainUrl,
          month: yearMonth || getCurrentYearMonth(),
          stats,
        });
      }
    }

    // Otherwise, get user-level stats
    if (userWalletAddress) {
      // Get summary (aggregated across all domains)
      const summary = await usageAggregationService.getUserMonthlySummary(
        userWalletAddress,
        yearMonth || undefined
      );

      // Get per-domain stats
      const domainStats = await usageAggregationService.getUserMonthlyStats(
        userWalletAddress,
        yearMonth || undefined
      );

      return NextResponse.json({
        success: true,
        user: userWalletAddress,
        month: yearMonth || getCurrentYearMonth(),
        summary,
        domains: domainStats,
      });
    }

    return NextResponse.json(
      { error: "Invalid request parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[VendorDomains] Stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}

// POST - Trigger aggregation (admin/cron endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yearMonth, forceRefresh, adminKey } = body;

    // Simple admin key check (should be more robust in production)
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json(
        { error: "Invalid yearMonth format. Expected YYYY-MM" },
        { status: 400 }
      );
    }

    const usageAggregationService = getUsageAggregationService();
    const result = await usageAggregationService.aggregateMonthlyStats(
      yearMonth,
      forceRefresh || false
    );

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[VendorDomains] Aggregation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aggregation failed" },
      { status: 500 }
    );
  }
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
