-- Migration: Add smart_wallet_address column to perkos_sponsor_wallets
-- Description: Store both EOA and Smart Wallet addresses from Thirdweb

-- Add smart_wallet_address column (nullable for backwards compatibility)
ALTER TABLE perkos_sponsor_wallets
ADD COLUMN IF NOT EXISTS smart_wallet_address TEXT;

-- Add index for smart wallet address lookups
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_smart_address ON perkos_sponsor_wallets(smart_wallet_address);

-- Add comment explaining the columns
COMMENT ON COLUMN perkos_sponsor_wallets.sponsor_address IS 'EOA (Externally Owned Account) address from Thirdweb - used for signing transactions';
COMMENT ON COLUMN perkos_sponsor_wallets.smart_wallet_address IS 'Smart Wallet address from Thirdweb - used for Account Abstraction and gasless transactions';
