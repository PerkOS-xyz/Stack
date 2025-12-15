-- ============================================================
-- Dynamic Pricing Migration for PerkOS-Stack
-- Version: 1.0.0
-- Date: 2025-12-15
--
-- Adds support for vendor-defined dynamic pricing strategies.
-- Vendors can configure fixed, tiered, usage-based, and other
-- pricing strategies for their API endpoints.
-- ============================================================

-- ============ VENDOR PRICING CONFIGURATIONS ============

-- Vendor pricing configurations table
-- Each vendor can have multiple pricing configs, but only one default
CREATE TABLE IF NOT EXISTS perkos_vendor_pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vendor reference
  vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,

  -- Strategy configuration
  strategy_type TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,

  -- Strategy-specific parameters (JSON)
  -- Structure depends on strategy_type:
  -- fixed: { type: "fixed", price: "1000", asset: "0x...", network: "base-sepolia" }
  -- tiered: { type: "tiered", tiers: [...], asset: "0x...", network: "base-sepolia", resetPeriod: 2592000 }
  -- usage-based: { type: "usage-based", pricePerUnit: "10", unit: "per-token", ... }
  parameters JSONB NOT NULL,

  -- Cache configuration
  cache_config JSONB DEFAULT '{"enabled": true, "ttlSeconds": 300}'::jsonb,

  -- Route patterns this config applies to (glob patterns)
  -- e.g., ["/api/premium/*", "/api/data/*"]
  -- NULL means applies to all routes for this vendor
  route_patterns TEXT[],

  -- Priority for config selection (higher = checked first)
  priority INTEGER DEFAULT 0,

  -- Is config enabled
  enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_strategy_type CHECK (
    strategy_type IN ('fixed', 'tiered', 'usage-based', 'time-bucket', 'auction', 'subscription', 'custom')
  ),
  CONSTRAINT valid_parameters CHECK (jsonb_typeof(parameters) = 'object')
);

-- Indexes for pricing configs
CREATE INDEX idx_pricing_config_vendor ON perkos_vendor_pricing_configs(vendor_id);
CREATE INDEX idx_pricing_config_enabled ON perkos_vendor_pricing_configs(vendor_id, enabled);
CREATE INDEX idx_pricing_config_default ON perkos_vendor_pricing_configs(vendor_id, is_default) WHERE is_default = TRUE;
CREATE INDEX idx_pricing_config_priority ON perkos_vendor_pricing_configs(vendor_id, priority DESC);

-- Ensure only one default config per vendor
CREATE UNIQUE INDEX idx_pricing_config_unique_default
ON perkos_vendor_pricing_configs(vendor_id)
WHERE is_default = TRUE AND enabled = TRUE;

-- ============ USER TIERS (per vendor) ============

-- Track user tiers and usage for each vendor
-- Used for tiered pricing calculations
CREATE TABLE IF NOT EXISTS perkos_vendor_user_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,

  -- Current tier
  tier TEXT NOT NULL DEFAULT 'free',

  -- Usage tracking for current period
  request_count INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',

  -- Billing period
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Active subscription (if any)
  subscription_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'basic', 'premium', 'enterprise')),
  CONSTRAINT unique_vendor_user UNIQUE (vendor_id, user_address)
);

-- Indexes for user tiers
CREATE INDEX idx_user_tier_vendor ON perkos_vendor_user_tiers(vendor_id);
CREATE INDEX idx_user_tier_address ON perkos_vendor_user_tiers(user_address);
CREATE INDEX idx_user_tier_period ON perkos_vendor_user_tiers(period_end);

-- ============ SUBSCRIPTION PLANS ============

-- Vendor-defined subscription plans
CREATE TABLE IF NOT EXISTS perkos_vendor_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vendor reference
  vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,
  monthly_price TEXT NOT NULL,  -- In atomic units
  included_requests INTEGER,     -- -1 for unlimited
  features TEXT[],

  -- Status
  enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_vendor_plan_name UNIQUE (vendor_id, name)
);

CREATE INDEX idx_sub_plan_vendor ON perkos_vendor_subscription_plans(vendor_id);
CREATE INDEX idx_sub_plan_enabled ON perkos_vendor_subscription_plans(vendor_id, enabled);

-- ============ USER SUBSCRIPTIONS ============

-- Active user subscriptions
CREATE TABLE IF NOT EXISTS perkos_vendor_user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES perkos_vendor_subscription_plans(id) ON DELETE CASCADE,

  -- Status
  status TEXT DEFAULT 'active',

  -- Credits tracking
  remaining_credits INTEGER,

  -- Period
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Payment reference
  payment_tx_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled', 'pending'))
);

CREATE INDEX idx_subscription_vendor ON perkos_vendor_user_subscriptions(vendor_id);
CREATE INDEX idx_subscription_user ON perkos_vendor_user_subscriptions(user_address);
CREATE INDEX idx_subscription_status ON perkos_vendor_user_subscriptions(status);
CREATE INDEX idx_subscription_active ON perkos_vendor_user_subscriptions(vendor_id, user_address, status)
  WHERE status = 'active';

-- Add foreign key to user tiers
ALTER TABLE perkos_vendor_user_tiers
ADD CONSTRAINT fk_user_tier_subscription
FOREIGN KEY (subscription_id) REFERENCES perkos_vendor_user_subscriptions(id)
ON DELETE SET NULL;

-- ============ PRICE CALCULATIONS LOG ============

