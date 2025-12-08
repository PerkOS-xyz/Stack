-- Migration: Add server domain, endpoint, and chain details to sponsor_spending table
-- Description: Track vendor server domain, API endpoint, and blockchain network for analytics

-- Add new columns to perkos_sponsor_spending
ALTER TABLE perkos_sponsor_spending
ADD COLUMN IF NOT EXISTS server_domain TEXT,
ADD COLUMN IF NOT EXISTS server_endpoint TEXT,
ADD COLUMN IF NOT EXISTS chain_id TEXT,
ADD COLUMN IF NOT EXISTS network_name TEXT;

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_server_domain ON perkos_sponsor_spending(server_domain);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_chain_id ON perkos_sponsor_spending(chain_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_network_name ON perkos_sponsor_spending(network_name);

-- Add comments
COMMENT ON COLUMN perkos_sponsor_spending.server_domain IS 'Vendor server domain that requested the gas sponsorship (e.g., api.vendor.com)';
COMMENT ON COLUMN perkos_sponsor_spending.server_endpoint IS 'API endpoint that was accessed (e.g., /api/v1/process)';
COMMENT ON COLUMN perkos_sponsor_spending.chain_id IS 'Blockchain chain ID (e.g., 43114 for Avalanche)';
COMMENT ON COLUMN perkos_sponsor_spending.network_name IS 'Human-readable network name (e.g., avalanche, base, celo)';
