import { NextResponse } from "next/server";
import type { AgentCard } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";
import { config } from "@/lib/utils/config";

const x402Service = new X402Service();

export async function GET() {
  const agentCard: AgentCard = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: config.paymentReceiver,
    type: "Agent",
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    url: config.facilitatorUrl,
    capabilities: [
      "x402-payment-exact",
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []),
      "erc-8004-discovery",
      "bazaar-discovery",
    ],
    paymentMethods: x402Service.getSupported().kinds.map((kind) => ({
      scheme: kind.scheme,
      network: kind.network,
      asset: config.paymentTokens[kind.network],
    })),
    endpoints: {
      x402: `${config.facilitatorUrl}/api/v2/x402`,
      discovery: `${config.facilitatorUrl}/discovery`,
    },
  };

  return NextResponse.json(agentCard);
}
