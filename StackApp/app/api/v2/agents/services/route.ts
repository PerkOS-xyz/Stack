/** /api/v2/agents/services — CRUD for agent's registered services. Requires X-API-Key. */

import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/middleware/apiKeyAuth";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";
import { getAgentServices } from "@/lib/services/AgentService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, ["read"]);
    if (auth.response) return auth.response;

    const services = await getAgentServices(auth.agent.walletAddress);

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        description: s.description,
        network: s.network,
        status: s.status,
        priceUsd: s.price_usd,
        category: s.category,
        tags: s.tags,
        totalTransactions: s.total_transactions,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/v2/agents/services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, ["write"]);
    if (auth.response) return auth.response;

    const body = await req.json();
    const { url, name, description, priceUsd, endpoints, network = "base" } = body;

    if (!url) {
      return NextResponse.json(
        { error: "url is required" },
        { status: 400 }
      );
    }

    if (!endpoints || !Array.isArray(endpoints) || endpoints.length === 0) {
      return NextResponse.json(
        { error: "At least one endpoint is required" },
        { status: 400 }
      );
    }

    for (const ep of endpoints) {
      if (!ep.path || !ep.priceUsd) {
        return NextResponse.json(
          { error: "Each endpoint requires path and priceUsd" },
          { status: 400 }
        );
      }
    }

    const result = await vendorDiscoveryService.registerVendorDirect({
      url,
      name: name || undefined,
      description: description || undefined,
      walletAddress: auth.agent.walletAddress,
      network,
      priceUsd: priceUsd || endpoints[0]?.priceUsd,
      endpoints: endpoints.map((ep: { path: string; method?: string; description?: string; priceUsd: string; inputSchema?: object; outputSchema?: object }) => ({
        path: ep.path,
        method: ep.method || "POST",
        description: ep.description || undefined,
        priceUsd: ep.priceUsd,
        inputSchema: ep.inputSchema,
        outputSchema: ep.outputSchema,
      })),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to register service" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        service: {
          id: result.vendor?.id,
          name: result.vendor?.name,
          url: result.vendor?.url,
          network: result.vendor?.network,
          status: result.vendor?.status,
          priceUsd: result.vendor?.price_usd,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/v2/agents/services:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
