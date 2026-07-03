import { NextResponse } from "next/server";
import { getAcpNetworks, getAcpContractAddress } from "@/lib/services/AgenticCommerceService";
import { corsHeaders } from "@/lib/utils/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/v2/acp/supported
 * Advertises ERC-8183 (Agentic Commerce) support + the networks that have an
 * AgenticCommerce contract configured.
 */
export async function GET() {
  const networks = getAcpNetworks();
  return NextResponse.json(
    {
      spec: "ERC-8183",
      name: "Agentic Commerce (Job escrow)",
      enabled: networks.length > 0,
      actions: ["create", "setBudget", "fund", "submit", "complete", "reject", "claimRefund"],
      networks: networks.map((network) => ({ network, contract: getAcpContractAddress(network) })),
    },
    { headers: corsHeaders }
  );
}
