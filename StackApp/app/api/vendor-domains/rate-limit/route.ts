/**
 * Rate Limit Status API
 *
 * GET - Get rate limit status for a domain
 */

import { NextRequest, NextResponse } from "next/server";
import { getRateLimitService } from "@/lib/services/RateLimitService";
import { getVendorOwnershipService } from "@/lib/services/VendorOwnershipService";
import type { RateLimitStatus } from "@/lib/types/vendor-analytics";

// GET - Get rate limit status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userWalletAddress = searchParams.get("wallet");
    const domainUrl = searchParams.get("domain");

    if (!domainUrl && !userWalletAddress) {
      return NextResponse.json(
        { error: "Missing domain or wallet parameter" },
        { status: 400 }
      );
    }

    const rateLimitService = getRateLimitService();
    const vendorOwnershipService = getVendorOwnershipService();

    // If domain is specified, get single domain status
    if (domainUrl) {
      const status = await rateLimitService.getRateLimitStatus(domainUrl);

      return NextResponse.json({
        success: true,
        domain: domainUrl,
        status,
      });
    }

    // If wallet is specified, get status for all user domains
    if (userWalletAddress) {
      const domains = await vendorOwnershipService.getUserDomains(userWalletAddress);
      const verifiedDomains = domains.filter(
        (d) => d.verification_status === "verified" && d.is_active
      );

      const statuses: Array<{ domain: string; status: RateLimitStatus }> = [];

      for (const domain of verifiedDomains) {
        const status = await rateLimitService.getRateLimitStatus(domain.domain_url);
        statuses.push({
          domain: domain.domain_url,
          status,
        });
      }

      // Calculate overall summary
      const hasWarnings = statuses.some((s) => s.status.is_warning);
      const hasOverages = statuses.some((s) => s.status.is_overage);

      return NextResponse.json({
        success: true,
        user: userWalletAddress,
        totalDomains: verifiedDomains.length,
        hasWarnings,
        hasOverages,
        domains: statuses,
      });
    }

    return NextResponse.json(
      { error: "Invalid request parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[VendorDomains] Rate limit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch rate limit status" },
      { status: 500 }
    );
  }
}
