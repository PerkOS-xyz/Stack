-- Script: Check sponsor wallets table structure and data
-- Description: View current sponsor wallets with both EOA and Smart Wallet addresses

-- 1. Check table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'perkos_sponsor_wallets'
ORDER BY ordinal_position;

-- 2. View all sponsor wallets
SELECT
    id,
    user_wallet_address,
    network,
    turnkey_wallet_id,
    sponsor_address AS eoa_address,
    smart_wallet_address,
    balance,
    enabled,
    created_at,
    updated_at
FROM perkos_sponsor_wallets
ORDER BY created_at DESC;

-- 3. Count wallets by status
SELECT
    COUNT(*) as total_wallets,
    COUNT(CASE WHEN smart_wallet_address IS NOT NULL THEN 1 END) as wallets_with_smart_address,
    COUNT(CASE WHEN smart_wallet_address IS NULL THEN 1 END) as wallets_without_smart_address
FROM perkos_sponsor_wallets;

-- 4. View wallets grouped by user
SELECT
    user_wallet_address,
    COUNT(*) as wallet_count,
    array_agg(network) as networks,
    array_agg(sponsor_address) as eoa_addresses,
    array_agg(smart_wallet_address) as smart_wallet_addresses
FROM perkos_sponsor_wallets
GROUP BY user_wallet_address
ORDER BY wallet_count DESC;
