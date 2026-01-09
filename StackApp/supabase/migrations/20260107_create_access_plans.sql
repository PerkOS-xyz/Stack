-- ============================================
-- Stack Access Plans Migration
-- User subscriptions, API keys, and usage tracking
-- All objects prefixed with 'perkos_' for namespace isolation
-- ============================================

-- ============================================
-- User Subscriptions Table
-- Stores user subscription records and plan assignments
-- ============================================
CREATE TABLE perkos_user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'starter', 'pro', 'scale', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'expired', 'pending')),
    monthly_api_limit INTEGER NOT NULL DEFAULT 1000,
    api_calls_used INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    payment_method TEXT CHECK (payment_method IN ('x402', 'stripe', 'crypto', 'invoice')),
    last_payment_tx_hash TEXT,
    last_payment_amount TEXT,
    last_payment_at TIMESTAMP WITH TIME ZONE,
    next_billing_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscription queries
CREATE INDEX perkos_idx_subscriptions_wallet ON perkos_user_subscriptions(wallet_address);
CREATE INDEX perkos_idx_subscriptions_plan ON perkos_user_subscriptions(plan_id);
CREATE INDEX perkos_idx_subscriptions_status ON perkos_user_subscriptions(status);
CREATE INDEX perkos_idx_subscriptions_period_end ON perkos_user_subscriptions(period_end);
CREATE INDEX perkos_idx_subscriptions_created_at ON perkos_user_subscriptions(created_at DESC);

-- ============================================
-- API Keys Table
-- Stores user API keys (hashed)
-- ============================================
CREATE TABLE perkos_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL REFERENCES perkos_user_subscriptions(wallet_address) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'API Key',
    last_four TEXT NOT NULL,
    allowed_networks TEXT[] DEFAULT '{}',
    rate_limit_override INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    total_requests BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for API key queries
CREATE INDEX perkos_idx_api_keys_wallet ON perkos_api_keys(wallet_address);
CREATE INDEX perkos_idx_api_keys_key_hash ON perkos_api_keys(key_hash);
CREATE INDEX perkos_idx_api_keys_key_prefix ON perkos_api_keys(key_prefix);
CREATE INDEX perkos_idx_api_keys_is_active ON perkos_api_keys(is_active);
CREATE INDEX perkos_idx_api_keys_created_at ON perkos_api_keys(created_at DESC);

-- ============================================
-- Daily Usage Table
-- Tracks daily API usage per user
-- ============================================
CREATE TABLE perkos_daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL REFERENCES perkos_user_subscriptions(wallet_address) ON DELETE CASCADE,
    date DATE NOT NULL,
    api_calls INTEGER NOT NULL DEFAULT 0,
    calls_by_endpoint JSONB NOT NULL DEFAULT '{}',
    calls_by_network JSONB NOT NULL DEFAULT '{}',
    data_transferred BIGINT NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address, date)
);

-- Indexes for usage queries
CREATE INDEX perkos_idx_daily_usage_wallet ON perkos_daily_usage(wallet_address);
CREATE INDEX perkos_idx_daily_usage_date ON perkos_daily_usage(date DESC);
CREATE INDEX perkos_idx_daily_usage_wallet_date ON perkos_daily_usage(wallet_address, date DESC);

-- ============================================
-- Triggers
-- ============================================

-- Update updated_at trigger for subscriptions (uses existing update_updated_at_column function)
CREATE TRIGGER perkos_update_subscriptions_updated_at BEFORE UPDATE ON perkos_user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Functions (all prefixed with perkos_)
-- ============================================

