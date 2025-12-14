-- Migration: Create sponsor wallets and rules tables
-- Description: Tables for gas sponsorship system with Turnkey integration

-- Create sponsor wallets table
CREATE TABLE IF NOT EXISTS perkos_sponsor_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet_address TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN (
        'avalanche', 'avalanche-fuji',
        'base', 'base-sepolia',
        'celo', 'celo-alfajores'
    )),
    turnkey_wallet_id TEXT NOT NULL UNIQUE,
    sponsor_address TEXT NOT NULL UNIQUE,
    balance TEXT NOT NULL DEFAULT '0',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one wallet per user per network
    UNIQUE(user_wallet_address, network)
);

-- Create sponsor rules table
CREATE TABLE IF NOT EXISTS perkos_sponsor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('domain', 'agent', 'endpoint', 'all')),
    rule_value TEXT,
    daily_limit TEXT,
    monthly_limit TEXT,
    per_tx_limit TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure rule_value is set for specific rule types
    CHECK (
        (rule_type = 'all' AND rule_value IS NULL) OR
        (rule_type != 'all' AND rule_value IS NOT NULL)
    )
);

-- Create sponsor transactions table for analytics
CREATE TABLE IF NOT EXISTS perkos_sponsor_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES perkos_sponsor_rules(id) ON DELETE SET NULL,
    network TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    gas_used TEXT NOT NULL,
    gas_price TEXT NOT NULL,
    total_cost TEXT NOT NULL,
    endpoint TEXT,
    domain TEXT,
    agent TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tx_hash)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_user ON perkos_sponsor_wallets(user_wallet_address);
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_network ON perkos_sponsor_wallets(network);
CREATE INDEX IF NOT EXISTS idx_sponsor_wallets_sponsor_address ON perkos_sponsor_wallets(sponsor_address);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_wallet ON perkos_sponsor_rules(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_type ON perkos_sponsor_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_transactions_wallet ON perkos_sponsor_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_transactions_status ON perkos_sponsor_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sponsor_transactions_created ON perkos_sponsor_transactions(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sponsor_wallets_updated_at
    BEFORE UPDATE ON perkos_sponsor_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sponsor_rules_updated_at
    BEFORE UPDATE ON perkos_sponsor_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE perkos_sponsor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_sponsor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_sponsor_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own wallets and related data
CREATE POLICY sponsor_wallets_user_policy ON perkos_sponsor_wallets
    FOR ALL
    USING (user_wallet_address = current_setting('app.user_wallet_address', true)::TEXT);

CREATE POLICY sponsor_rules_user_policy ON perkos_sponsor_rules
    FOR ALL
    USING (
        wallet_id IN (
            SELECT id FROM perkos_sponsor_wallets
            WHERE user_wallet_address = current_setting('app.user_wallet_address', true)::TEXT
        )
    );

CREATE POLICY sponsor_transactions_user_policy ON perkos_sponsor_transactions
    FOR ALL
    USING (
        wallet_id IN (
            SELECT id FROM perkos_sponsor_wallets
            WHERE user_wallet_address = current_setting('app.user_wallet_address', true)::TEXT
        )
    );

-- Grant permissions
GRANT ALL ON perkos_sponsor_wallets TO authenticated;
GRANT ALL ON perkos_sponsor_rules TO authenticated;
GRANT ALL ON perkos_sponsor_transactions TO authenticated;

-- Create view for wallet analytics
CREATE OR REPLACE VIEW perkos_sponsor_wallet_analytics AS
SELECT
    w.id AS wallet_id,
    w.user_wallet_address,
    w.network,
    w.sponsor_address,
    w.balance,
    COUNT(t.id) AS total_transactions,
    COUNT(CASE WHEN t.status = 'success' THEN 1 END) AS successful_transactions,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) AS failed_transactions,
    COALESCE(SUM(CASE WHEN t.status = 'success' THEN t.total_cost::NUMERIC ELSE 0 END)::TEXT, '0') AS total_spent,
    COALESCE(AVG(CASE WHEN t.status = 'success' THEN t.total_cost::NUMERIC ELSE NULL END)::TEXT, '0') AS avg_transaction_cost,
    COUNT(DISTINCT t.domain) AS unique_domains,
    COUNT(DISTINCT t.agent) AS unique_agents
FROM perkos_sponsor_wallets w
LEFT JOIN perkos_sponsor_transactions t ON w.id = t.wallet_id
GROUP BY w.id, w.user_wallet_address, w.network, w.sponsor_address, w.balance;

GRANT SELECT ON perkos_sponsor_wallet_analytics TO authenticated;
