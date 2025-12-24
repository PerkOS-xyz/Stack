import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

// Helper to verify admin access
function isAdminWallet(address: string): boolean {
  const adminWallets = process.env.ADMIN_WALLETS || "";
  const adminList = adminWallets
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return adminList.includes(address.toLowerCase());
}

/**
 * GET /api/admin/vendors?address=0x...&page=0&limit=20
 * Returns all vendors with their endpoints (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    if (!isAdminWallet(address)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const offset = page * limit;

    // Fetch vendors with pagination
    const { data: vendors, error, count } = await supabase
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
      const { data: endpointsData } = await supabase
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
