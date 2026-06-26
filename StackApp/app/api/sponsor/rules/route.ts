import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { verifyWalletSignature } from "@/lib/middleware/sponsorWalletAuth";
import {
  sponsorRuleCreateSchema,
  sponsorRuleUpdateSchema,
  validateBody,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";

/**
 * Authorize that the EIP-191 signer owns the sponsor wallet `walletId`.
 * Returns an error NextResponse to return directly, or null when authorized.
 * Gas-sponsorship rules govern who/what a wallet sponsors, so only the wallet
 * owner may create/modify/delete them.
 */
async function authorizeWalletOwner(
  req: NextRequest,
  walletId: string
): Promise<NextResponse | null> {
  const auth = await verifyWalletSignature(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  const { data: wallet, error } = await firebaseAdmin
    .from("perkos_sponsor_wallets")
    .select("user_wallet_address")
    .eq("id", walletId)
    .single();

  if (error || !wallet) {
    return NextResponse.json({ error: "Sponsor wallet not found" }, { status: 404 });
  }

  const owner = (wallet.user_wallet_address as string | undefined)?.toLowerCase();
  if (!owner || auth.address !== owner) {
    return NextResponse.json(
      { error: "Forbidden: you do not own this sponsor wallet" },
      { status: 403 }
    );
  }
  return null;
}

/** Resolve the owning wallet of a rule, then authorize the caller owns it. */
async function authorizeRuleOwner(
  req: NextRequest,
  ruleId: string
): Promise<NextResponse | null> {
  const { data: rule, error } = await firebaseAdmin
    .from("perkos_sponsor_rules")
    .select("sponsor_wallet_id")
    .eq("id", ruleId)
    .single();

  if (error || !rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return authorizeWalletOwner(req, rule.sponsor_wallet_id as string);
}

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
    // Validate input shape/types up front
    const validation = validateBody(sponsorRuleCreateSchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
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
    } = validation.data;

    // Authorization: only the sponsor wallet owner can add rules to it
    const authError = await authorizeWalletOwner(req, walletId);
    if (authError) return authError;

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

    // Authorization: only the owner of the rule's sponsor wallet can delete it
    const authError = await authorizeRuleOwner(req, ruleId);
    if (authError) return authError;

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

    // Authorization: only the owner of the rule's sponsor wallet can update it
    const authError = await authorizeRuleOwner(req, ruleId);
    if (authError) return authError;

    const validation = validateBody(sponsorRuleUpdateSchema, await req.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const body = validation.data;
    const updateData: Record<string, unknown> = {};

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
