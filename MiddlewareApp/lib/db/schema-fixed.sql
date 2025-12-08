-- ============================================
-- PerkOS x402 Database Schema for Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Transactions Table
-- Stores all payment transactions (exact and deferred)
-- ============================================
CREATE TABLE perkos_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hash TEXT NOT NULL UNIQUE,
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    scheme TEXT NOT NULL CHECK (scheme IN ('exact', 'deferred')),
    payer TEXT NOT NULL,
    payee TEXT NOT NULL,
    amount TEXT NOT NULL,
    asset TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'settled', 'failed')),
    error_message TEXT,
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_transactions_hash ON perkos_transactions(hash);
CREATE INDEX idx_transactions_network ON perkos_transactions(network);
CREATE INDEX idx_transactions_payer ON perkos_transactions(payer);
CREATE INDEX idx_transactions_payee ON perkos_transactions(payee);
CREATE INDEX idx_transactions_status ON perkos_transactions(status);
CREATE INDEX idx_transactions_created_at ON perkos_transactions(created_at DESC);
CREATE INDEX idx_transactions_network_created ON perkos_transactions(network, created_at DESC);

-- ============================================
-- Vouchers Table
-- Stores deferred payment vouchers
-- ============================================
CREATE TABLE perkos_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id TEXT NOT NULL UNIQUE,
    buyer TEXT NOT NULL,
    seller TEXT NOT NULL,
    value_aggregate TEXT NOT NULL,
    asset TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    nonce TEXT NOT NULL,
    escrow TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    settled BOOLEAN DEFAULT FALSE,
    settled_tx_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for voucher queries
CREATE INDEX idx_vouchers_buyer ON perkos_vouchers(buyer);
CREATE INDEX idx_vouchers_seller ON perkos_vouchers(seller);
CREATE INDEX idx_vouchers_settled ON perkos_vouchers(settled);
CREATE INDEX idx_vouchers_created_at ON perkos_vouchers(created_at DESC);

-- ============================================
-- Agents Table
-- Stores agent metadata and reputation
-- ============================================
CREATE TABLE perkos_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    name TEXT,
    description TEXT,
    url TEXT,
    capabilities TEXT[] DEFAULT '{}',
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    average_rating DECIMAL(3,2) DEFAULT 0,
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent queries
CREATE INDEX idx_agents_address ON perkos_agents(address);
CREATE INDEX idx_agents_total_transactions ON perkos_agents(total_transactions DESC);
CREATE INDEX idx_agents_average_rating ON perkos_agents(average_rating DESC);

-- ============================================
-- Reviews Table
-- Stores agent reviews and ratings
-- ============================================
CREATE TABLE perkos_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES perkos_agents(id) ON DELETE CASCADE,
    reviewer_address TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 100),
    comment TEXT,
    transaction_hash TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for review queries
CREATE INDEX idx_reviews_agent_id ON perkos_reviews(agent_id);
CREATE INDEX idx_reviews_reviewer ON perkos_reviews(reviewer_address);
CREATE INDEX idx_reviews_created_at ON perkos_reviews(created_at DESC);

-- ============================================
-- Network Stats Table
-- Daily aggregated statistics per network
-- ============================================
CREATE TABLE perkos_network_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_transactions INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    unique_users INTEGER DEFAULT 0,
    average_tx_value TEXT DEFAULT '0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(network, date)
);

-- Indexes for stats queries
CREATE INDEX idx_network_stats_network ON perkos_network_stats(network);
CREATE INDEX idx_network_stats_date ON perkos_network_stats(date DESC);
CREATE INDEX idx_network_stats_network_date ON perkos_network_stats(network, date DESC);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON perkos_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON perkos_vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON perkos_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update agent statistics
CREATE OR REPLACE FUNCTION update_agent_stats(agent_address TEXT)
RETURNS VOID AS $$
DECLARE
    total_tx INTEGER;
    successful_tx INTEGER;
    volume_sum TEXT;
    avg_rating DECIMAL;
    last_tx TIMESTAMP;
