# Supabase Setup Guide for PerkOS x402

Complete guide to set up Supabase database for production deployment with real-time event tracking and analytics.

## Prerequisites

- Supabase account (free tier is sufficient to start)
- Node.js 18+ installed
- Access to your blockchain RPC endpoints

## Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: `perkos-x402` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose closest to your users
   - **Plan**: Start with Free tier
4. Click "Create new project"
5. Wait for project to be ready (~2 minutes)

## Step 2: Set Up Database Schema

### Option A: Using Supabase SQL Editor (Recommended)

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `/ServerApp/lib/db/schema.sql`
4. Paste into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. Wait for execution to complete (~30 seconds)
7. Verify tables were created:
   - Go to **Table Editor**
   - You should see: `transactions`, `vouchers`, `agents`, `reviews`, `network_stats`

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push --db-url YOUR_DATABASE_URL
```

## Step 3: Get API Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGc...
service_role key: eyJhbGc... (⚠️ Keep this secret!)
```

## Step 4: Configure Environment Variables

1. Create `.env.local` file in `/ServerApp/` directory:

```bash
cd ServerApp
cp .env.example .env.local
```

2. Add your Supabase credentials:

```env
# ============ Supabase Configuration ============
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key...

# Event Indexing Configuration
ENABLE_EVENT_INDEXING=true
EVENT_INDEXING_START_BLOCK=latest
EVENT_INDEXING_INTERVAL=12000
```

3. Add your network RPC URLs (if not already set):

```env
# Avalanche
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
NEXT_PUBLIC_AVALANCHE_PAYMENT_TOKEN=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E

# Base
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_PAYMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Facilitator
NEXT_PUBLIC_X402_PAYMENT_RECEIVER=0xYourFacilitatorAddress
PRIVATE_KEY=0xYourPrivateKey
```

## Step 5: Verify Database Connection

Test that your application can connect to Supabase:

```bash
npm run dev
```

Then visit: http://localhost:3402/api/dashboard/stats

You should see:
- Empty data (all zeros) if no transactions yet
- No errors in console

## Step 6: Enable Row Level Security (RLS)

The schema already includes RLS policies, but verify they're active:

1. Go to **Authentication** → **Policies**
2. Check that policies exist for all tables:
   - `transactions`: Public read, Service role write
   - `vouchers`: Public read, Service role write
   - `agents`: Public read, Service role write
   - `reviews`: Anyone can insert
   - `network_stats`: Public read

## Step 7: Start Event Indexing

The event indexer will automatically start when you run the application:

```bash
# Production mode
npm run build
npm start

# Development mode
npm run dev
```

Check logs for:
```
🚀 Starting event indexer...
📡 Starting indexer for avalanche (Chain ID: 43114)
📡 Starting indexer for base (Chain ID: 8453)
```

## Step 8: Manual Data Population (Optional)

For testing, you can manually insert sample data:

```sql
-- Insert sample transaction
INSERT INTO transactions (hash, network, chain_id, scheme, payer, payee, amount, asset, status, block_number)
VALUES (
  '0x1234567890abcdef',
  'avalanche',
  43114,
  'exact',
  '0xBuyerAddress',
  '0xSellerAddress',
  '1000000',  -- 1 USDC (6 decimals)
  '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  'settled',
  12345678
);

-- Aggregate network stats (run this daily or via cron)
SELECT aggregate_network_stats(CURRENT_DATE, 'avalanche');
SELECT aggregate_network_stats(CURRENT_DATE, 'base');
```

## Step 9: Set Up Automated Statistics Aggregation

### Option A: Using Supabase Edge Functions (Recommended)

1. Create a new Edge Function:

```typescript
// supabase/functions/aggregate-stats/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today = new Date().toISOString().split('T')[0]
  const networks = ['avalanche', 'base', 'avalanche-fuji', 'base-sepolia']

  for (const network of networks) {
    await supabase.rpc('aggregate_network_stats', {
      target_date: today,
      target_network: network
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

2. Deploy the function:

```bash
supabase functions deploy aggregate-stats
```

3. Set up a cron job in Supabase:

```sql
-- Run daily at midnight UTC
SELECT cron.schedule('aggregate-daily-stats', '0 0 * * *', 'http://YOUR_PROJECT_REF.functions.supabase.co/aggregate-stats');
```

### Option B: Using External Cron Service

Set up a daily cron job (GitHub Actions, cron-job.org, etc.) to call:

```bash
curl -X POST https://your-domain.com/api/cron/aggregate-stats \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

## Step 10: Monitor Database Performance

### Enable Query Insights

1. Go to **Database** → **Query Performance**
2. Review slow queries and add indexes if needed

### Set Up Alerts

1. Go to **Database** → **Alerts**
2. Create alerts for:
   - High CPU usage (> 80%)
   - Storage usage (> 80%)
   - Long-running queries (> 5s)

## Step 11: Backup Strategy

### Automatic Backups (Paid Plans)

Supabase Pro includes automatic daily backups. Enable in:
**Settings** → **Database** → **Backups**

### Manual Backups (Free Tier)

```bash
# Export database schema
pg_dump -h db.xxxxx.supabase.co -U postgres -s -d postgres > schema_backup.sql

# Export data
pg_dump -h db.xxxxx.supabase.co -U postgres -a -d postgres > data_backup.sql
```

## Troubleshooting

### Issue: "Missing env.NEXT_PUBLIC_SUPABASE_URL"

**Solution**: Ensure `.env.local` exists and contains Supabase credentials. Restart dev server.

### Issue: Event indexer not starting

**Solution**:
1. Check `ENABLE_EVENT_INDEXING=true` in `.env.local`
2. Verify RPC URLs are correct
3. Check console logs for errors

### Issue: "relation does not exist" errors

**Solution**: Re-run the schema.sql file - tables weren't created properly.

### Issue: RLS policies blocking writes

**Solution**: Use `SUPABASE_SERVICE_ROLE_KEY` for server-side writes (already configured in event indexer).

### Issue: High database CPU usage

**Solution**:
1. Add indexes on frequently queried columns
2. Optimize queries using EXPLAIN ANALYZE
3. Consider upgrading to Supabase Pro

## Next Steps

1. ✅ **Deploy to Production**
   - Set environment variables in Vercel/hosting platform
   - Enable HTTPS (required for blockchain interactions)
   - Configure CORS for API endpoints

2. ✅ **Monitor Performance**
   - Set up error tracking (Sentry, LogRocket)
   - Monitor database query performance
   - Track API response times

3. ✅ **Scale as Needed**
   - Upgrade to Supabase Pro when you reach free tier limits
   - Add read replicas for high traffic
   - Implement caching layer (Redis) for frequently accessed data

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Support

For issues specific to this setup:
- Check logs: `npm run dev` and look for Supabase errors
- Verify Supabase project status: https://status.supabase.com
- Community support: Discord or GitHub Issues

---

**Last Updated**: December 2024
**Maintained By**: PerkOS x402 Team
