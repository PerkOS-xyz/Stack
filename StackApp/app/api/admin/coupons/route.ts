import { NextRequest, NextResponse } from "next/server";
import { getCouponService } from "@/lib/services/CouponService";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";
import { couponCreateSchema, validateBody } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/coupons
 * Returns all coupons (admin only)
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
    const enabledParam = searchParams.get("enabled");

    const couponService = getCouponService();

    const options: { enabled?: boolean; limit: number; offset: number } = {
      limit,
      offset: page * limit,
    };

    if (enabledParam !== null) {
      options.enabled = enabledParam === "true";
    }

    const { coupons, total } = await couponService.getCoupons(options);

    return NextResponse.json({
      coupons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/coupons:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/coupons
 * Create a new coupon (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Validate + allowlist fields (zod strips unknown keys -> no mass-assignment)
    const validation = validateBody(couponCreateSchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const couponData = validation.data;

    const couponService = getCouponService();

    // Check if code already exists
    const existingCoupon = await couponService.getCouponByCode(couponData.code);
    if (existingCoupon) {
      return NextResponse.json(
        { error: "A coupon with this code already exists" },
        { status: 409 }
      );
    }

    const coupon = await couponService.createCoupon({
      ...couponData,
      created_by: auth.address!, // guaranteed by auth.authorized above
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/admin/coupons:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
