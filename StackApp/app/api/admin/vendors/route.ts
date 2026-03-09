import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/vendors
 * Returns all vendors with their endpoints (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    const offset = page * limit;

    // Fetch vendors with pagination
    const { data: vendors, error, count } = await firebaseAdmin
      .from("perkos_vendors")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching vendors:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      );
    }

    // Fetch endpoints for each vendor
    const vendorIds = (vendors || []).map((v) => v.id);
    let endpoints: any[] = [];

    if (vendorIds.length > 0) {
      const { data: endpointsData } = await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .select("*")
        .in("vendor_id", vendorIds);
      endpoints = endpointsData || [];
    }

    // Attach endpoints to vendors
    const vendorsWithEndpoints = (vendors || []).map((vendor) => ({
      ...vendor,
      endpoints: endpoints.filter((e) => e.vendor_id === vendor.id),
    }));

    return NextResponse.json({
      vendors: vendorsWithEndpoints,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/vendors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
