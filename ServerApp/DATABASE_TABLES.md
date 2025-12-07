# PerkOS x402 Database Tables Reference

All database tables use the `perkos_` prefix to avoid naming conflicts when deploying to shared production databases.

## Table Names

### Core Tables
- `perkos_transactions` - All payment transactions (exact + deferred)
- `perkos_vouchers` - Deferred payment vouchers
- `perkos_agents` - Agent reputation and metadata
- `perkos_reviews` - Community reviews and ratings
- `perkos_network_stats` - Daily aggregated network statistics

## Table Schemas

### perkos_transactions
```sql
CREATE TABLE perkos_transactions (
    id UUID PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    scheme TEXT NOT NULL, -- 'exact' or 'deferred'
    payer TEXT NOT NULL,
    payee TEXT NOT NULL,
    amount TEXT NOT NULL,
    asset TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'verified', 'settled', 'failed'
    error_message TEXT,
    block_number BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### perkos_vouchers
```sql
CREATE TABLE perkos_vouchers (
    id UUID PRIMARY KEY,
    voucher_id TEXT NOT NULL UNIQUE,
    buyer TEXT NOT NULL,
    seller TEXT NOT NULL,
    value_aggregate TEXT NOT NULL,
    asset TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    nonce TEXT NOT NULL,
    escrow TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    settled_tx_hash TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### perkos_agents
```sql
CREATE TABLE perkos_agents (
    id UUID PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    url TEXT,
    capabilities TEXT[],
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    average_rating DECIMAL(3,2) DEFAULT 0,
    last_transaction_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### perkos_reviews
```sql
CREATE TABLE perkos_reviews (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES perkos_agents(id),
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL, -- 0-100
    comment TEXT,
    transaction_hash TEXT,
    tags TEXT[],
    created_at TIMESTAMP
);
```

### perkos_network_stats
```sql
CREATE TABLE perkos_network_stats (
    id UUID PRIMARY KEY,
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_transactions INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    unique_users INTEGER DEFAULT 0,
    average_tx_value TEXT DEFAULT '0',
    created_at TIMESTAMP,
    UNIQUE(network, date)
);
```

## Indexes

All tables have optimized indexes for common query patterns:

### perkos_transactions
- `idx_transactions_hash` - ON hash
- `idx_transactions_network` - ON network
- `idx_transactions_payer` - ON payer
- `idx_transactions_payee` - ON payee
- `idx_transactions_status` - ON status
- `idx_transactions_created_at` - ON created_at DESC
- `idx_transactions_network_created` - ON (network, created_at DESC)

### perkos_vouchers
- `idx_vouchers_buyer` - ON buyer
- `idx_vouchers_seller` - ON seller
- `idx_vouchers_settled` - ON settled
- `idx_vouchers_created_at` - ON created_at DESC

### perkos_agents
- `idx_agents_address` - ON address
- `idx_agents_total_transactions` - ON total_transactions DESC
- `idx_agents_average_rating` - ON average_rating DESC

### perkos_reviews
- `idx_reviews_agent_id` - ON agent_id
- `idx_reviews_reviewer` - ON reviewer_address
- `idx_reviews_created_at` - ON created_at DESC

### perkos_network_stats
- `idx_network_stats_network` - ON network
- `idx_network_stats_date` - ON date DESC
- `idx_network_stats_network_date` - ON (network, date DESC)

## Usage in Code

### TypeScript/JavaScript (Supabase Client)

```typescript
import { supabase } from '@/lib/db/supabase';

// Query transactions
const { data, error } = await supabase
  .from('perkos_transactions')
  .select('*')
  .eq('status', 'settled')
  .order('created_at', { ascending: false });

// Insert new transaction
const { error } = await supabase
  .from('perkos_transactions')
  .insert({
    hash: '0x...',
    network: 'avalanche',
    chain_id: 43114,
    scheme: 'exact',
    payer: '0x...',
    payee: '0x...',
    amount: '1000000',
    asset: '0x...',
    status: 'settled'
  });
```

### SQL Queries

```sql
-- Get recent transactions
SELECT hash, network, amount, scheme, created_at
FROM perkos_transactions
WHERE status = 'settled'
ORDER BY created_at DESC
LIMIT 10;

-- Get agent reputation
SELECT address, total_transactions, average_rating
FROM perkos_agents
ORDER BY total_transactions DESC
LIMIT 10;

-- Get network stats for last 7 days
SELECT network, SUM(total_transactions) as total_tx
FROM perkos_network_stats
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY network;
```

## PostgreSQL Functions

### update_agent_stats(agent_address TEXT)
Updates agent statistics based on their transaction history:
```sql
SELECT update_agent_stats('0xAgentAddress');
```

### aggregate_network_stats(target_date DATE, target_network TEXT)
Aggregates daily network statistics:
```sql
SELECT aggregate_network_stats(CURRENT_DATE, 'avalanche');
SELECT aggregate_network_stats(CURRENT_DATE, 'base');
```

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### Public Read Access
- All users can SELECT from all tables

### Service Role Write Access
- Only service role can INSERT/UPDATE on:
  - `perkos_transactions`
  - `perkos_vouchers`
  - `perkos_agents`

### Public Write Access
- Anyone can INSERT reviews to `perkos_reviews`

## Migration Notes

### From Unprefixed Tables
If migrating from an existing setup without prefixes:

```sql
-- Rename existing tables
ALTER TABLE transactions RENAME TO perkos_transactions;
ALTER TABLE vouchers RENAME TO perkos_vouchers;
ALTER TABLE agents RENAME TO perkos_agents;
ALTER TABLE reviews RENAME TO perkos_reviews;
ALTER TABLE network_stats RENAME TO perkos_network_stats;

-- Update indexes (recreate with new names)
-- Update triggers and functions (use new table names)
```

### Shared Database Deployment
The `perkos_` prefix allows you to:
- Deploy alongside other applications
- Avoid naming conflicts
- Maintain clear ownership of tables
- Easier to identify tables in shared environments

## Database Size Estimates

### Expected Growth (per 1000 transactions/day)

| Table | Storage/Day | Storage/Month | Storage/Year |
|-------|-------------|---------------|--------------|
| perkos_transactions | ~500 KB | ~15 MB | ~180 MB |
| perkos_vouchers | ~200 KB | ~6 MB | ~72 MB |
| perkos_agents | ~10 KB | ~300 KB | ~3.6 MB |
| perkos_reviews | ~50 KB | ~1.5 MB | ~18 MB |
| perkos_network_stats | ~5 KB | ~150 KB | ~1.8 MB |
| **Total** | **~765 KB** | **~23 MB** | **~275 MB** |

### Supabase Free Tier Limits
- **Database Size**: 500 MB
- **Bandwidth**: 2 GB/month
- **Suitable for**: ~60,000 transactions/month

---

**Last Updated**: December 2024
**Schema Version**: 1.0.0 with `perkos_` prefix
