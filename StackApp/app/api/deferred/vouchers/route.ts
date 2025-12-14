import { NextRequest, NextResponse } from "next/server";
import type { DeferredPayload, Address } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const x402Service = new X402Service();
  const { searchParams } = new URL(request.url);
  const network = (searchParams.get("network") || config.defaultNetwork) as SupportedNetwork;
  const buyer = searchParams.get("buyer") as Address | null;
  const seller = searchParams.get("seller") as Address | null;
  const asset = searchParams.get("asset") as Address | null;
  const settledParam = searchParams.get("settled");
  const settled = settledParam === "true" ? true : settledParam === "false" ? false : undefined;

  const deferredScheme = x402Service.getDeferredScheme(network);

  if (!deferredScheme) {
    return NextResponse.json(
      { error: `Deferred scheme not enabled for network: ${network}` },
      { status: 404 }
    );
  }

  const vouchers = deferredScheme.getVouchers({
    buyer: buyer || undefined,
    seller: seller || undefined,
    asset: asset || undefined,
    settled,
  });

  return NextResponse.json({
    count: vouchers.length,
    vouchers: vouchers.map(v => ({
      id: v.id,
      buyer: v.buyer,
      seller: v.seller,
      asset: v.asset,
      nonce: v.nonce.toString(),
      valueAggregate: v.valueAggregate.toString(),
      timestamp: v.timestamp.toString(),
      settled: v.settled,
      settledTxHash: v.settledTxHash,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const x402Service = new X402Service();
    const { searchParams } = new URL(request.url);
    const network = (searchParams.get("network") || config.defaultNetwork) as SupportedNetwork;
    const body = await request.json() as DeferredPayload;

    const deferredScheme = x402Service.getDeferredScheme(network);

    if (!deferredScheme) {
      return NextResponse.json(
        { error: `Deferred scheme not enabled for network: ${network}` },
        { status: 404 }
      );
    }

    // Verify and store
    const result = await deferredScheme.verify(body, {
      scheme: "deferred",
      network,
      maxAmountRequired: body.voucher.valueAggregate.toString(),
      resource: "",
      payTo: body.voucher.seller,
      maxTimeoutSeconds: 60,
      asset: body.voucher.asset,
    });

    if (!result.isValid) {
      return NextResponse.json(
        { error: result.invalidReason || "Invalid voucher" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      voucherId: body.voucher.id,
      nonce: body.voucher.nonce.toString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage failed" },
      { status: 400 }
    );
  }
}
