-- Add encrypted_private_key column to perkos_sponsor_wallets table

ALTER TABLE perkos_sponsor_wallets
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Add comment explaining the encryption
COMMENT ON COLUMN perkos_sponsor_wallets.encrypted_private_key IS 'AES-256-GCM encrypted private key. Format: iv:authTag:encrypted';
