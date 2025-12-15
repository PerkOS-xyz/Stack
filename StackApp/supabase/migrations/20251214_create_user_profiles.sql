-- Migration: Create user profiles table
-- Description: Store user profile information including account type, name, description, avatar, website
--
-- RUN THIS SQL IN SUPABASE SQL EDITOR:
-- =====================================

-- Create user profiles table
CREATE TABLE IF NOT EXISTS perkos_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User identification (wallet address from Thirdweb login)
    wallet_address TEXT NOT NULL UNIQUE,

    -- Account type classification
    account_type TEXT NOT NULL DEFAULT 'personal' CHECK (account_type IN (
        'personal',      -- Individual user account
        'community',     -- Community member, contributor, or enthusiast
        'organization',  -- Organization/team account
        'vendor'         -- Company vendor account (service provider)
    )),

    -- Profile information
    display_name TEXT,
    description TEXT,
    website TEXT,

    -- Avatar/logo (URL to stored image)
    avatar_url TEXT,

    -- Social links (optional)
    twitter_handle TEXT,
    github_handle TEXT,
    discord_handle TEXT,
    farcaster_handle TEXT,
    telegram_handle TEXT,
    instagram_handle TEXT,
    tiktok_handle TEXT,
    twitch_handle TEXT,
    kick_handle TEXT,

    -- Vendor-specific fields (only applicable for vendor accounts)
    company_name TEXT,
    company_registration_number TEXT,

    -- Profile status
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON perkos_user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type ON perkos_user_profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON perkos_user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_public ON perkos_user_profiles(is_public);

-- Create updated_at trigger
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON perkos_user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE perkos_user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view public profiles
CREATE POLICY user_profiles_public_read ON perkos_user_profiles
    FOR SELECT
    USING (is_public = true);

-- RLS Policy: Users can manage their own profile
CREATE POLICY user_profiles_owner_policy ON perkos_user_profiles
    FOR ALL
    USING (wallet_address = current_setting('app.user_wallet_address', true)::TEXT);

-- Grant permissions
GRANT ALL ON perkos_user_profiles TO authenticated;
GRANT SELECT ON perkos_user_profiles TO anon;

-- Create storage bucket for avatars (run this in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Example profile data:
-- wallet_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
-- account_type: 'vendor'
-- display_name: 'Acme AI Services'
-- description: 'Provider of AI-powered automation services'
-- website: 'https://acme-ai.com'
-- avatar_url: 'https://storage.supabase.co/avatars/abc123.png'
-- company_name: 'Acme AI Inc.'
