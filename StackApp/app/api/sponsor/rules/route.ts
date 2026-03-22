import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";

// GET /api/sponsor/rules?walletId=xxx - Get all rules for a sponsor wallet
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletId = searchParams.get("walletId");

    if (!walletId) {
      return NextResponse.json(
        { error: "walletId is required" },
        { status: 400 }
      );
    }

    // Fetch all rules for the wallet, ordered by priority
    const { data: rules, error } = await firebaseAdmin
      .from("perkos_sponsor_rules")
      .select("*")
      .eq("sponsor_wallet_id", walletId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching rules:", error);
      return NextResponse.json(
        { error: "Failed to fetch rules" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: rules || [],
    });
  } catch (error) {
    console.error("Error in GET /api/sponsor/rules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sponsor/rules - Create a new rule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletId,
      ruleType,
      agentAddress,
      domain,
      dailyLimitWei,
      monthlyLimitWei,
      perTransactionLimitWei,
      activeHoursStart,
      activeHoursEnd,
      activeDays,
      priority = 0,
      description = "",
    } = body;

    // Validate required fields
    if (!walletId || !ruleType) {
      return NextResponse.json(
        { error: "walletId and ruleType are required" },
        { status: 400 }
      );
    }

    // Validate rule type
    const validRuleTypes = ["agent_whitelist", "domain_whitelist", "spending_limit", "time_restriction"];
    if (!validRuleTypes.includes(ruleType)) {
      return NextResponse.json(
        { error: `Invalid rule type. Must be one of: ${validRuleTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate agentAddress for agent_whitelist rules
    if (ruleType === "agent_whitelist" && !agentAddress) {
      return NextResponse.json(
        { error: "agentAddress is required for agent_whitelist rules" },
        { status: 400 }
      );
    }

    // Validate domain for domain_whitelist rules
    if (ruleType === "domain_whitelist" && !domain) {
      return NextResponse.json(
        { error: "domain is required for domain_whitelist rules" },
        { status: 400 }
      );
    }

    // Create the rule
    const { data: rule, error } = await firebaseAdmin
      .from("perkos_sponsor_rules")
      .insert({
        sponsor_wallet_id: walletId,
        rule_type: ruleType,
        agent_address: agentAddress || null,
        domain: domain || null,
        daily_limit_wei: dailyLimitWei || null,
        monthly_limit_wei: monthlyLimitWei || null,
        per_transaction_limit_wei: perTransactionLimitWei || null,
        active_hours_start: activeHoursStart || null,
        active_hours_end: activeHoursEnd || null,
        active_days: activeDays || null,
        priority,
        description,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating rule:", error);
      return NextResponse.json(
        { error: "Failed to create rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rule,
      message: "Rule created successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/sponsor/rules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sponsor/rules?ruleId=xxx - Delete a rule
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId");

    if (!ruleId) {
      return NextResponse.json(
        { error: "ruleId is required" },
        { status: 400 }
      );
    }

    const { error } = await firebaseAdmin
      .from("perkos_sponsor_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      console.error("Error deleting rule:", error);
      return NextResponse.json(
        { error: "Failed to delete rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Rule deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/sponsor/rules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sponsor/rules?ruleId=xxx - Update a rule
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId");

    if (!ruleId) {
      return NextResponse.json(
        { error: "ruleId is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateData: any = {};

    // Only include fields that are provided
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.agentAddress !== undefined) updateData.agent_address = body.agentAddress;
    if (body.domain !== undefined) updateData.domain = body.domain;
    if (body.dailyLimitWei !== undefined) updateData.daily_limit_wei = body.dailyLimitWei;
    if (body.monthlyLimitWei !== undefined) updateData.monthly_limit_wei = body.monthlyLimitWei;
    if (body.perTransactionLimitWei !== undefined) updateData.per_transaction_limit_wei = body.perTransactionLimitWei;

    const { data: rule, error } = await firebaseAdmin
      .from("perkos_sponsor_rules")
      .update(updateData)
      .eq("id", ruleId)
      .select()
      .single();

    if (error) {
      console.error("Error updating rule:", error);
      return NextResponse.json(
        { error: "Failed to update rule" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rule,
      message: "Rule updated successfully",
    });
  } catch (error) {
    console.error("Error in PATCH /api/sponsor/rules:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
