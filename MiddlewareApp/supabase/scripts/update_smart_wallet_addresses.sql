-- Script: Update sponsor wallets with smart_wallet_address
-- Description: Manually add smart wallet addresses to existing records

-- IMPORTANT: Replace the placeholder values with actual addresses from Thirdweb dashboard
-- You can find these in your Thirdweb project dashboard

-- Example update for a specific wallet:
-- UPDATE perkos_sponsor_wallets
-- SET smart_wallet_address = '0x38A9afa1aC7129368b9Eaa0C98A4ABE3D5ba3430'
-- WHERE sponsor_address = '0x8874221bE22d3464d70420F55aA05F87691E65fC';

-- Template 1: Update smart_wallet_address for a specific EOA address
-- Note: Column name is 'sponsor_address', not 'eoa_address'
UPDATE perkos_sponsor_wallets
SET
    smart_wallet_address = 'REPLACE_WITH_SMART_WALLET_ADDRESS',
    updated_at = NOW()
WHERE sponsor_address = 'REPLACE_WITH_EOA_ADDRESS';

-- Template 2: Update both addresses by user wallet address
-- Use this when you want to update both EOA and Smart Wallet addresses
UPDATE perkos_sponsor_wallets
SET
    sponsor_address = 'REPLACE_WITH_EOA_ADDRESS',
    smart_wallet_address = 'REPLACE_WITH_SMART_WALLET_ADDRESS',
    updated_at = NOW()
WHERE user_wallet_address = 'REPLACE_WITH_USER_WALLET_ADDRESS';

-- Verify the update
SELECT
    user_wallet_address,
    network,
    sponsor_address AS eoa_address,
    smart_wallet_address,
    updated_at
FROM perkos_sponsor_wallets
WHERE user_wallet_address = 'REPLACE_WITH_USER_WALLET_ADDRESS';

-- Alternative: Update by user wallet address and network
-- UPDATE perkos_sponsor_wallets
-- SET
--     smart_wallet_address = 'REPLACE_WITH_SMART_WALLET_ADDRESS',
--     updated_at = NOW()
-- WHERE user_wallet_address = 'REPLACE_WITH_USER_ADDRESS'
--   AND network = 'avalanche';

-- Verify all wallets have smart_wallet_address populated
SELECT
    COUNT(*) as total_wallets,
    COUNT(smart_wallet_address) as wallets_with_smart_address,
    COUNT(*) - COUNT(smart_wallet_address) as wallets_missing_smart_address
FROM perkos_sponsor_wallets;
