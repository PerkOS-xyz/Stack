/**
 * API Route: GET /api/x402/agents
 * Fetch x402 agents (members and providers) for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const agentType = searchParams.get("type") || "member"; // 'member' or 'provider'
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate time filter
    let timeFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case "24h":
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = null;
    }

    // Build query for agents
    let query = supabase
      .from("perkos_x402_agents")
      .select(
        `
        id,
        wallet_address,
        agent_type,
        display_name,
        total_transactions,
        total_volume_usd,
        primary_network,
        first_seen_at,
        last_active_at
      `,
        { count: "exact" }
      )
      .eq("agent_type", agentType)
      .order("total_volume_usd", { ascending: false });

    // Apply time filter on last_active_at
    if (timeFilter) {
      query = query.gte("last_active_at", timeFilter.toISOString());
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: agents, error, count } = await query;

    if (error) {
      console.error("Error fetching agents:", error);
      return NextResponse.json(
        { error: "Failed to fetch agents", details: error.message },
        { status: 500 }
      );
    }

    // Get overall stats for this agent type
    let statsQuery = supabase
      .from("perkos_x402_agents")
      .select("id, total_volume_usd, last_active_at")
      .eq("agent_type", agentType);

    const { data: allAgents } = await statsQuery;

    // Calculate stats
    const totalAgents = allAgents?.length || 0;
    const activeAgents =
      allAgents?.filter((a) => {
        const lastActive = new Date(a.last_active_at);
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return lastActive >= cutoff;
      }).length || 0;

    // Count new today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { count: newToday } = await supabase
      .from("perkos_x402_agents")
      .select("id", { count: "exact", head: true })
      .eq("agent_type", agentType)
      .gte("first_seen_at", todayStart.toISOString());

    const totalVolumeUsd =
      allAgents?.reduce((sum, a) => sum + (a.total_volume_usd || 0), 0) || 0;

    // Format agents for frontend
    const formattedAgents = agents?.map((agent) => ({
      address: formatAddress(agent.wallet_address),
      fullAddress: agent.wallet_address,
      name: agent.display_name,
      transactions: agent.total_transactions || 0,
      volume: formatCurrency(agent.total_volume_usd || 0),
      network: agent.primary_network || "avalanche",
    }));

    return NextResponse.json({
      agents: formattedAgents || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      stats: {
        total: totalAgents,
        active: activeAgents,
        newToday: newToday || 0,
        totalVolume: formatCurrency(totalVolumeUsd),
      },
    });
  } catch (error) {
    console.error("Error in agents API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}
