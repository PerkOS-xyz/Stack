/**
 * Domain Verification API
 *
 * POST - Verify domain ownership (DNS TXT, meta tag, or file upload)
 */

import { NextRequest, NextResponse } from "next/server";
import { getVendorOwnershipService } from "@/lib/services/VendorOwnershipService";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Verify domain ownership
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userWalletAddress } = body;

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "Missing userWalletAddress" },
        { status: 400 }
      );
    }

    const vendorOwnershipService = getVendorOwnershipService();
    const result = await vendorOwnershipService.verifyDomain(userWalletAddress, id);

    if (result.success && result.verified) {
      return NextResponse.json({
        success: true,
        verified: true,
        message: result.message,
        domain: result.domain,
      });
    } else {
      return NextResponse.json({
        success: false,
        verified: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("[VendorDomains] Verify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}
