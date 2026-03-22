import { NextRequest, NextResponse } from "next/server";
import { getCouponService } from "@/lib/services/CouponService";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/coupons/[id]
 * Get a single coupon with stats (admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;

    const couponService = getCouponService();
    const coupon = await couponService.getCouponById(id);

    if (!coupon) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    // Get coupon statistics
    const stats = await couponService.getCouponStats(id);
    const redemptions = await couponService.getCouponRedemptions(id);

    return NextResponse.json({
      coupon,
      stats,
      redemptions,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/coupons/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/coupons/[id]
 * Update a coupon (admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const updateData = body;

    const couponService = getCouponService();

    // Check if coupon exists
    const existingCoupon = await couponService.getCouponById(id);
    if (!existingCoupon) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    // If code is being changed, check for duplicates
    if (updateData.code && updateData.code.toUpperCase() !== existingCoupon.code) {
      const duplicateCoupon = await couponService.getCouponByCode(updateData.code);
      if (duplicateCoupon) {
        return NextResponse.json(
          { error: "A coupon with this code already exists" },
          { status: 409 }
        );
      }
    }

    // Validate discount type if provided
    if (updateData.discount_type && !["percentage", "fixed"].includes(updateData.discount_type)) {
      return NextResponse.json(
        { error: "Invalid discount_type. Must be 'percentage' or 'fixed'" },
        { status: 400 }
      );
    }

    const coupon = await couponService.updateCoupon(id, updateData);

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("Error in PUT /api/admin/coupons/[id]:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/coupons/[id]?address=0x...
 * Delete a coupon (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const couponService = getCouponService();

    // Check if coupon exists
    const existingCoupon = await couponService.getCouponById(id);
    if (!existingCoupon) {
      return NextResponse.json(
        { error: "Coupon not found" },
        { status: 404 }
      );
    }

    // Check if coupon has been used
    const stats = await couponService.getCouponStats(id);
    if (stats.totalRedemptions > 0) {
      // Instead of deleting, disable the coupon
      await couponService.updateCoupon(id, { enabled: false });
      return NextResponse.json({
        message: "Coupon has been disabled instead of deleted because it has redemptions",
        disabled: true,
      });
    }

    await couponService.deleteCoupon(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/admin/coupons/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
