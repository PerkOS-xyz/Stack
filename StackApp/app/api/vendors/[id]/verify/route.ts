import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vendors/[id]/verify
 * Re-verify a vendor's X402 discovery endpoint
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await vendorDiscoveryService.verifyVendor(id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: "Vendor verification failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vendor verified successfully",
    });
  } catch (error) {
    console.error("Error verifying vendor:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 }
    );
  }
}
