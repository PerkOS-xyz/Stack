/**
 * GET /api/v2/agents/me
 * 
 * Returns authenticated agent's profile, wallets, and services.
 * Requires X-API-Key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/middleware/apiKeyAuth";
import {
  getAgentById,
  getAgentWallets,
  getAgentServices,
} from "@/lib/services/AgentService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, ["read"]);
    if (auth.response) return auth.response;

    const agent = await getAgentById(auth.agent.agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [wallets, services] = await Promise.all([
      getAgentWallets(agent.wallet_address),
      getAgentServices(agent.wallet_address),
    ]);

    return NextResponse.json({
      agent,
      wallets: wallets.map((w) => ({
        id: w.id,
        address: w.sponsor_address,
        network: w.network,
        walletType: w.wallet_type,
        name: w.wallet_name,
        createdAt: w.created_at,
      })),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        network: s.network,
        status: s.status,
        priceUsd: s.price_usd,
        createdAt: s.created_at,
      })),
      stats: {
        walletCount: wallets.length,
        serviceCount: services.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/v2/agents/me:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
