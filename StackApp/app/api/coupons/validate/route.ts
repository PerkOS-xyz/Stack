import { NextRequest, NextResponse } from "next/server";
import { getCouponService } from "@/lib/services/CouponService";
import { couponValidateSchema, validateBody } from "@/lib/validation/schemas";

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

    // Validate input shape/types before any lookup
    const validation = validateBody(couponValidateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { code, address, tier, amount } = validation.data;

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
