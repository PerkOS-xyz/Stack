-- Migration: Add all missing columns to perkos_sponsor_spending table
-- Description: Add agent_address, server_domain, server_endpoint, chain_id, and network_name columns

-- Add agent_address column if it doesn't exist
ALTER TABLE perkos_sponsor_spending
ADD COLUMN IF NOT EXISTS agent_address TEXT;

-- Add server tracking columns if they don't exist
ALTER TABLE perkos_sponsor_spending
ADD COLUMN IF NOT EXISTS server_domain TEXT,
ADD COLUMN IF NOT EXISTS server_endpoint TEXT,
ADD COLUMN IF NOT EXISTS chain_id TEXT,
ADD COLUMN IF NOT EXISTS network_name TEXT;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_agent_address ON perkos_sponsor_spending(agent_address);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_server_domain ON perkos_sponsor_spending(server_domain);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_chain_id ON perkos_sponsor_spending(chain_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_network_name ON perkos_sponsor_spending(network_name);

-- Add comments for documentation
COMMENT ON COLUMN perkos_sponsor_spending.agent_address IS 'Wallet address of agent that used the sponsorship';
COMMENT ON COLUMN perkos_sponsor_spending.server_domain IS 'Vendor server domain that requested the gas sponsorship (e.g., api.vendor.com)';
COMMENT ON COLUMN perkos_sponsor_spending.server_endpoint IS 'API endpoint that was accessed (e.g., /api/v1/process)';
COMMENT ON COLUMN perkos_sponsor_spending.chain_id IS 'Blockchain chain ID (e.g., 43114 for Avalanche)';
COMMENT ON COLUMN perkos_sponsor_spending.network_name IS 'Human-readable network name (e.g., avalanche, base, celo)';
