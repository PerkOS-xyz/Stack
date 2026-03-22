import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/agents
 * Returns all x402 agents (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type") || "all"; // all, member, provider

    const offset = page * limit;

    // Build query
    let query = firebaseAdmin
      .from("perkos_x402_agents")
      .select("*", { count: "exact" })
      .order("last_active_at", { ascending: false });

    // Filter by type if specified
    if (type !== "all") {
      query = query.eq("agent_type", type);
    }

    // Apply pagination
    const { data: agents, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching agents:", error);
      return NextResponse.json(
        { error: "Failed to fetch agents" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      agents: agents || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/agents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
