import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";

const x402Service = new X402Service();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nonce: string }> }
) {
  const deferredScheme = x402Service.getDeferredScheme();

  if (!deferredScheme) {
    return NextResponse.json(
      { error: "Deferred scheme not enabled" },
      { status: 404 }
    );
  }

  try {
    const { id, nonce } = await params;
    const voucherId = id as Hex;
    const voucherNonce = BigInt(nonce);

    const result = await deferredScheme.claimVoucher(voucherId, voucherNonce);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Claim failed",
        payer: null,
        transaction: null,
        network: "avalanche",
      },
      { status: 400 }
    );
  }
}
