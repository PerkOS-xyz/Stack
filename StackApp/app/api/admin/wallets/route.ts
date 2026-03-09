import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/wallets
 * Returns all sponsor wallets (admin only)
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

    // Fetch wallets with pagination
    const { data: wallets, error, count } = await firebaseAdmin
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
