import { NextRequest, NextResponse } from "next/server";
import { getCouponService, PaymentStatus } from "@/lib/services/CouponService";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/invoices?address=0x...&page=0&limit=20&status=completed
 * Returns invoices for a user
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as PaymentStatus | null;

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    const couponService = getCouponService();

    const options: {
      limit: number;
      offset: number;
      status?: PaymentStatus;
    } = {
      limit,
      offset: page * limit,
    };

    if (status && ["pending", "completed", "failed"].includes(status)) {
      options.status = status;
    }

    const { invoices, total } = await couponService.getUserInvoices(address, options);

    return NextResponse.json({
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/profile/invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
