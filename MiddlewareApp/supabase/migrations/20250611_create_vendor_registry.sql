-- ============================================
-- Vendor Registry Migration
-- Enables auto-discovery and registration of X402 vendor services
-- ============================================

-- ============================================
-- Vendors Table
-- Stores registered vendor services with their X402 endpoints
-- ============================================
CREATE TABLE IF NOT EXISTS perkos_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Info
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,

    -- X402 Discovery
    discovery_url TEXT NOT NULL,  -- /.well-known/x402 endpoint
    wallet_address TEXT NOT NULL,

    -- Network Configuration
    network TEXT NOT NULL,
    chain_id INTEGER,

    -- Service Details (from discovery)
    price_usd TEXT,
    asset TEXT DEFAULT 'USDC',
    facilitator_url TEXT,

    -- Categorization
    category TEXT DEFAULT 'other' CHECK (category IN ('api', 'nft', 'defi', 'gaming', 'dao', 'ai', 'data', 'other')),
    tags TEXT[] DEFAULT '{}',

    -- Status & Verification
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended', 'failed')),
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'failed')),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,

    -- Stats (populated from transactions)
    total_transactions INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    average_rating DECIMAL(3,2) DEFAULT 0,

    -- Metadata
    icon_url TEXT,
    website_url TEXT,
    docs_url TEXT,

    -- Discovery metadata (raw JSON from /.well-known/x402)
    discovery_metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(url),
    UNIQUE(discovery_url)
);

-- Indexes for vendor queries
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_url ON perkos_vendors(url);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_wallet ON perkos_vendors(wallet_address);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_network ON perkos_vendors(network);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_status ON perkos_vendors(status);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_category ON perkos_vendors(category);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_created_at ON perkos_vendors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perkos_vendors_verification ON perkos_vendors(verification_status);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON perkos_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Vendor Endpoints Table
-- Stores individual API endpoints for each vendor
-- ============================================
CREATE TABLE IF NOT EXISTS perkos_vendor_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,

    -- Endpoint Details
    path TEXT NOT NULL,
    method TEXT DEFAULT 'GET',
    description TEXT,

    -- Pricing
    price_usd TEXT NOT NULL,

    -- Schema (from discovery)
    request_schema JSONB,
    response_schema JSONB,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(vendor_id, path, method)
);

-- Indexes for endpoint queries
CREATE INDEX IF NOT EXISTS idx_perkos_vendor_endpoints_vendor ON perkos_vendor_endpoints(vendor_id);
CREATE INDEX IF NOT EXISTS idx_perkos_vendor_endpoints_path ON perkos_vendor_endpoints(path);

-- ============================================
-- Vendor Verification History
-- Tracks discovery verification attempts
-- ============================================
CREATE TABLE IF NOT EXISTS perkos_vendor_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,

    -- Verification Result
    success BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,

    -- Discovery Data Snapshot
    discovery_data JSONB,

    -- Timestamp
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for verification history
CREATE INDEX IF NOT EXISTS idx_perkos_vendor_verifications_vendor ON perkos_vendor_verifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_perkos_vendor_verifications_time ON perkos_vendor_verifications(verified_at DESC);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE perkos_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vendor_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vendor_verifications ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read vendors" ON perkos_vendors FOR SELECT USING (true);
CREATE POLICY "Allow public read endpoints" ON perkos_vendor_endpoints FOR SELECT USING (true);
CREATE POLICY "Allow public read verifications" ON perkos_vendor_verifications FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Service role can insert vendors" ON perkos_vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update vendors" ON perkos_vendors FOR UPDATE USING (true);
CREATE POLICY "Service role can delete vendors" ON perkos_vendors FOR DELETE USING (true);
CREATE POLICY "Service role can insert endpoints" ON perkos_vendor_endpoints FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update endpoints" ON perkos_vendor_endpoints FOR UPDATE USING (true);
CREATE POLICY "Service role can delete endpoints" ON perkos_vendor_endpoints FOR DELETE USING (true);
CREATE POLICY "Service role can insert verifications" ON perkos_vendor_verifications FOR INSERT WITH CHECK (true);

-- ============================================
-- Function to update vendor stats from transactions
-- ============================================
CREATE OR REPLACE FUNCTION update_vendor_stats(vendor_wallet TEXT)
RETURNS VOID AS $$
DECLARE
    total_tx INTEGER;
    volume_sum TEXT;
BEGIN
    -- Get transaction stats for this vendor
    SELECT COUNT(*), COALESCE(SUM(CAST(amount AS NUMERIC)), 0)::TEXT
    INTO total_tx, volume_sum
    FROM perkos_transactions
    WHERE payee = vendor_wallet AND status = 'settled';

    -- Update vendor stats
    UPDATE perkos_vendors
    SET
        total_transactions = total_tx,
        total_volume = volume_sum,
        updated_at = NOW()
    WHERE wallet_address = vendor_wallet;
END;
$$ LANGUAGE plpgsql;
