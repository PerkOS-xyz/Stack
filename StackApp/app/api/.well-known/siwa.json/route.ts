import { NextRequest, NextResponse } from "next/server";
import { AGENT_READY_NETWORK_OPTIONS } from "@/lib/utils/network-capabilities";
import { getErc8004Registries, type SupportedNetwork } from "@/lib/utils/config";
import { corsHeaders } from "@/lib/utils/cors";
import { getSiwaDomain, getSiwaVerifyUri } from "@/lib/siwa/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    protocol: "SIWA",
    version: "1",
    sdk: "@buildersgarden/siwa@0.0.24",
    domain: getSiwaDomain(request),
    endpoints: {
      nonce: "/api/v2/agents/siwa/nonce",
      verify: getSiwaVerifyUri(request),
      session: "/api/v2/agents/siwa/session",
    },
    requestAuthentication: {
      standard: "ERC-8128",
      receiptHeader: "X-SIWA-Receipt",
    },
    controllerPolicy: {
      type: "erc8004-owner",
      delegatedAgentWallets: false,
    },
    identityNetworks: AGENT_READY_NETWORK_OPTIONS.map((entry) => ({
      network: entry.value,
      chainId: entry.chainId,
      registry: getErc8004Registries(entry.value as SupportedNetwork).identity,
    })),
  }, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } });
}
