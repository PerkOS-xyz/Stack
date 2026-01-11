import { NextRequest, NextResponse } from "next/server";
import { getCouponService } from "@/lib/services/CouponService";

export const dynamic = "force-dynamic";

/**
 * POST /api/coupons/validate
 * Validate a coupon code for a user
 *
 * Body: {
 *   code: string,
 *   address: string,
 *   tier: string,
 *   amount: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, address, tier, amount } = body;

    // Validate required fields
    if (!code) {
      return NextResponse.json(
        { error: "Coupon code is required" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    if (!tier) {
      return NextResponse.json(
        { error: "Subscription tier is required" },
        { status: 400 }
      );
    }

    if (amount === undefined || amount === null || amount < 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    const couponService = getCouponService();
    const result = await couponService.validateCoupon(code, address, tier, amount);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        error: result.error,
        discount_amount: 0,
        final_amount: amount,
      });
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: result.coupon?.id,
        code: result.coupon?.code,
        discount_type: result.coupon?.discount_type,
        discount_value: result.coupon?.discount_value,
        description: result.coupon?.description,
      },
      discount_amount: result.discount_amount,
      final_amount: result.final_amount,
    });
  } catch (error) {
    console.error("Error in POST /api/coupons/validate:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