-- Function to increment API calls for a user
CREATE OR REPLACE FUNCTION perkos_increment_api_calls(
    p_wallet_address TEXT,
    p_endpoint TEXT DEFAULT NULL,
    p_network TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    current_usage INTEGER,
    monthly_limit INTEGER,
    remaining INTEGER
) AS $$
DECLARE
    v_subscription RECORD;
    v_current_usage INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get subscription
    SELECT * INTO v_subscription
    FROM perkos_user_subscriptions
    WHERE wallet_address = p_wallet_address
    AND status IN ('active', 'trial')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, 0;
        RETURN;
    END IF;

    -- Check if limit exceeded (skip for unlimited plans: -1)
    IF v_subscription.monthly_api_limit >= 0 AND
       v_subscription.api_calls_used >= v_subscription.monthly_api_limit THEN
        RETURN QUERY SELECT FALSE,
            v_subscription.api_calls_used,
            v_subscription.monthly_api_limit,
            0;
        RETURN;
    END IF;

    -- Increment subscription counter
    UPDATE perkos_user_subscriptions
    SET api_calls_used = api_calls_used + 1,
        updated_at = NOW()
    WHERE wallet_address = p_wallet_address;

    -- Update or create daily usage record
    INSERT INTO perkos_daily_usage (wallet_address, date, api_calls, calls_by_endpoint, calls_by_network)
    VALUES (
        p_wallet_address,
        v_today,
        1,
        CASE WHEN p_endpoint IS NOT NULL THEN jsonb_build_object(p_endpoint, 1) ELSE '{}'::jsonb END,
        CASE WHEN p_network IS NOT NULL THEN jsonb_build_object(p_network, 1) ELSE '{}'::jsonb END
    )
    ON CONFLICT (wallet_address, date) DO UPDATE SET
        api_calls = perkos_daily_usage.api_calls + 1,
        calls_by_endpoint = CASE
            WHEN p_endpoint IS NOT NULL THEN
                perkos_daily_usage.calls_by_endpoint ||
                jsonb_build_object(p_endpoint,
                    COALESCE((perkos_daily_usage.calls_by_endpoint->>p_endpoint)::integer, 0) + 1)
            ELSE perkos_daily_usage.calls_by_endpoint
        END,
        calls_by_network = CASE
            WHEN p_network IS NOT NULL THEN
                perkos_daily_usage.calls_by_network ||
                jsonb_build_object(p_network,
                    COALESCE((perkos_daily_usage.calls_by_network->>p_network)::integer, 0) + 1)
            ELSE perkos_daily_usage.calls_by_network
        END;

    -- Get updated usage
    v_current_usage := v_subscription.api_calls_used + 1;

    RETURN QUERY SELECT
        TRUE,
        v_current_usage,
        v_subscription.monthly_api_limit,
        CASE
            WHEN v_subscription.monthly_api_limit < 0 THEN -1  -- Unlimited
            ELSE v_subscription.monthly_api_limit - v_current_usage
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to update API key usage stats
CREATE OR REPLACE FUNCTION perkos_update_api_key_usage(p_key_hash TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE perkos_api_keys
    SET last_used_at = NOW(),
        total_requests = total_requests + 1
    WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (call via cron job)
CREATE OR REPLACE FUNCTION perkos_reset_monthly_usage()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE perkos_user_subscriptions
    SET api_calls_used = 0,
        period_start = NOW(),
        period_end = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE period_end <= NOW()
    AND status IN ('active', 'trial');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage summary for a user
CREATE OR REPLACE FUNCTION perkos_get_usage_summary(p_wallet_address TEXT)
RETURNS TABLE (
    total_calls INTEGER,
    calls_remaining INTEGER,
    usage_percentage NUMERIC,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    days_remaining INTEGER,
    avg_daily_usage NUMERIC,
    projected_usage INTEGER,
    will_exceed_limit BOOLEAN
) AS $$
DECLARE
    v_subscription RECORD;
    v_days_in_period INTEGER;
    v_days_elapsed INTEGER;
    v_days_remaining INTEGER;
    v_avg_daily NUMERIC;
    v_projected INTEGER;
BEGIN
    SELECT * INTO v_subscription
    FROM perkos_user_subscriptions
    WHERE wallet_address = p_wallet_address;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_days_in_period := EXTRACT(DAY FROM (v_subscription.period_end - v_subscription.period_start));
    v_days_elapsed := GREATEST(1, EXTRACT(DAY FROM (NOW() - v_subscription.period_start)));
    v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_subscription.period_end - NOW())));
    v_avg_daily := v_subscription.api_calls_used::NUMERIC / v_days_elapsed;
    v_projected := ROUND(v_avg_daily * v_days_in_period);

    RETURN QUERY SELECT
        v_subscription.api_calls_used,
        CASE
            WHEN v_subscription.monthly_api_limit < 0 THEN -1
            ELSE GREATEST(0, v_subscription.monthly_api_limit - v_subscription.api_calls_used)
        END,
        CASE
            WHEN v_subscription.monthly_api_limit <= 0 THEN 0
            ELSE ROUND((v_subscription.api_calls_used::NUMERIC / v_subscription.monthly_api_limit) * 100, 2)
        END,
        v_subscription.period_start,
        v_subscription.period_end,
        v_days_remaining,
        ROUND(v_avg_daily, 2),
        v_projected,
        v_subscription.monthly_api_limit > 0 AND v_projected > v_subscription.monthly_api_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on access plan tables
ALTER TABLE perkos_user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_daily_usage ENABLE ROW LEVEL SECURITY;

-- Public read access for subscriptions (limited fields)
CREATE POLICY "perkos_allow_public_read_subscriptions" ON perkos_user_subscriptions
    FOR SELECT USING (true);

-- Public read access for usage stats
CREATE POLICY "perkos_allow_public_read_daily_usage" ON perkos_daily_usage
    FOR SELECT USING (true);

-- Service role can manage subscriptions
CREATE POLICY "perkos_service_insert_subscriptions" ON perkos_user_subscriptions
    FOR INSERT WITH CHECK (true);
CREATE POLICY "perkos_service_update_subscriptions" ON perkos_user_subscriptions
    FOR UPDATE USING (true);
CREATE POLICY "perkos_service_delete_subscriptions" ON perkos_user_subscriptions
    FOR DELETE USING (true);

-- Service role can manage API keys
CREATE POLICY "perkos_service_insert_api_keys" ON perkos_api_keys
    FOR INSERT WITH CHECK (true);
CREATE POLICY "perkos_service_update_api_keys" ON perkos_api_keys
    FOR UPDATE USING (true);
CREATE POLICY "perkos_service_delete_api_keys" ON perkos_api_keys
    FOR DELETE USING (true);
CREATE POLICY "perkos_service_select_api_keys" ON perkos_api_keys
    FOR SELECT USING (true);

-- Service role can manage daily usage
CREATE POLICY "perkos_service_insert_daily_usage" ON perkos_daily_usage
    FOR INSERT WITH CHECK (true);
CREATE POLICY "perkos_service_update_daily_usage" ON perkos_daily_usage
    FOR UPDATE USING (true);

-- ============================================
-- Plan Limits Reference (for application use)
-- ============================================
-- Plan ID      | Monthly Calls | Networks | Rate Limit (req/min)
-- -------------|---------------|----------|---------------------
-- free         | 1,000         | 1        | 10
-- starter      | 50,000        | 3        | 60
-- pro          | 500,000       | unlimited| 300
-- scale        | 5,000,000     | unlimited| 1,000
-- enterprise   | unlimited (-1)| unlimited| 5,000
