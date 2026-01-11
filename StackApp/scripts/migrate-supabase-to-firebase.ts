/**
 * Data Migration Script: Supabase to Firebase/Firestore
 *
 * This script migrates all data from Supabase PostgreSQL to Firebase Firestore.
 *
 * Usage:
 *   npx tsx scripts/migrate-supabase-to-firebase.ts
 *
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (admin access)
 *   - FIREBASE_SERVICE_ACCOUNT: Firebase service account JSON (stringified)
 *   - NEXT_PUBLIC_FIREBASE_PROJECT_ID: Firebase project ID
 *
 * Tables Migrated:
 *   1. perkos_sponsor_wallets
 *   2. perkos_sponsor_rules
 *   3. perkos_sponsor_transactions
 *   4. perkos_sponsor_spending
 *   5. perkos_x402_transactions
 *   6. perkos_x402_agents
 *   7. perkos_x402_network_stats
 *   8. perkos_user_profiles
 *   9. perkos_vendors
 */

import { createClient } from "@supabase/supabase-js";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore, Timestamp } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const BATCH_SIZE = 500; // Firestore batch write limit
const DRY_RUN = process.argv.includes("--dry-run");
const TABLES_TO_MIGRATE = [
  "perkos_sponsor_wallets",
  "perkos_sponsor_rules",
  "perkos_sponsor_transactions",
  "perkos_sponsor_spending",
  "perkos_x402_transactions",
  "perkos_x402_agents",
  "perkos_x402_network_stats",
  "perkos_user_profiles",
  "perkos_vendors",
];

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Initialize Firebase Admin
let firebaseApp: App;
let firestore: Firestore;

function initializeFirebase(): void {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccount && !projectId) {
    console.error("❌ Missing Firebase credentials in environment variables");
    console.error("   Required: FIREBASE_SERVICE_ACCOUNT or NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    process.exit(1);
  }

  if (getApps().length === 0) {
    if (serviceAccount) {
      firebaseApp = initializeApp({
        credential: cert(JSON.parse(serviceAccount)),
      });
    } else {
      // Use application default credentials
      firebaseApp = initializeApp({
        projectId,
      });
    }
  } else {
    firebaseApp = getApps()[0];
  }

  firestore = getFirestore(firebaseApp);
  console.log("✅ Firebase Admin initialized");
}

// Convert Supabase timestamps to Firestore Timestamps
function convertTimestamp(value: string | null | undefined): Timestamp | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    return Timestamp.fromDate(date);
  } catch {
    return null;
  }
}

// Transform record for Firestore (handle special types)
function transformRecord(record: Record<string, unknown>, tableName: string): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    // Convert timestamp fields
    if (key.endsWith("_at") || key === "stats_date") {
      transformed[key] = convertTimestamp(value as string);
    }
    // Keep null values as null
    else if (value === null) {
      transformed[key] = null;
    }
    // Handle BigInt-like strings (wei values)
    else if (typeof value === "string" && key.includes("_wei")) {
      transformed[key] = value; // Keep as string for BigInt compatibility
    }
    // Handle numeric strings
    else if (typeof value === "string" && !isNaN(Number(value)) && key.includes("balance")) {
      transformed[key] = value; // Keep balance as string
    }
    // Default: copy value as-is
    else {
      transformed[key] = value;
    }
  }

  // Add migration metadata
  transformed._migrated_from = "supabase";
  transformed._migrated_at = Timestamp.now();

  return transformed;
}

// Fetch all records from a Supabase table
async function fetchSupabaseTable(tableName: string): Promise<Record<string, unknown>[]> {
  console.log(`\n📥 Fetching from ${tableName}...`);

  let allRecords: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(offset, offset + pageSize - 1);

    if (error) {
      if (error.code === "PGRST116" || error.message.includes("does not exist")) {
        console.log(`   ⚠️ Table ${tableName} does not exist, skipping...`);
        return [];
      }
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRecords = allRecords.concat(data);
      offset += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    }
  }

  console.log(`   Found ${allRecords.length} records`);
  return allRecords;
}

