import { NextRequest, NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { config } from "@/lib/utils/config";
import { NETWORK_CAPABILITIES } from "@/lib/utils/network-capabilities";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const x402Service = new X402Service();
  const supported = x402Service.getSupported();
  const paymentTokens = Object.fromEntries(
    NETWORK_CAPABILITIES.map(({ network, asset }) => [network, asset])
  );
  const deferredNetworks = new Set(
    supported.kinds
      .filter(({ scheme }) => scheme === "deferred")
      .map(({ network }) => network)
  );
  return NextResponse.json({
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    url: baseUrl,
    supportedSchemes: supported.kinds,
    defaultNetwork: config.defaultNetwork,
    paymentTokens,
    networkCapabilities: NETWORK_CAPABILITIES.map((capability) => ({
      ...capability,
      caip2: `eip155:${capability.chainId}`,
      identityMode: capability.erc8004Identity ? "native" : "cross-chain-binding",
    })),
    deferredEnabled: config.deferredEnabled,
    deferredEscrowAddresses: Object.fromEntries(
      Object.entries(config.deferredEscrowAddresses).filter(([network]) =>
        deferredNetworks.has(network)
      )
    ),
  });
}
