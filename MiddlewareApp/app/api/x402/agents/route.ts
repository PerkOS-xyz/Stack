/**
 * API Route: GET /api/x402/agents
 * Fetch x402 agents (members and providers) for the dashboard
 *
 * Members = payers (addresses that have sent payments)
 * Providers = payees (addresses that have received payments)
 *
 * Data is derived from perkos_transactions table and perkos_agents table
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

interface AgentData {
  address: string;
  name: string | null;
  description: string | null;
  total_transactions: number;
  total_volume: number;
  primary_network: string;
  last_transaction_at: string | null;
  created_at: string | null;
  average_rating: number;
}

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
        timeFilter = null; // 'all' time
    }

    // First, try to get agents from perkos_agents table
    const { data: registeredAgents, error: agentsError } = await supabase
      .from("perkos_agents")
      .select("address, name, description, total_transactions, total_volume, average_rating, last_transaction_at, created_at");

    // Create a map of registered agents for quick lookup
    const registeredAgentsMap = new Map<string, typeof registeredAgents extends (infer T)[] ? T : never>();
    if (registeredAgents) {
      for (const agent of registeredAgents) {
        registeredAgentsMap.set(agent.address.toLowerCase(), agent);
      }
    }

    // Fetch transactions to derive agent data
    // Members = payers, Providers = payees
    const addressField = agentType === "member" ? "payer" : "payee";

    let txQuery = supabase
      .from("perkos_transactions")
      .select("payer, payee, amount, network, created_at, status")
      .eq("status", "settled");

    if (timeFilter) {
      txQuery = txQuery.gte("created_at", timeFilter.toISOString());
    }

    const { data: transactions, error: txError } = await txQuery;

    if (txError) {
      console.error("Error fetching transactions:", txError);
      return returnEmptyResponse(agentType);
    }

    // Aggregate data by address
    const agentDataMap = new Map<string, AgentData>();

    for (const tx of transactions || []) {
      const address = agentType === "member" ? tx.payer : tx.payee;
      if (!address) continue;

      const addressLower = address.toLowerCase();
      const existing = agentDataMap.get(addressLower);
      const amountUsd = Number(tx.amount || "0") / 1e6; // USDC has 6 decimals

      // Check if this address has registered agent info
      const registeredInfo = registeredAgentsMap.get(addressLower);

      if (existing) {
        existing.total_transactions += 1;
        existing.total_volume += amountUsd;
        if (!existing.last_transaction_at || new Date(tx.created_at) > new Date(existing.last_transaction_at)) {
          existing.last_transaction_at = tx.created_at;
        }
      } else {
        agentDataMap.set(addressLower, {
          address: address,
          name: registeredInfo?.name || null,
          description: registeredInfo?.description || null,
          total_transactions: 1,
          total_volume: amountUsd,
          primary_network: tx.network || "avalanche",
          last_transaction_at: tx.created_at,
          created_at: registeredInfo?.created_at || tx.created_at,
          average_rating: registeredInfo?.average_rating || 0,
        });
      }
    }

    // Convert to array and sort by volume
    const allAgents = Array.from(agentDataMap.values())
      .sort((a, b) => b.total_volume - a.total_volume);

    // Calculate stats
    const totalAgents = allAgents.length;
    const activeAgents = allAgents.filter((a) => {
      if (!a.last_transaction_at) return false;
      const lastActive = new Date(a.last_transaction_at);
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return lastActive >= cutoff;
    }).length;

    // Count new today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const newToday = allAgents.filter((a) => {
      if (!a.created_at) return false;
      return new Date(a.created_at) >= todayStart;
    }).length;

    const totalVolumeUsd = allAgents.reduce((sum, a) => sum + a.total_volume, 0);

    // Apply pagination
    const paginatedAgents = allAgents.slice(offset, offset + limit);

    // Format agents for frontend
    const formattedAgents = paginatedAgents.map((agent) => ({
      address: formatAddress(agent.address),
      fullAddress: agent.address,
      name: agent.name,
      transactions: agent.total_transactions,
      volume: formatCurrency(agent.total_volume),
      network: agent.primary_network,
      rating: agent.average_rating,
    }));

    return NextResponse.json({
      agents: formattedAgents,
      pagination: {
        limit,
        offset,
        total: totalAgents,
        hasMore: offset + limit < totalAgents,
      },
      stats: {
        total: totalAgents,
        active: activeAgents,
        newToday: newToday,
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

// Helper function to return empty response on error
function returnEmptyResponse(agentType: string) {
  return NextResponse.json({
    agents: [],
    pagination: {
      limit: 50,
      offset: 0,
      total: 0,
      hasMore: false,
    },
    stats: {
      total: 0,
      active: 0,
      newToday: 0,
      totalVolume: "$0.00",
    },
  });
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
