import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nonce: string }> }
) {
  try {
    // Parse request body to get network (optional)
    let network: SupportedNetwork = config.defaultNetwork;
    try {
      const body = await request.json();
      if (body.network) {
        network = body.network as SupportedNetwork;
      }
    } catch {
      // Body might be empty, use default network
    }

    // Initialize service at runtime
    const x402Service = new X402Service();
    const deferredScheme = x402Service.getDeferredScheme(network);

    if (!deferredScheme) {
      return NextResponse.json(
        { error: `Deferred scheme not enabled for network: ${network}` },
        { status: 404 }
      );
    }

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
        network: config.defaultNetwork,
      },
      { status: 400 }
    );
  }
}
