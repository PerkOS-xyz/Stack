-- Migration: Make sponsor wallets network-agnostic
-- Description: Remove per-network constraint since Thirdweb wallets work across all EVM chains

-- 1. Drop the unique constraint on (user_wallet_address, network)
ALTER TABLE perkos_sponsor_wallets
DROP CONSTRAINT IF EXISTS perkos_sponsor_wallets_user_wallet_address_network_key;

-- 2. Add unique constraint on user_wallet_address only (one wallet per user)
ALTER TABLE perkos_sponsor_wallets
ADD CONSTRAINT perkos_sponsor_wallets_user_wallet_unique
UNIQUE (user_wallet_address);

-- 3. Update network column to be 'evm' for all existing wallets
UPDATE perkos_sponsor_wallets
SET network = 'evm'
WHERE network IN ('avalanche', 'avalanche-fuji', 'base', 'base-sepolia', 'celo', 'celo-alfajores');

-- 4. Update network check constraint to allow 'evm' and future 'solana' values
ALTER TABLE perkos_sponsor_wallets
DROP CONSTRAINT IF EXISTS perkos_sponsor_wallets_network_check;

ALTER TABLE perkos_sponsor_wallets
ADD CONSTRAINT perkos_sponsor_wallets_network_check
CHECK (network IN (
    -- Multi-chain network identifiers
    'evm',                    -- All EVM-compatible chains
    'solana',                 -- Solana ecosystem (future)
    -- Legacy specific chain identifiers (backwards compatibility)
    'avalanche', 'avalanche-fuji',
    'base', 'base-sepolia',
    'celo', 'celo-alfajores'
));

-- 5. Add comment explaining the network column
COMMENT ON COLUMN perkos_sponsor_wallets.network IS 'Network identifier - use "evm" for all EVM chains (recommended), "solana" for Solana (future), or specific chain for backwards compatibility';

-- 6. Verify the changes
SELECT
    COUNT(*) as total_wallets,
    COUNT(DISTINCT user_wallet_address) as unique_users,
    array_agg(DISTINCT network) as networks_in_use
FROM perkos_sponsor_wallets;
