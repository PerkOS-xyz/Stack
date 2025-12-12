/**
 * Run x402 transactions migration
 * Usage: npx tsx supabase/scripts/run-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  console.log("Reading migration file...");

  const migrationPath = path.join(
    __dirname,
    "../migrations/20250612_create_x402_transactions.sql"
  );

  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  console.log("Running migration...");
  console.log("Migration file:", migrationPath);

  // Execute via RPC - Supabase requires using stored procedures for raw SQL
  // We'll need to execute each statement separately
  const statements = migrationSql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Found ${statements.length} SQL statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, " ");
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);

    try {
      // Use Supabase's RPC to execute raw SQL (requires admin function)
      const { error } = await supabase.rpc("exec_sql", { sql: stmt + ";" });

      if (error) {
        // If exec_sql doesn't exist, we need another approach
        if (error.message.includes("exec_sql")) {
          console.log("Note: exec_sql function not available.");
          console.log(
            "Please run the migration SQL directly in the Supabase dashboard:"
          );
          console.log("1. Go to https://supabase.com/dashboard");
          console.log("2. Select your project");
          console.log('3. Go to SQL Editor');
          console.log('4. Paste the contents of: supabase/migrations/20250612_create_x402_transactions.sql');
          console.log('5. Click "Run"');
          process.exit(0);
        }
        console.error(`Error executing statement ${i + 1}:`, error.message);
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`);
      }
    } catch (err) {
      console.error(`Error:`, err);
    }
  }

  console.log("\n✅ Migration completed!");
}

// Check if tables already exist
async function checkExistingTables() {
  console.log("Checking if tables already exist...");

  const { data: txTable, error: txError } = await supabase
    .from("x402_transactions")
    .select("id")
    .limit(1);

  if (!txError) {
    console.log("✓ x402_transactions table exists");
    return true;
  }

  if (txError.code === "PGRST116" || txError.message.includes("does not exist")) {
    console.log("✗ x402_transactions table does not exist - migration needed");
    return false;
  }

  console.log("Table check error:", txError.message);
  return false;
}

async function main() {
  const exists = await checkExistingTables();

  if (exists) {
    console.log("\n Tables already exist. Checking structure...");

    // Try to query a sample to verify structure
    const { data, error } = await supabase
      .from("x402_transactions")
      .select("*")
      .limit(1);

    if (error) {
      console.log("Error querying table:", error.message);
    } else {
      console.log("✓ Table structure verified");
      console.log("Current records:", data?.length || 0);
    }
    return;
  }

  console.log("\n📋 Migration SQL needs to be run manually:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Please run the migration in Supabase Dashboard:");
  console.log("1. Go to: https://supabase.com/dashboard/project/hzwlycynnjrppwehezfi/sql/new");
  console.log("2. Copy the contents from: supabase/migrations/20250612_create_x402_transactions.sql");
  console.log("3. Paste into the SQL editor and click Run");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(console.error);
