/**
 * Insert test transaction data after migration is run
 * Usage: npx tsx supabase/scripts/insert-test-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function insertTestData() {
  console.log("Checking if tables exist...\n");

  // Check if table exists
  const { error: checkError } = await supabase
    .from("perkos_x402_transactions")
    .select("id")
    .limit(1);

  if (checkError?.message.includes("does not exist") || checkError?.message.includes("schema cache")) {
    console.log("❌ Tables do not exist yet!");
    console.log("\n📋 Please run the migration first:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("1. Go to: https://supabase.com/dashboard/project/hzwlycynnjrppwehezfi/sql/new");
    console.log("2. Copy contents from: supabase/migrations/20250612_create_x402_transactions.sql");
    console.log("3. Paste into SQL editor and click 'Run'");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    process.exit(1);
  }

  console.log("✓ Tables exist. Inserting test data...\n");

  // Insert test transaction (simulating the successful payment from earlier)
  const testTransactions = [
    {
      transaction_hash: "0xaab3cb09461397e21f93160a63770721f8d1d1531bd06e3475f72fb91f5133e3",
      payer_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f5A402",
      recipient_address: "0x9c62C51D3F19EA4C5E6D0F8f4E8f1F7E9A3d5B2C",
      sponsor_address: "0xE73B5bD67D12BA8A5a9e32893f91c3D16F7f8e92",
      amount_wei: "1000000", // 1 USDC (6 decimals)
      amount_usd: 1.0,
      asset_address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      asset_symbol: "USDC",
      network: "avalanche",
      chain_id: 43114,
      scheme: "exact",
      vendor_domain: "vendor-places-api.example.com",
      status: "success",
    },
    {
      transaction_hash: "0xtest123456789abcdef0123456789abcdef0123456789abcdef0123456789ab",
      payer_address: "0x123456789abcdef0123456789abcdef01234567",
      recipient_address: "0x9c62C51D3F19EA4C5E6D0F8f4E8f1F7E9A3d5B2C",
      sponsor_address: "0xE73B5bD67D12BA8A5a9e32893f91c3D16F7f8e92",
      amount_wei: "5000000", // 5 USDC
      amount_usd: 5.0,
      asset_address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      asset_symbol: "USDC",
      network: "avalanche",
      chain_id: 43114,
      scheme: "exact",
      vendor_domain: "api.places.example.com",
      status: "success",
    },
  ];

  for (const tx of testTransactions) {
    const { data, error } = await supabase
      .from("perkos_x402_transactions")
      .upsert(tx, { onConflict: "transaction_hash" })
      .select();

    if (error) {
      console.log(`❌ Error inserting transaction ${tx.transaction_hash.slice(0, 10)}...: ${error.message}`);
    } else {
      console.log(`✓ Inserted/updated transaction: ${tx.transaction_hash.slice(0, 10)}...`);
    }
  }

  // Verify data
  console.log("\n📊 Verifying inserted data...\n");

  const { data: txData, count: txCount } = await supabase
    .from("perkos_x402_transactions")
    .select("*", { count: "exact" });

  console.log(`Total transactions: ${txCount}`);

  const { data: agentData, count: agentCount } = await supabase
    .from("perkos_x402_agents")
    .select("*", { count: "exact" });

  console.log(`Total agents: ${agentCount}`);

  const { data: statsData, count: statsCount } = await supabase
    .from("perkos_x402_network_stats")
    .select("*", { count: "exact" });

  console.log(`Network stats entries: ${statsCount}`);

  console.log("\n✅ Test data inserted successfully!");
  console.log("You can now check the dashboard at http://localhost:3001/transactions");
}

insertTestData().catch(console.error);
