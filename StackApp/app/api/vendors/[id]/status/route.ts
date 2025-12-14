import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vendors/[id]/status
 * Update vendor status (activate/suspend)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { status } = body;

    if (!status || !["active", "suspended"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Status must be 'active' or 'suspended'",
        },
        { status: 400 }
      );
    }

    const result = await vendorDiscoveryService.setVendorStatus(id, status);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Vendor ${status === "active" ? "activated" : "suspended"} successfully`,
    });
  } catch (error) {
    console.error("Error updating vendor status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update status",
      },
      { status: 500 }
    );
  }
}
