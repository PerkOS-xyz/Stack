import { NextRequest, NextResponse } from "next/server";
import type { Address } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";

const x402Service = new X402Service();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = (searchParams.get("network") || config.defaultNetwork) as SupportedNetwork;
    const buyer = searchParams.get("buyer") as Address;
    const seller = searchParams.get("seller") as Address;
    const asset = searchParams.get("asset") as Address;

    const deferredScheme = x402Service.getDeferredScheme(network);

    if (!deferredScheme) {
      return NextResponse.json(
        { error: `Deferred scheme not enabled for network: ${network}` },
        { status: 404 }
      );
    }

    if (!buyer || !seller || !asset) {
      return NextResponse.json(
        { error: "Missing required parameters: buyer, seller, asset" },
        { status: 400 }
      );
    }

    const balance = await deferredScheme.getEscrowBalance(buyer, seller, asset);

    return NextResponse.json({
      buyer,
      seller,
      asset,
      network,
      balance: balance.toString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Balance query failed" },
      { status: 400 }
    );
  }
}
