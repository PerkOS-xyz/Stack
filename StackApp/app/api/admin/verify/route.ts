import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/verify
 * Verifies if a wallet address is an admin via signed request.
 * Requires X-Admin-Signature, X-Admin-Timestamp, X-Admin-Address headers.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);

    return NextResponse.json({
      isAdmin: auth.authorized,
      address: auth.address || null,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/verify:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
