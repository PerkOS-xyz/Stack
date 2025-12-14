-- Migration: Create sponsor_rules table for domain whitelist and spending limits
-- Description: Allows vendors to configure which domains can use their sponsor wallet

-- Create sponsor_rules table
CREATE TABLE IF NOT EXISTS perkos_sponsor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,

    -- Rule type: 'agent_whitelist', 'domain_whitelist', 'spending_limit', 'time_restriction'
    rule_type TEXT NOT NULL CHECK (rule_type IN ('agent_whitelist', 'domain_whitelist', 'spending_limit', 'time_restriction')),

    -- Agent whitelist configuration (wallet addresses that can use sponsorship)
    agent_address TEXT, -- e.g., '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'

    -- Domain whitelist configuration (vendor server domains)
    domain TEXT, -- e.g., 'api.vendor.com' or '*.vendor.com'

    -- Spending limit configuration
    daily_limit_wei TEXT, -- Daily spending limit in wei
    monthly_limit_wei TEXT, -- Monthly spending limit in wei
    per_transaction_limit_wei TEXT, -- Per transaction limit in wei

    -- Time restriction configuration
    active_hours_start INTEGER, -- Hour 0-23 when sponsorship is active
    active_hours_end INTEGER, -- Hour 0-23 when sponsorship ends
    active_days TEXT[], -- Array of days: ['monday', 'tuesday', ...]

    -- Rule metadata
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority rules are checked first
    description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_wallet_id ON perkos_sponsor_rules(sponsor_wallet_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_type ON perkos_sponsor_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_agent_address ON perkos_sponsor_rules(agent_address);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_enabled ON perkos_sponsor_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_sponsor_rules_priority ON perkos_sponsor_rules(priority DESC);

-- Add comments
COMMENT ON TABLE perkos_sponsor_rules IS 'Sponsorship rules for controlling gas fee sponsorship';
COMMENT ON COLUMN perkos_sponsor_rules.rule_type IS 'Type of rule: agent_whitelist, domain_whitelist, spending_limit, time_restriction';
COMMENT ON COLUMN perkos_sponsor_rules.agent_address IS 'Wallet address of agent allowed to use sponsorship';
COMMENT ON COLUMN perkos_sponsor_rules.domain IS 'Vendor server domain allowed to request sponsorship (e.g., api.vendor.com)';
COMMENT ON COLUMN perkos_sponsor_rules.daily_limit_wei IS 'Maximum daily spending in wei';
COMMENT ON COLUMN perkos_sponsor_rules.priority IS 'Higher priority rules are evaluated first';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sponsor_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_sponsor_rules_updated_at ON perkos_sponsor_rules;
CREATE TRIGGER trigger_update_sponsor_rules_updated_at
    BEFORE UPDATE ON perkos_sponsor_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_sponsor_rules_updated_at();

-- Create spending tracking table
CREATE TABLE IF NOT EXISTS perkos_sponsor_spending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,

    -- Spending details
    amount_wei TEXT NOT NULL,
    agent_address TEXT, -- Agent wallet address that used the sponsorship
    transaction_hash TEXT,

    -- Time tracking
    spent_at TIMESTAMPTZ DEFAULT NOW(),
    day DATE, -- Computed via trigger
    month DATE -- Computed via trigger
);

-- Create function to set day and month on insert/update
CREATE OR REPLACE FUNCTION set_sponsor_spending_dates()
RETURNS TRIGGER AS $$
BEGIN
    NEW.day = DATE(NEW.spent_at);
    NEW.month = DATE_TRUNC('month', NEW.spent_at)::DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set day and month
DROP TRIGGER IF EXISTS trigger_set_sponsor_spending_dates ON perkos_sponsor_spending;
CREATE TRIGGER trigger_set_sponsor_spending_dates
    BEFORE INSERT OR UPDATE ON perkos_sponsor_spending
    FOR EACH ROW
    EXECUTE FUNCTION set_sponsor_spending_dates();

-- Create indexes for spending queries
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_wallet_id ON perkos_sponsor_spending(sponsor_wallet_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_day ON perkos_sponsor_spending(day);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_month ON perkos_sponsor_spending(month);
CREATE INDEX IF NOT EXISTS idx_sponsor_spending_agent_address ON perkos_sponsor_spending(agent_address);

-- Add comments
COMMENT ON TABLE perkos_sponsor_spending IS 'Tracks all spending from sponsor wallets for limit enforcement';
COMMENT ON COLUMN perkos_sponsor_spending.amount_wei IS 'Amount spent in wei';
COMMENT ON COLUMN perkos_sponsor_spending.day IS 'Automatically computed day for daily aggregation (set by trigger)';
COMMENT ON COLUMN perkos_sponsor_spending.month IS 'Automatically computed month for monthly aggregation (set by trigger)';