-- Log all price calculations for analytics and debugging
CREATE TABLE IF NOT EXISTS perkos_price_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  vendor_id UUID NOT NULL REFERENCES perkos_vendors(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES perkos_vendor_endpoints(id) ON DELETE SET NULL,

  -- Calculation details
  strategy TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  user_address TEXT,

  -- Result
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,

  -- Performance
  cache_hit BOOLEAN DEFAULT FALSE,
  duration_ms INTEGER,

  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_calc_strategy CHECK (
    strategy IN ('fixed', 'tiered', 'usage-based', 'time-bucket', 'auction', 'subscription', 'custom')
  )
);

-- Indexes for price calculations (optimized for analytics queries)
CREATE INDEX idx_price_calc_timestamp ON perkos_price_calculations(timestamp);
CREATE INDEX idx_price_calc_vendor ON perkos_price_calculations(vendor_id);
CREATE INDEX idx_price_calc_vendor_time ON perkos_price_calculations(vendor_id, timestamp);
CREATE INDEX idx_price_calc_strategy ON perkos_price_calculations(strategy);
CREATE INDEX idx_price_calc_user ON perkos_price_calculations(user_address) WHERE user_address IS NOT NULL;

-- Partition by month for better performance (optional, uncomment for production)
-- CREATE INDEX idx_price_calc_month ON perkos_price_calculations(date_trunc('month', timestamp));

-- ============ FUNCTIONS ============

-- Function to increment user request count
CREATE OR REPLACE FUNCTION increment_vendor_user_request_count(
  p_vendor_id UUID,
  p_user_address TEXT,
  p_amount TEXT DEFAULT '0'
)
RETURNS void AS $$
BEGIN
  INSERT INTO perkos_vendor_user_tiers (vendor_id, user_address, request_count, total_volume, period_start, period_end)
  VALUES (p_vendor_id, p_user_address, 1, p_amount, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (vendor_id, user_address)
  DO UPDATE SET
    request_count = perkos_vendor_user_tiers.request_count + 1,
    total_volume = (COALESCE(perkos_vendor_user_tiers.total_volume::numeric, 0) + COALESCE(p_amount::numeric, 0))::text,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to reset expired billing periods
CREATE OR REPLACE FUNCTION reset_vendor_expired_periods()
RETURNS integer AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE perkos_vendor_user_tiers
  SET
    request_count = 0,
    total_volume = '0',
    period_start = NOW(),
    period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE period_end < NOW();

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current tier based on usage
CREATE OR REPLACE FUNCTION get_vendor_user_tier(
  p_vendor_id UUID,
  p_user_address TEXT
)
RETURNS TABLE (
  tier TEXT,
  request_count INTEGER,
  total_volume TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  subscription_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tier,
    t.request_count,
    t.total_volume,
    t.period_start,
    t.period_end,
    CASE WHEN s.id IS NOT NULL AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW())
         THEN TRUE ELSE FALSE END as subscription_active
  FROM perkos_vendor_user_tiers t
  LEFT JOIN perkos_vendor_user_subscriptions s ON t.subscription_id = s.id
  WHERE t.vendor_id = p_vendor_id AND t.user_address = p_user_address;
END;
$$ LANGUAGE plpgsql;

-- ============ TRIGGERS ============

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_pricing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pricing_config_timestamp
BEFORE UPDATE ON perkos_vendor_pricing_configs
FOR EACH ROW EXECUTE FUNCTION update_pricing_timestamp();

CREATE TRIGGER trigger_user_tier_timestamp
BEFORE UPDATE ON perkos_vendor_user_tiers
FOR EACH ROW EXECUTE FUNCTION update_pricing_timestamp();

CREATE TRIGGER trigger_sub_plan_timestamp
BEFORE UPDATE ON perkos_vendor_subscription_plans
FOR EACH ROW EXECUTE FUNCTION update_pricing_timestamp();

-- ============ ROW LEVEL SECURITY ============

-- Enable RLS on all tables
ALTER TABLE perkos_vendor_pricing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vendor_user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vendor_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_vendor_user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_price_calculations ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on pricing_configs"
ON perkos_vendor_pricing_configs FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_tiers"
ON perkos_vendor_user_tiers FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on subscription_plans"
ON perkos_vendor_subscription_plans FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_subscriptions"
ON perkos_vendor_user_subscriptions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on price_calculations"
ON perkos_price_calculations FOR ALL
USING (auth.role() = 'service_role');

-- Public read access for enabled configs
CREATE POLICY "Public read enabled pricing configs"
ON perkos_vendor_pricing_configs FOR SELECT
USING (enabled = TRUE);

-- Public read access for enabled subscription plans
CREATE POLICY "Public read enabled subscription plans"
ON perkos_vendor_subscription_plans FOR SELECT
USING (enabled = TRUE);

-- ============ COMMENTS ============

COMMENT ON TABLE perkos_vendor_pricing_configs IS 'Vendor-defined pricing strategy configurations';
COMMENT ON TABLE perkos_vendor_user_tiers IS 'User tier and usage tracking per vendor for tiered pricing';
COMMENT ON TABLE perkos_vendor_subscription_plans IS 'Vendor-defined subscription plans';
COMMENT ON TABLE perkos_vendor_user_subscriptions IS 'Active user subscriptions';
COMMENT ON TABLE perkos_price_calculations IS 'Price calculation log for analytics';

COMMENT ON COLUMN perkos_vendor_pricing_configs.strategy_type IS 'Pricing strategy: fixed, tiered, usage-based, time-bucket, auction, subscription, custom';
COMMENT ON COLUMN perkos_vendor_pricing_configs.parameters IS 'Strategy-specific parameters as JSON';
COMMENT ON COLUMN perkos_vendor_pricing_configs.route_patterns IS 'Glob patterns for routes this config applies to';
COMMENT ON COLUMN perkos_vendor_user_tiers.request_count IS 'Request count in current billing period';
COMMENT ON COLUMN perkos_vendor_user_tiers.total_volume IS 'Total payment volume in atomic units';
