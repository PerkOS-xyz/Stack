import { NextResponse } from "next/server";
import { config } from "@/lib/utils/config";
import { X402Service } from "@/lib/services/X402Service";

export const dynamic = 'force-dynamic';

/**
 * ERC-8004: Trustless Agent Discovery
 * Standard endpoint: /.well-known/erc-8004.json
 * Provides agent metadata, capabilities, and trust mechanisms
 */
export async function GET() {
  const x402Service = new X402Service();
  const agentRegistration = {
    // Basic metadata
    name: config.facilitatorName,
    description: config.facilitatorDescription,
    image: `${config.facilitatorUrl}/logo.png`,

    // Agent identity
    agentId: config.paymentReceiver,
    url: config.facilitatorUrl,

    // Communication endpoints
    endpoints: {
      a2a: `${config.facilitatorUrl}/api/v2/x402`, // Agent-to-Agent communication
      mcp: null, // Model Context Protocol (not implemented)
      ens: null, // ENS name (optional)
      did: null, // Decentralized Identifier (optional)
      wallet: config.paymentReceiver, // Agent's wallet address
    },

    // Supported capabilities
    capabilities: [
      "x402-payment-exact", // EIP-3009 exact payments
      ...(config.deferredEnabled ? ["x402-payment-deferred"] : []), // EIP-712 deferred payments
      "erc-8004-discovery", // Agent discovery
      "multi-chain-support", // Avalanche, Base support
    ],

    // Payment methods (per network)
    paymentMethods: x402Service.getSupported().kinds.map((kind) => ({
      scheme: kind.scheme,
      network: kind.network,
      asset: config.paymentToken,
      chainId: kind.network === "avalanche" ? 43114 : kind.network === "base" ? 8453 : null,
    })),

    // Trust models (ERC-8004 standard)
    trustModels: [
      {
        type: "reputation",
        description: "On-chain transaction history and community feedback",
        enabled: true,
      },
      {
        type: "cryptoeconomic",
        description: "Stake-secured validation for critical operations",
        enabled: false, // Not yet implemented
      },
      {
        type: "tee-attestation",
        description: "Trusted Execution Environment verification",
        enabled: false, // Not yet implemented
      },
    ],

    // Registration details (optional)
    registration: {
      registryAddress: null, // ERC-721 NFT registry (not yet deployed)
      tokenId: null, // Unique agent identifier in registry
      registered: false,
    },

    // Reputation (optional)
    reputation: {
      totalTransactions: 0, // Replace with actual data
      successRate: 0, // Replace with actual data
      averageRating: 0, // Replace with actual data
      lastUpdated: new Date().toISOString(),
    },

    // Metadata
    version: "1.0.0",
    spec: "ERC-8004",
    created: new Date().toISOString(),
  };

  return NextResponse.json(agentRegistration, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}
