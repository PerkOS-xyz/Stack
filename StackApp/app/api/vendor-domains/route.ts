/**
 * Vendor Domains API
 *
 * GET  - List user's claimed domains
 * POST - Claim a new domain
 */

import { NextRequest, NextResponse } from "next/server";
import { getVendorOwnershipService } from "@/lib/services/VendorOwnershipService";
import type { ClaimDomainRequest } from "@/lib/types/vendor-analytics";

// GET - List user's claimed domains
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userWalletAddress = searchParams.get("wallet");
    const sponsorWalletId = searchParams.get("sponsorWallet");

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    const vendorOwnershipService = getVendorOwnershipService();

    let domains;
    if (sponsorWalletId) {
      // Get domains for specific sponsor wallet
      domains = await vendorOwnershipService.getSponsorWalletDomains(
        sponsorWalletId
      );
    } else {
      // Get all domains for user
      domains = await vendorOwnershipService.getUserDomains(userWalletAddress);
    }

    return NextResponse.json({
      success: true,
      domains,
      count: domains.length,
    });
  } catch (error) {
    console.error("[VendorDomains] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch domains" },
      { status: 500 }
    );
  }
}

// POST - Claim a new domain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWalletAddress, domain_url, sponsor_wallet_id, verification_method } = body;

    // Validate required fields
    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing userWalletAddress" },
        { status: 400 }
      );
    }

    if (!domain_url) {
      return NextResponse.json(
        { error: "Missing domain_url" },
        { status: 400 }
      );
    }

    if (!sponsor_wallet_id) {
      return NextResponse.json(
        { error: "Missing sponsor_wallet_id" },
        { status: 400 }
      );
    }

    if (!verification_method || !["dns_txt", "meta_tag", "file_upload"].includes(verification_method)) {
      return NextResponse.json(
        { error: "Invalid verification_method. Must be dns_txt, meta_tag, or file_upload" },
        { status: 400 }
      );
    }

    const claimRequest: ClaimDomainRequest = {
      domain_url,
      sponsor_wallet_id,
      verification_method,
    };

    const vendorOwnershipService = getVendorOwnershipService();
    const result = await vendorOwnershipService.claimDomain(
      userWalletAddress,
      claimRequest
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[VendorDomains] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to claim domain" },
      { status: 500 }
    );
  }
}
