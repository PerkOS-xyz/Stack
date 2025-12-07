# Turnkey Setup Guide - Step by Step

## Overview

Turnkey provides secure wallet infrastructure using AWS Nitro Enclaves. This guide walks through creating API keys for production use.

## Step 1: Create Turnkey Account

1. Go to [https://app.turnkey.com](https://app.turnkey.com)
2. Click **"Sign Up"** or **"Get Started"**
3. Complete registration with your email
4. Verify your email address

## Step 2: Create Organization

After logging in:

1. You'll be prompted to create an organization
2. Enter organization name (e.g., "PerkOS x402 Facilitator")
3. Click **"Create Organization"**
4. **Copy and save your Organization ID** - this is `TURNKEY_ORGANIZATION_ID`

## Step 3: Generate API Keys

### Option A: Using Turnkey Dashboard (Recommended)

1. In Turnkey dashboard, go to **Settings → API Keys** (or **Developer → API Keys**)
2. Click **"Create API Key"** or **"New API Key"**
3. Enter key name: `x402-facilitator-production`
4. Select permissions:
   - ✅ **Create Wallets**
   - ✅ **Sign Transactions**
   - ✅ **Read Wallets**
5. Click **"Generate"**

**IMPORTANT: Save these immediately - they won't be shown again!**

You'll receive:
- **API Public Key** → `TURNKEY_API_PUBLIC_KEY`
- **API Private Key** → `TURNKEY_API_PRIVATE_KEY`

### Option B: Using Turnkey CLI

If you prefer CLI:

```bash
# Install Turnkey CLI
npm install -g @turnkey/cli

# Login
turnkey login

# Create API key
turnkey api-keys create \
  --name "x402-facilitator-production" \
  --organization-id "your-org-id"
```

The CLI will output:
```json
{
  "publicKey": "your-public-key",
  "privateKey": "your-private-key"
}
```

## Step 4: Add to .env File

Open your `.env` file and add:

```bash
# ============ Turnkey Configuration ============
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_ORGANIZATION_ID=your-actual-org-id-here
TURNKEY_API_PUBLIC_KEY=your-actual-public-key-here
TURNKEY_API_PRIVATE_KEY=your-actual-private-key-here
```

### Example (with fake values):

```bash
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_ORGANIZATION_ID=8f7a3c2b-1d4e-5f6a-9b8c-7d6e5f4a3b2c
TURNKEY_API_PUBLIC_KEY=04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
TURNKEY_API_PRIVATE_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

## Step 5: Verify Configuration

Test your API keys work:

```bash
# Create a test script
cat > test-turnkey.ts << 'EOF'
import { getTurnkeyService } from './lib/services/TurnkeyService';

async function test() {
  try {
    const turnkey = getTurnkeyService();
    console.log('✅ Turnkey service initialized successfully!');
    console.log('Organization ID:', process.env.TURNKEY_ORGANIZATION_ID);
  } catch (error) {
    console.error('❌ Turnkey initialization failed:', error.message);
  }
}

test();
EOF

# Run test
npx tsx test-turnkey.ts
```

Expected output:
```
✅ Turnkey service initialized successfully!
Organization ID: 8f7a3c2b-1d4e-5f6a-9b8c-7d6e5f4a3b2c
```

## Security Best Practices

### ✅ DO:
- Store API keys in `.env` file (never commit to git)
- Use different API keys for development/staging/production
- Rotate keys every 90 days
- Limit key permissions to only what's needed
- Use environment-specific organizations

### ❌ DON'T:
- Commit `.env` to version control
- Share API keys in Slack/Discord/email
- Use production keys in development
- Store keys in frontend code
- Screenshot keys (they can be extracted)

## Troubleshooting

### Error: "Missing Turnkey configuration"

**Cause**: Environment variables not loaded

**Solution**:
```bash
# Make sure .env file exists and has values
cat .env | grep TURNKEY

# Restart your dev server
npm run dev
```

### Error: "Unauthorized" or "Invalid API key"

**Cause**: Wrong API keys or organization ID

**Solution**:
1. Double-check you copied the entire key (no spaces/newlines)
2. Verify organization ID matches your Turnkey dashboard
3. Regenerate API keys if needed

### Error: "Insufficient permissions"

**Cause**: API key doesn't have required permissions

**Solution**:
1. Go to Turnkey dashboard → API Keys
2. Find your key
3. Edit permissions to include:
   - Create Wallets
   - Sign Transactions
   - Read Wallets

## Pricing

Turnkey pricing (as of 2025):
- **Wallet Creation**: $0.02 per wallet
- **Transaction Signing**: $0.002 per signature
- **No monthly minimum**

Example costs:
- 100 wallets + 1,000 transactions/month = $4/month
- 1,000 wallets + 10,000 transactions/month = $40/month

## Next Steps

After setting up Turnkey:

1. ✅ Configure Reown AppKit project ID (see below)
2. ✅ Start dev server: `npm run dev`
3. ✅ Visit dashboard: http://localhost:3402/dashboard
4. ✅ Test wallet creation

---

## Bonus: Reown AppKit Setup

### Get Reown Project ID

1. Go to [https://cloud.reown.com](https://cloud.reown.com)
2. Sign in with GitHub or email
3. Click **"Create New Project"**
4. Enter project name: `x402 Facilitator`
5. **Copy Project ID** → `NEXT_PUBLIC_REOWN_PROJECT_ID`

Add to `.env`:
```bash
NEXT_PUBLIC_REOWN_PROJECT_ID=abc123def456ghi789
```

**Cost**: FREE (unlimited users)

## Support

- **Turnkey Docs**: https://docs.turnkey.com
- **Turnkey Discord**: https://discord.gg/turnkey
- **Reown Docs**: https://docs.reown.com