BEGIN
    -- Get transaction stats
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'settled')
    INTO total_tx, successful_tx
    FROM perkos_transactions
    WHERE payee = agent_address;

    -- Calculate total volume
    SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0)::TEXT
    INTO volume_sum
    FROM perkos_transactions
    WHERE payee = agent_address AND status = 'settled';

    -- Get last transaction time
    SELECT MAX(created_at)
    INTO last_tx
    FROM perkos_transactions
    WHERE payee = agent_address;

    -- Calculate average rating
    SELECT COALESCE(AVG(rating), 0)
    INTO avg_rating
    FROM perkos_reviews r
    JOIN perkos_agents a ON r.agent_id = a.id
    WHERE a.address = agent_address;

    -- Update or insert agent
    INSERT INTO perkos_agents (address, total_transactions, successful_transactions, total_volume, average_rating, last_transaction_at)
    VALUES (agent_address, total_tx, successful_tx, volume_sum, avg_rating, last_tx)
    ON CONFLICT (address) DO UPDATE SET
        total_transactions = EXCLUDED.total_transactions,
        successful_transactions = EXCLUDED.successful_transactions,
        total_volume = EXCLUDED.total_volume,
        average_rating = EXCLUDED.average_rating,
        last_transaction_at = EXCLUDED.last_transaction_at;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent stats on transaction changes
CREATE OR REPLACE FUNCTION trigger_update_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_agent_stats(NEW.payee);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_update_agent_stats
    AFTER INSERT OR UPDATE ON perkos_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_agent_stats();

-- Function to aggregate daily network stats
CREATE OR REPLACE FUNCTION aggregate_network_stats(target_date DATE, target_network TEXT)
RETURNS VOID AS $$
DECLARE
    tx_count INTEGER;
    volume_sum TEXT;
    users_count INTEGER;
    avg_value TEXT;
    target_chain_id INTEGER;
BEGIN
    -- Get chain ID for network
    SELECT DISTINCT chain_id INTO target_chain_id
    FROM perkos_transactions
    WHERE network = target_network
    LIMIT 1;

    -- Aggregate stats
    SELECT
        COUNT(*),
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0)::TEXT,
        COUNT(DISTINCT payer),
        COALESCE(AVG(CAST(amount AS NUMERIC)), 0)::TEXT
    INTO tx_count, volume_sum, users_count, avg_value
    FROM perkos_transactions
    WHERE network = target_network
    AND DATE(created_at) = target_date
    AND status = 'settled';

    -- Insert or update stats
    INSERT INTO perkos_network_stats (network, chain_id, date, total_transactions, total_volume, unique_users, average_tx_value)
    VALUES (target_network, target_chain_id, target_date, tx_count, volume_sum, users_count, avg_value)
    ON CONFLICT (network, date) DO UPDATE SET
        total_transactions = EXCLUDED.total_transactions,
        total_volume = EXCLUDED.total_volume,
        unique_users = EXCLUDED.unique_users,
        average_tx_value = EXCLUDED.average_tx_value;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables (FIXED - added perkos_ prefix)
ALTER TABLE perkos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_network_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all tables
CREATE POLICY "Allow public read access" ON perkos_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON perkos_vouchers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON perkos_agents FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON perkos_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON perkos_network_stats FOR SELECT USING (true);

-- Only allow service role to write (will be done via API with service key)
CREATE POLICY "Service role can insert" ON perkos_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update" ON perkos_transactions FOR UPDATE USING (true);
CREATE POLICY "Service role can insert" ON perkos_vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update" ON perkos_vouchers FOR UPDATE USING (true);
CREATE POLICY "Service role can insert" ON perkos_agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update" ON perkos_agents FOR UPDATE USING (true);

-- Allow anyone to submit reviews (can be restricted later)
CREATE POLICY "Anyone can insert reviews" ON perkos_reviews FOR INSERT WITH CHECK (true);

-- ============================================
-- Initial Data
-- ============================================

-- Insert initial agent for the facilitator
INSERT INTO perkos_agents (address, name, description, url, capabilities) VALUES
('0x499D377eF114cC1BF7798cECBB38412701400daF', 'PerkOS x402 Facilitator', 'Community-friendly multi-chain payment facilitator', 'https://x402.perkos.io', ARRAY['x402-payment-exact', 'x402-payment-deferred', 'erc-8004-discovery']);
