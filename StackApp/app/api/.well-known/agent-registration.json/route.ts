/**
 * GET /.well-known/agent-registration.json
 * 
 * ERC-8004 domain verification and agent registration discovery endpoint.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://perkos.xyz";

  return NextResponse.json({
    name: "PerkOS Stack",
    description: "Multi-chain x402 payment infrastructure for Web3 agents",
    registrationEndpoint: `${baseUrl}/api/v2/agents/register`,
    documentationEndpoint: `${baseUrl}/api/llms.txt`,
    authMethod: "eip191-signature",
    signatureMessage: "Register as PerkOS Stack Agent",
    supportedNetworks: [
      "base", "base-sepolia",
      "avalanche", "avalanche-fuji",
      "celo", "celo-sepolia",
      "ethereum", "sepolia",
      "polygon", "polygon-amoy",
      "arbitrum", "arbitrum-sepolia",
      "optimism", "optimism-sepolia",
    ],
    capabilities: [
      "agent-registration",
      "server-wallets",
      "service-marketplace",
      "x402-payments",
      "erc8004-identity",
    ],
    version: "1.0.0",
  });
}
