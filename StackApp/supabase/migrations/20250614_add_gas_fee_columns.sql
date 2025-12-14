-- Migration: Add gas fee columns to perkos_x402_transactions
-- Description: Track gas fees in native chain token (wei format, stored as TEXT for BigInt support)
--
-- RUN THIS SQL IN SUPABASE SQL EDITOR:
-- =====================================

-- Add gas fee column (stored in wei, displayed in native token decimal)
ALTER TABLE perkos_x402_transactions
ADD COLUMN IF NOT EXISTS gas_fee_wei TEXT;

-- Add comments
COMMENT ON COLUMN perkos_x402_transactions.gas_fee_wei IS 'Gas fee in native token wei (e.g., AVAX for Avalanche, ETH for Base, CELO for Celo). Convert to decimal: wei / 10^18';

-- Create index for gas fee queries (optional, for filtering by gas fee)
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_gas_fee_wei ON perkos_x402_transactions(gas_fee_wei);

-- Example values:
-- Avalanche: gas_fee_wei = "1000000000000000" (0.001 AVAX)
-- Base: gas_fee_wei = "500000000000000" (0.0005 ETH)
-- Celo: gas_fee_wei = "2000000000000000" (0.002 CELO)