// Write records to Firestore in batches
async function writeToFirestore(
  collectionName: string,
  records: Record<string, unknown>[]
): Promise<number> {
  if (records.length === 0) {
    console.log(`   No records to migrate for ${collectionName}`);
    return 0;
  }

  console.log(`📤 Writing ${records.length} records to Firestore collection: ${collectionName}...`);

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would write ${records.length} records`);
    return records.length;
  }

  let written = 0;
  const collection = firestore.collection(collectionName);

  // Process in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = firestore.batch();
    const batchRecords = records.slice(i, i + BATCH_SIZE);

    for (const record of batchRecords) {
      // Use existing ID if available, otherwise auto-generate
      const docId = (record.id as string) || collection.doc().id;
      const docRef = collection.doc(docId);
      const transformedRecord = transformRecord(record, collectionName);
      batch.set(docRef, transformedRecord);
    }

    await batch.commit();
    written += batchRecords.length;
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: wrote ${batchRecords.length} records (total: ${written})`);
  }

  return written;
}

// Migrate a single table
async function migrateTable(tableName: string): Promise<{ table: string; records: number; success: boolean; error?: string }> {
  try {
    const records = await fetchSupabaseTable(tableName);
    const written = await writeToFirestore(tableName, records);
    return { table: tableName, records: written, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error migrating ${tableName}: ${message}`);
    return { table: tableName, records: 0, success: false, error: message };
  }
}

// Verify migration by counting documents
async function verifyMigration(tableName: string): Promise<number> {
  const snapshot = await firestore.collection(tableName).count().get();
  return snapshot.data().count;
}

// Main migration function
async function runMigration(): Promise<void> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   Supabase to Firebase Migration Script");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no data will be written)" : "LIVE MIGRATION"}`);
  console.log(`Tables to migrate: ${TABLES_TO_MIGRATE.length}`);
  console.log("");

  // Initialize Firebase
  initializeFirebase();

  // Test Supabase connection
  console.log("Testing Supabase connection...");
  const { error: testError } = await supabase.from("perkos_x402_transactions").select("id").limit(1);
  if (testError && !testError.message.includes("does not exist")) {
    console.error("❌ Failed to connect to Supabase:", testError.message);
    process.exit(1);
  }
  console.log("✅ Supabase connection successful\n");

  // Run migration for each table
  const results: { table: string; records: number; success: boolean; error?: string }[] = [];

  for (const tableName of TABLES_TO_MIGRATE) {
    const result = await migrateTable(tableName);
    results.push(result);
  }

  // Print summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("   Migration Summary");
  console.log("═══════════════════════════════════════════════════════════════");

  let totalRecords = 0;
  let successCount = 0;
  let failCount = 0;

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    const errorMsg = result.error ? ` (${result.error})` : "";
    console.log(`${status} ${result.table}: ${result.records} records${errorMsg}`);
    totalRecords += result.records;
    if (result.success) successCount++;
    else failCount++;
  }

  console.log("");
  console.log(`Total records migrated: ${totalRecords}`);
  console.log(`Tables successful: ${successCount}/${TABLES_TO_MIGRATE.length}`);
  console.log(`Tables failed: ${failCount}/${TABLES_TO_MIGRATE.length}`);

  // Verify migration (skip if dry run)
  if (!DRY_RUN && successCount > 0) {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("   Verification");
    console.log("═══════════════════════════════════════════════════════════════");

    for (const result of results) {
      if (result.success && result.records > 0) {
        const count = await verifyMigration(result.table);
        const match = count >= result.records ? "✅" : "⚠️";
        console.log(`${match} ${result.table}: ${count} documents in Firestore`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  if (failCount > 0) {
    console.log("⚠️ Migration completed with errors. Please review failed tables.");
    process.exit(1);
  } else {
    console.log("✅ Migration completed successfully!");
  }
}

// Run the migration
runMigration().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
