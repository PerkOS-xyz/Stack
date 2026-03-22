import { NextRequest, NextResponse } from "next/server";
import { StellarX402PaymentService } from "@/lib/services/StellarX402PaymentService";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const paymentService = new StellarX402PaymentService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, targetUrl, method } = body;

    if (!userId || !targetUrl) {
      return NextResponse.json(
        { error: "userId and targetUrl are required" },
        { status: 400 },
      );
    }

    // Validate targetUrl is a proper URL
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: "targetUrl must be a valid URL" },
        { status: 400 },
      );
    }

    const result = await paymentService.executePayment(
      userId,
      targetUrl,
      method || "GET",
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 402 },
      );
    }

    return NextResponse.json({
      success: true,
      usdcCharged: result.usdcCharged,
      txHash: result.txHash,
      response: result.response,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    logger.error("Stellar x402 payment failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
