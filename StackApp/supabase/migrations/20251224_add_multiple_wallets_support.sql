-- Migration: Add support for multiple sponsor wallets per user
-- Description: Allows users to create multiple sponsor wallets with names and public/private visibility

-- 1. Drop the unique constraint on user_wallet_address to allow multiple wallets per user
ALTER TABLE perkos_sponsor_wallets
DROP CONSTRAINT IF EXISTS perkos_sponsor_wallets_user_wallet_unique;

-- 2. Add wallet_name column for user-defined wallet identification
ALTER TABLE perkos_sponsor_wallets
ADD COLUMN IF NOT EXISTS wallet_name TEXT;

-- 3. Add is_public column for visibility control (default private)
ALTER TABLE perkos_sponsor_wallets
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- 4. Set default name for existing wallets that don't have one
UPDATE perkos_sponsor_wallets
SET wallet_name = 'Default Wallet'
WHERE wallet_name IS NULL;

-- 5. Add index for efficient querying by user with sorting by created_at
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_user_created
ON perkos_sponsor_wallets(user_wallet_address, created_at DESC);

-- 6. Add index for public wallets lookup
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_public
ON perkos_sponsor_wallets(is_public)
WHERE is_public = true;

-- 7. Create RLS policy for viewing public wallets (anyone can view public wallets)
DROP POLICY IF EXISTS sponsor_wallets_public_view_policy ON perkos_sponsor_wallets;
CREATE POLICY sponsor_wallets_public_view_policy ON perkos_sponsor_wallets
    FOR SELECT
    USING (
        is_public = true
        OR user_wallet_address = current_setting('app.user_wallet_address', true)::TEXT
    );

-- 8. Update the wallet analytics view to include new columns
-- Note: Only uses columns that exist in the current schema
DROP VIEW IF EXISTS perkos_sponsor_wallet_analytics;

-- Create a simpler view with only existing columns
CREATE OR REPLACE VIEW perkos_sponsor_wallet_analytics AS
SELECT
    w.id AS wallet_id,
    w.user_wallet_address,
    w.wallet_name,
    w.is_public,
    w.network,
    w.sponsor_address,
    w.balance,
    w.created_at,
    0::BIGINT AS total_transactions,
    0::BIGINT AS successful_transactions,
    0::BIGINT AS failed_transactions,
    '0'::TEXT AS total_spent,
    '0'::TEXT AS avg_transaction_cost,
    0::BIGINT AS unique_domains,
    0::BIGINT AS unique_agents
FROM perkos_sponsor_wallets w;

GRANT SELECT ON perkos_sponsor_wallet_analytics TO authenticated;

-- 9. Add comment explaining the new columns
COMMENT ON COLUMN perkos_sponsor_wallets.wallet_name IS 'User-defined name/tag for the wallet to help identify its purpose';
COMMENT ON COLUMN perkos_sponsor_wallets.is_public IS 'Whether this wallet is publicly visible in the community directory';

-- 10. Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'perkos_sponsor_wallets'
ORDER BY ordinal_position;
