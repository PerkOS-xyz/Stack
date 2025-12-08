import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config, type SupportedNetwork } from "@/lib/utils/config";
import { CHAIN_IDS } from "@/lib/utils/chains";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const x402Service = new X402Service();
  const { searchParams } = new URL(request.url);
  const network = (searchParams.get("network") || config.defaultNetwork) as SupportedNetwork;

  const deferredScheme = x402Service.getDeferredScheme(network);

  if (!deferredScheme) {
    return NextResponse.json(
      { error: `Deferred scheme not enabled for network: ${network}` },
      { status: 404 }
    );
  }

  const chainIdMap: Record<SupportedNetwork, number> = {
    avalanche: CHAIN_IDS.AVALANCHE,
    "avalanche-fuji": CHAIN_IDS.AVALANCHE_FUJI,
    celo: CHAIN_IDS.CELO,
    "celo-sepolia": CHAIN_IDS.CELO_SEPOLIA,
    base: CHAIN_IDS.BASE,
    "base-sepolia": CHAIN_IDS.BASE_SEPOLIA,
  };

  return NextResponse.json({
    enabled: true,
    escrowAddress: deferredScheme.getEscrowAddress(),
    network,
    chainId: chainIdMap[network],
    thawPeriod: 86400, // 1 day
    maxDeposit: "10000000", // $10
  });
}
