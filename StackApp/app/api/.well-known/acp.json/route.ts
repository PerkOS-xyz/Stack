import { NextRequest, NextResponse } from "next/server";
import { getAcpNetworks, getAcpContractAddress } from "@/lib/services/AgenticCommerceService";
import { corsHeaders } from "@/lib/utils/cors";

export const dynamic = "force-dynamic";

/**
 * GET /.well-known/acp.json
 * Discovery document advertising this facilitator's ERC-8183 (Agentic Commerce)
 * support — the coordination/settlement rail (job escrow) alongside x402.
 */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const networks = getAcpNetworks();

  return NextResponse.json(
    {
      schemaVersion: "1.0.0",
      spec: "ERC-8183",
      name: "PerkOS Stack — Agentic Commerce",
      description: "On-chain job escrow (client → provider → evaluator) for agent work settlement.",
      enabled: networks.length > 0,
      contracts: networks.map((network) => ({ network, address: getAcpContractAddress(network) })),
      endpoints: {
        jobs: `${baseUrl}/api/v2/acp/jobs`,
        supported: `${baseUrl}/api/v2/acp/supported`,
      },
      reference: "https://eips.ethereum.org/EIPS/eip-8183",
    },
    { headers: corsHeaders }
  );
}
