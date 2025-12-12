import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

/**
 * GET /api/vendors
 * List all active vendors with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const network = searchParams.get("network") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const { vendors, total } = await vendorDiscoveryService.getActiveVendors({
      network,
      category,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      vendors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + vendors.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch vendors",
      },
      { status: 500 }
    );
  }
}
