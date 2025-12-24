-- ENS Name Cache Table
-- Stores resolved ENS names to avoid repeated RPC calls

CREATE TABLE IF NOT EXISTS perkos_ens_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  ens_name TEXT, -- NULL if no ENS name exists
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by wallet address
CREATE INDEX IF NOT EXISTS idx_perkos_ens_cache_wallet ON perkos_ens_cache(wallet_address);

-- Index for finding expired entries
CREATE INDEX IF NOT EXISTS idx_perkos_ens_cache_expires ON perkos_ens_cache(expires_at);

-- Enable RLS
ALTER TABLE perkos_ens_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (ENS names are public info)
CREATE POLICY "Allow public read access" ON perkos_ens_cache
  FOR SELECT USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to manage" ON perkos_ens_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ens_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_ens_cache_updated_at ON perkos_ens_cache;
CREATE TRIGGER trigger_update_ens_cache_updated_at
  BEFORE UPDATE ON perkos_ens_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_ens_cache_updated_at();
