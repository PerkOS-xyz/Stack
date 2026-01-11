import { NextRequest, NextResponse } from "next/server";
import type { Address } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { buyer, seller, network: requestNetwork } = await request.json() as {
      buyer: Address;
      seller: Address;
      network?: SupportedNetwork;
    };

    const network = requestNetwork || config.defaultNetwork;
    const x402Service = new X402Service();
    const deferredScheme = x402Service.getDeferredScheme(network);

    if (!deferredScheme) {
      return NextResponse.json(
        { error: `Deferred scheme not enabled for network: ${network}` },
        { status: 404 }
      );
    }

    // Get all unsettled vouchers
    const vouchers = deferredScheme.getVouchers({
      buyer,
      seller,
      settled: false,
    });

    if (vouchers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No vouchers to settle",
        settled: 0,
      });
    }

    // Settle each voucher (in production, use batch contract call)
    const results = [];
    for (const voucher of vouchers) {
      const result = await deferredScheme.claimVoucher(voucher.id, voucher.nonce);
      results.push({
        voucherId: voucher.id,
        nonce: voucher.nonce.toString(),
        ...result,
      });
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      settled: successCount,
      total: results.length,
      network,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch settlement failed" },
      { status: 400 }
    );
  }
}
