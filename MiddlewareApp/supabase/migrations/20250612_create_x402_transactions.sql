-- Migration: Create perkos_x402_transactions table for tracking all x402 payments
-- Description: Store all x402 payment transactions for analytics, dashboard, and history

-- Create perkos_x402_transactions table
CREATE TABLE IF NOT EXISTS perkos_x402_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Transaction details
    transaction_hash TEXT NOT NULL UNIQUE,

    -- Payment participants
    payer_address TEXT NOT NULL,           -- Client/consumer wallet (from)
    recipient_address TEXT NOT NULL,        -- Vendor treasury wallet (to)
    sponsor_address TEXT,                   -- Gas sponsor wallet (if sponsored)

    -- Payment details
    amount_wei TEXT NOT NULL,               -- Payment amount in wei
    amount_usd DECIMAL(20, 6),              -- Payment amount in USD
    asset_address TEXT NOT NULL,            -- Token contract address (e.g., USDC)
    asset_symbol TEXT DEFAULT 'USDC',       -- Token symbol

    -- Network details
    network TEXT NOT NULL,                  -- e.g., 'avalanche', 'base', 'celo'
    chain_id INTEGER NOT NULL,              -- e.g., 43114 for Avalanche

    -- Payment scheme
    scheme TEXT NOT NULL DEFAULT 'exact',   -- 'exact' or 'deferred'

    -- Vendor/Server details
    vendor_domain TEXT,                     -- Vendor API domain
    vendor_endpoint TEXT,                   -- API endpoint called
    vendor_id UUID,                         -- Reference to vendor registry

    -- Status
    status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed', 'pending'
    error_message TEXT,                     -- Error details if failed

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_payer ON perkos_x402_transactions(payer_address);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_recipient ON perkos_x402_transactions(recipient_address);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_sponsor ON perkos_x402_transactions(sponsor_address);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_network ON perkos_x402_transactions(network);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_chain ON perkos_x402_transactions(chain_id);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_scheme ON perkos_x402_transactions(scheme);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_status ON perkos_x402_transactions(status);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_created ON perkos_x402_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_vendor ON perkos_x402_transactions(vendor_domain);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_network_created ON perkos_x402_transactions(network, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_tx_payer_created ON perkos_x402_transactions(payer_address, created_at DESC);

-- Add comments
COMMENT ON TABLE perkos_x402_transactions IS 'All x402 payment transactions across the network';
COMMENT ON COLUMN perkos_x402_transactions.payer_address IS 'Client/consumer wallet address that paid';
COMMENT ON COLUMN perkos_x402_transactions.recipient_address IS 'Vendor treasury wallet that received payment';
COMMENT ON COLUMN perkos_x402_transactions.sponsor_address IS 'Sponsor wallet that paid gas fees (if applicable)';
COMMENT ON COLUMN perkos_x402_transactions.amount_wei IS 'Payment amount in smallest token unit (e.g., wei for USDC = 6 decimals)';
COMMENT ON COLUMN perkos_x402_transactions.scheme IS 'Payment scheme: exact (EIP-3009) or deferred';

-- Create perkos_x402_agents table for tracking unique agents (payers/consumers)
CREATE TABLE IF NOT EXISTS perkos_x402_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent identity
    wallet_address TEXT NOT NULL UNIQUE,

    -- Agent type
    agent_type TEXT DEFAULT 'member',       -- 'member' (consumer) or 'provider' (vendor)

    -- Display info (optional)
    display_name TEXT,

    -- Statistics (denormalized for performance)
    total_transactions INTEGER DEFAULT 0,
    total_volume_wei TEXT DEFAULT '0',
    total_volume_usd DECIMAL(20, 6) DEFAULT 0,

    -- Network preference (most used)
    primary_network TEXT,

    -- Activity tracking
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    is_active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_address ON perkos_x402_agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_type ON perkos_x402_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_volume ON perkos_x402_agents(total_volume_usd DESC);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_active ON perkos_x402_agents(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_agents_network ON perkos_x402_agents(primary_network);

COMMENT ON TABLE perkos_x402_agents IS 'Unique agents (wallets) that have participated in x402 transactions';

-- Create perkos_x402_network_stats table for tracking network-level statistics
CREATE TABLE IF NOT EXISTS perkos_x402_network_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Network identifier
    network TEXT NOT NULL,
    chain_id INTEGER NOT NULL,

    -- Date for daily aggregation
    stats_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Transaction stats
    transaction_count INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,

    -- Volume stats
    total_volume_wei TEXT DEFAULT '0',
    total_volume_usd DECIMAL(20, 6) DEFAULT 0,
    avg_transaction_usd DECIMAL(20, 6) DEFAULT 0,

    -- Agent stats
    unique_payers INTEGER DEFAULT 0,
    unique_recipients INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for network + date
    UNIQUE(network, stats_date)
);

CREATE INDEX IF NOT EXISTS idx_perkos_x402_network_stats_network ON perkos_x402_network_stats(network);
CREATE INDEX IF NOT EXISTS idx_perkos_x402_network_stats_date ON perkos_x402_network_stats(stats_date DESC);

COMMENT ON TABLE perkos_x402_network_stats IS 'Daily aggregated statistics per network';

-- Function to update network stats after transaction
CREATE OR REPLACE FUNCTION update_perkos_x402_network_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update network stats for today
    INSERT INTO perkos_x402_network_stats (network, chain_id, stats_date, transaction_count, successful_count, total_volume_wei, total_volume_usd)
    VALUES (
        NEW.network,
        NEW.chain_id,
        CURRENT_DATE,
        1,
        CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END,
        NEW.amount_wei,
        COALESCE(NEW.amount_usd, 0)
    )
    ON CONFLICT (network, stats_date)
    DO UPDATE SET
        transaction_count = perkos_x402_network_stats.transaction_count + 1,
        successful_count = perkos_x402_network_stats.successful_count + CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END,
        total_volume_wei = (CAST(perkos_x402_network_stats.total_volume_wei AS NUMERIC) + CAST(NEW.amount_wei AS NUMERIC))::TEXT,
        total_volume_usd = perkos_x402_network_stats.total_volume_usd + COALESCE(NEW.amount_usd, 0),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update network stats on new transaction
DROP TRIGGER IF EXISTS trigger_update_perkos_x402_network_stats ON perkos_x402_transactions;
CREATE TRIGGER trigger_update_perkos_x402_network_stats
    AFTER INSERT ON perkos_x402_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_perkos_x402_network_stats();

-- Function to update agent stats after transaction
CREATE OR REPLACE FUNCTION update_perkos_x402_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Upsert payer (consumer)
    INSERT INTO perkos_x402_agents (wallet_address, agent_type, total_transactions, total_volume_wei, total_volume_usd, primary_network, last_active_at)
    VALUES (
        NEW.payer_address,
        'member',
        1,
        NEW.amount_wei,
        COALESCE(NEW.amount_usd, 0),
        NEW.network,
        NOW()
    )
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_transactions = perkos_x402_agents.total_transactions + 1,
        total_volume_wei = (CAST(perkos_x402_agents.total_volume_wei AS NUMERIC) + CAST(NEW.amount_wei AS NUMERIC))::TEXT,
        total_volume_usd = perkos_x402_agents.total_volume_usd + COALESCE(NEW.amount_usd, 0),
        last_active_at = NOW();

    -- Upsert recipient (vendor) as provider
    INSERT INTO perkos_x402_agents (wallet_address, agent_type, total_transactions, total_volume_wei, total_volume_usd, primary_network, last_active_at)
    VALUES (
        NEW.recipient_address,
        'provider',
        1,
        NEW.amount_wei,
        COALESCE(NEW.amount_usd, 0),
        NEW.network,
        NOW()
    )
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_transactions = perkos_x402_agents.total_transactions + 1,
        total_volume_wei = (CAST(perkos_x402_agents.total_volume_wei AS NUMERIC) + CAST(NEW.amount_wei AS NUMERIC))::TEXT,
        total_volume_usd = perkos_x402_agents.total_volume_usd + COALESCE(NEW.amount_usd, 0),
        last_active_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent stats on new transaction
DROP TRIGGER IF EXISTS trigger_update_perkos_x402_agent_stats ON perkos_x402_transactions;
CREATE TRIGGER trigger_update_perkos_x402_agent_stats
    AFTER INSERT ON perkos_x402_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_perkos_x402_agent_stats();
