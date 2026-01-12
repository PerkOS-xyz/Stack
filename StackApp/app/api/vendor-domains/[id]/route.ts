/**
 * Individual Vendor Domain API
 *
 * GET    - Get domain details
 * DELETE - Remove domain claim
 * PATCH  - Update domain rate limits
 */

import { NextRequest, NextResponse } from "next/server";
import { getVendorOwnershipService } from "@/lib/services/VendorOwnershipService";
import { getRateLimitService } from "@/lib/services/RateLimitService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get domain details with rate limit status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userWalletAddress = searchParams.get("wallet");

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    const vendorOwnershipService = getVendorOwnershipService();
    const rateLimitService = getRateLimitService();

    // Get all user domains and find the specific one
    const domains = await vendorOwnershipService.getUserDomains(userWalletAddress);
    const domain = domains.find((d) => d.id === id);

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 }
      );
    }

    // Get rate limit status if domain is verified
    let rateLimitStatus = null;
    if (domain.verification_status === "verified") {
      rateLimitStatus = await rateLimitService.getRateLimitStatus(domain.domain_url);
    }

    return NextResponse.json({
      success: true,
      domain,
      rateLimitStatus,
    });
  } catch (error) {
    console.error("[VendorDomains] GET by ID error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch domain" },
      { status: 500 }
    );
  }
}

// DELETE - Remove domain claim
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userWalletAddress = searchParams.get("wallet");

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    const vendorOwnershipService = getVendorOwnershipService();
    const success = await vendorOwnershipService.removeDomain(userWalletAddress, id);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to remove domain" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Domain removed successfully",
    });
  } catch (error) {
    console.error("[VendorDomains] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove domain" },
      { status: 500 }
    );
  }
}

// PATCH - Update domain rate limits
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userWalletAddress, requests_per_minute, requests_per_hour, requests_per_day } = body;

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing userWalletAddress" },
        { status: 400 }
      );
    }

    // Validate rate limit values if provided
    const limits: {
      requests_per_minute?: number | null;
      requests_per_hour?: number | null;
      requests_per_day?: number | null;
    } = {};

    if (requests_per_minute !== undefined) {
      if (requests_per_minute !== null && (typeof requests_per_minute !== "number" || requests_per_minute < 1)) {
        return NextResponse.json(
          { error: "Invalid requests_per_minute" },
          { status: 400 }
        );
      }
      limits.requests_per_minute = requests_per_minute;
    }

    if (requests_per_hour !== undefined) {
      if (requests_per_hour !== null && (typeof requests_per_hour !== "number" || requests_per_hour < 1)) {
        return NextResponse.json(
          { error: "Invalid requests_per_hour" },
          { status: 400 }
        );
      }
      limits.requests_per_hour = requests_per_hour;
    }

    if (requests_per_day !== undefined) {
      if (requests_per_day !== null && (typeof requests_per_day !== "number" || requests_per_day < 1)) {
        return NextResponse.json(
          { error: "Invalid requests_per_day" },
          { status: 400 }
        );
      }
      limits.requests_per_day = requests_per_day;
    }

    const vendorOwnershipService = getVendorOwnershipService();
    const rateLimitService = getRateLimitService();

    const updatedDomain = await vendorOwnershipService.updateDomainRateLimits(
      userWalletAddress,
      id,
      limits
    );

    if (!updatedDomain) {
      return NextResponse.json(
        { error: "Failed to update rate limits" },
        { status: 500 }
      );
    }

    // Clear rate limit cache for this domain
    rateLimitService.clearCache(updatedDomain.domain_url);

    return NextResponse.json({
      success: true,
      domain: updatedDomain,
      message: "Rate limits updated successfully",
    });
  } catch (error) {
    console.error("[VendorDomains] PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update domain" },
      { status: 500 }
    );
  }
}
