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
 * GET /api/admin/wallets?address=0x...&page=0&limit=20
 * Returns all sponsor wallets (admin only)
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

    // Fetch wallets with pagination
    const { data: wallets, error, count } = await supabase
      .from("perkos_sponsor_wallets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching wallets:", error);
      return NextResponse.json(
        { error: "Failed to fetch wallets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      wallets: wallets || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/wallets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
