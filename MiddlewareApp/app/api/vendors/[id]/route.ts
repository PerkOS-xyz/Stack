import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vendors/[id]
 * Get vendor details with endpoints
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { vendor, endpoints } = await vendorDiscoveryService.getVendorWithEndpoints(id);

    if (!vendor) {
      return NextResponse.json(
        {
          success: false,
          error: "Vendor not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      vendor,
      endpoints,
    });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch vendor",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/[id]
 * Update vendor details
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow specific fields to be updated
    const allowedFields = ["name", "description", "category", "tags", "icon_url", "website_url", "docs_url"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid fields to update",
        },
        { status: 400 }
      );
    }

    const result = await vendorDiscoveryService.updateVendor(id, updates as Parameters<typeof vendorDiscoveryService.updateVendor>[1]);

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
      message: "Vendor updated successfully",
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update vendor",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vendors/[id]
 * Delete a vendor
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await vendorDiscoveryService.deleteVendor(id);

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
      message: "Vendor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete vendor",
      },
      { status: 500 }
    );
  }
}
