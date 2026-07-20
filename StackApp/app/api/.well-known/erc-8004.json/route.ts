import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/utils/config";
import { firebaseAdmin } from "@/lib/db/firebase";

export const dynamic = "force-dynamic";

interface AgentRegistration {
  agentId: number;
  agentRegistry: string;
}

function getConfiguredRegistrations(): AgentRegistration[] {
  const raw = process.env.ERC8004_AGENT_REGISTRATIONS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AgentRegistration => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Record<string, unknown>;
      return Number.isInteger(candidate.agentId) &&
        Number(candidate.agentId) >= 0 &&
        typeof candidate.agentRegistry === "string" &&
        /^eip155:\d+:0x[a-fA-F0-9]{40}$/.test(candidate.agentRegistry);
    });
  } catch {
    console.error("ERC8004_AGENT_REGISTRATIONS must be a valid JSON array");
    return [];
  }
}

/**
 * ERC-8004 registration file (`registration-v1`). It intentionally publishes
 * no fake on-chain registrations: configure exact registry/id pairs only after
 * the Stack agent NFT has actually been minted.
 */
export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin;
  const registrations = getConfiguredRegistrations();

  let reputation = {
    totalTransactions: 0,
    successfulTransactions: 0,
    successRate: 100,
  };

  try {
    const { count: total } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true });
    const { count: successful } = await firebaseAdmin
      .from("perkos_x402_transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "success");
    reputation = {
      totalTransactions: total || 0,
      successfulTransactions: successful || 0,
      successRate: total ? Math.round(((successful || 0) / total) * 100) : 100,
    };
  } catch (error) {
    console.error("Failed to fetch ERC-8004 reputation stats:", error);
  }

  return NextResponse.json(
    {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: config.facilitatorName,
      description: config.facilitatorDescription,
      image: `${baseUrl}/logo.png`,
      services: [
        { name: "web", endpoint: baseUrl },
        {
          name: "A2A",
          endpoint: `${baseUrl}/.well-known/agent-card.json`,
          version: "0.3.0",
        },
        {
          name: "agentWallet",
          endpoint: `eip155:8453:${config.paymentReceiver}`,
        },
        { name: "x402-verify", endpoint: `${baseUrl}/api/v2/x402/verify`, version: "2" },
        { name: "x402-settle", endpoint: `${baseUrl}/api/v2/x402/settle`, version: "2" },
        { name: "x402-supported", endpoint: `${baseUrl}/api/v2/x402/supported`, version: "2" },
        { name: "erc8004-onboard", endpoint: `${baseUrl}/api/v2/agents/onboard`, version: "2" },
        { name: "erc8004-discovery", endpoint: `${baseUrl}/api/v2/agents/discovery`, version: "1" },
      ],
      x402Support: true,
      active: true,
      registrations,
      supportedTrust: registrations.length > 0 ? ["reputation"] : [],
      perkos: {
        registrationStatus: registrations.length > 0 ? "registered" : "unregistered",
        paymentReceiver: config.paymentReceiver,
        reputation,
        note: registrations.length > 0
          ? undefined
          : "Set ERC8004_AGENT_REGISTRATIONS after minting the on-chain identity.",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-ERC8004-Spec": "registration-v1",
        "X-x402-Version": "2",
      },
    }
  );
}
