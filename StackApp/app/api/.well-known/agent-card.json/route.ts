import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/utils/config";

export const dynamic = "force-dynamic";

/**
 * A2A v0.3 Agent Card.
 * Canonical public path: /.well-known/agent-card.json
 */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const a2aUrl = `${baseUrl}/api/a2a`;

  return NextResponse.json(
    {
      name: `${config.facilitatorName} Registration Agent`,
      description:
        "Helps humans and autonomous agents prepare ERC-8004 registrations, verify on-chain identities, check 8004scan indexing, and integrate x402 payments.",
      protocolVersion: "0.3.0",
      version: "1.0.0",
      url: a2aUrl,
      preferredTransport: "JSONRPC",
      additionalInterfaces: [{ url: a2aUrl, transport: "JSONRPC" }],
      provider: {
        organization: "PerkOS",
        url: "https://perkos.xyz",
      },
      iconUrl: `${baseUrl}/logo.png`,
      documentationUrl: `${baseUrl}/agents/register`,
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: [
        {
          id: "prepare-erc8004-registration",
          name: "Prepare ERC-8004 registration",
          description:
            "Builds canonical registration-v1 metadata and executable unsigned calldata for an official ERC-8004 Identity Registry.",
          tags: ["erc-8004", "identity", "registration", "onchain"],
          examples: [
            "Register my agent on Monad testnet",
            "Prepare an ERC-8004 registration for https://agent.example",
          ],
        },
        {
          id: "check-agent-discovery",
          name: "Check agent discovery",
          description:
            "Checks an ERC-8004 identity and reports whether 8004scan has indexed it, with actionable metadata and endpoint guidance.",
          tags: ["8004scan", "discovery", "indexing", "health"],
          examples: ["Is agent 42 on chain 10143 visible in 8004scan?"],
        },
        {
          id: "configure-x402",
          name: "Configure x402 payments",
          description:
            "Returns Stack x402 v2 facilitator endpoints, supported payment methods, and onboarding configuration.",
          tags: ["x402", "payments", "facilitator", "stablecoins"],
          examples: ["Configure x402 payments for my Base service"],
        },
      ],
      supportsAuthenticatedExtendedCard: false,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-A2A-Protocol-Version": "0.3.0",
      },
    }
  );
}
