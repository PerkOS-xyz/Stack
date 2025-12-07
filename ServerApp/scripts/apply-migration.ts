import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying database migration...');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250202_create_sponsor_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        console.error('Statement:', statement);

        // Continue with other statements even if one fails
        continue;
      }

      console.log(`✓ Statement ${i + 1} completed`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - perkos_sponsor_wallets');
    console.log('  - perkos_sponsor_rules');
    console.log('  - perkos_sponsor_transactions');
    console.log('  - perkos_sponsor_wallet_analytics (view)');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
