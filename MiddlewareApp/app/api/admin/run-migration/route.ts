/**
 * API Route: POST /api/admin/run-migration
 * Run database migrations using Supabase service role
 *
 * This is a one-time migration endpoint - should be disabled after use
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Migration SQL - split into individual statements
const MIGRATION_STATEMENTS = [
  // Create perkos_x402_transactions table
  `CREATE TABLE IF NOT EXISTS perkos_x402_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash TEXT NOT NULL UNIQUE,
    payer_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    sponsor_address TEXT,
    amount_wei TEXT NOT NULL,
    amount_usd DECIMAL(20, 6),
    asset_address TEXT NOT NULL,
    asset_symbol TEXT DEFAULT 'USDC',
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    scheme TEXT NOT NULL DEFAULT 'exact',
    vendor_domain TEXT,
    vendor_endpoint TEXT,
    vendor_id UUID,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Create indexes for perkos_x402_transactions
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_payer ON perkos_x402_transactions(payer_address)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_recipient ON perkos_x402_transactions(recipient_address)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_sponsor ON perkos_x402_transactions(sponsor_address)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_network ON perkos_x402_transactions(network)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_chain ON perkos_x402_transactions(chain_id)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_scheme ON perkos_x402_transactions(scheme)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_status ON perkos_x402_transactions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_created ON perkos_x402_transactions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_vendor ON perkos_x402_transactions(vendor_domain)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_network_created ON perkos_x402_transactions(network, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_payer_created ON perkos_x402_transactions(payer_address, created_at DESC)`,

  // Create perkos_x402_agents table
  `CREATE TABLE IF NOT EXISTS perkos_x402_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    agent_type TEXT DEFAULT 'member',
    display_name TEXT,
    total_transactions INTEGER DEFAULT 0,
    total_volume_wei TEXT DEFAULT '0',
    total_volume_usd DECIMAL(20, 6) DEFAULT 0,
    primary_network TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
  )`,

  // Create indexes for perkos_x402_agents
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_address ON perkos_x402_agents(wallet_address)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_type ON perkos_x402_agents(agent_type)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_volume ON perkos_x402_agents(total_volume_usd DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_active ON perkos_x402_agents(last_active_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_network ON perkos_x402_agents(primary_network)`,

  // Create perkos_x402_network_stats table
  `CREATE TABLE IF NOT EXISTS perkos_x402_network_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    stats_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_count INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_volume_wei TEXT DEFAULT '0',
    total_volume_usd DECIMAL(20, 6) DEFAULT 0,
    avg_transaction_usd DECIMAL(20, 6) DEFAULT 0,
    unique_payers INTEGER DEFAULT 0,
    unique_recipients INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(network, stats_date)
  )`,

  // Create indexes for perkos_x402_network_stats
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_network_stats_network ON perkos_x402_network_stats(network)`,
  `CREATE INDEX IF NOT EXISTS idx_perkos_x402_network_stats_date ON perkos_x402_network_stats(stats_date DESC)`,
];

// Trigger functions need to be created via SQL Editor in Supabase Dashboard
// They can't be run via the Data API

export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.ADMIN_API_SECRET || "x402-admin-migration";

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    // Unfortunately, Supabase JS client doesn't support raw SQL execution
    // We need to use their REST API directly or create tables via the client

    // Instead, let's verify if tables exist and report status
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: { table: string; status: string; error?: string }[] = [];

    // Check perkos_x402_transactions
    const { error: txError } = await supabase
      .from("perkos_x402_transactions")
      .select("id")
      .limit(1);

    if (txError?.message.includes("does not exist")) {
      results.push({
        table: "perkos_x402_transactions",
        status: "missing",
        error: "Table needs to be created via SQL Editor",
      });
    } else if (txError) {
      results.push({
        table: "perkos_x402_transactions",
        status: "error",
        error: txError.message,
      });
    } else {
      results.push({ table: "perkos_x402_transactions", status: "exists" });
    }

    // Check perkos_x402_agents
    const { error: agentsError } = await supabase
      .from("perkos_x402_agents")
      .select("id")
      .limit(1);

    if (agentsError?.message.includes("does not exist")) {
      results.push({
        table: "perkos_x402_agents",
        status: "missing",
        error: "Table needs to be created via SQL Editor",
      });
    } else if (agentsError) {
      results.push({
        table: "perkos_x402_agents",
        status: "error",
        error: agentsError.message,
      });
    } else {
      results.push({ table: "perkos_x402_agents", status: "exists" });
    }

    // Check perkos_x402_network_stats
    const { error: statsError } = await supabase
      .from("perkos_x402_network_stats")
      .select("id")
      .limit(1);

    if (statsError?.message.includes("does not exist")) {
      results.push({
        table: "perkos_x402_network_stats",
        status: "missing",
        error: "Table needs to be created via SQL Editor",
      });
    } else if (statsError) {
      results.push({
        table: "perkos_x402_network_stats",
        status: "error",
        error: statsError.message,
      });
    } else {
      results.push({ table: "perkos_x402_network_stats", status: "exists" });
    }

    const allExist = results.every((r) => r.status === "exists");
    const anyMissing = results.some((r) => r.status === "missing");

    return NextResponse.json({
      success: allExist,
      migrationRequired: anyMissing,
      tables: results,
      instructions: anyMissing
        ? {
            message: "Please run the migration SQL in Supabase Dashboard",
            steps: [
              "1. Go to https://supabase.com/dashboard/project/hzwlycynnjrppwehezfi/sql/new",
              "2. Copy contents from: supabase/migrations/20250612_create_x402_transactions.sql",
              "3. Paste into SQL Editor and click Run",
            ],
            migrationFile: "supabase/migrations/20250612_create_x402_transactions.sql",
          }
        : null,
    });
  } catch (error) {
    console.error("Migration check error:", error);
    return NextResponse.json(
      { error: "Migration check failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET to check migration status
export async function GET(request: NextRequest) {
  // Redirect to POST with basic check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Quick check if main table exists
  const { error } = await supabase
    .from("perkos_x402_transactions")
    .select("id")
    .limit(1);

  if (error?.message.includes("does not exist")) {
    return NextResponse.json({
      migrationRequired: true,
      message: "Tables not found. Please run migration.",
      dashboardUrl: "https://supabase.com/dashboard/project/hzwlycynnjrppwehezfi/sql/new",
    });
  }

  return NextResponse.json({
    migrationRequired: false,
    message: "Tables exist. Migration not required.",
  });
}
