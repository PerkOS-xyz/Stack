# Thirdweb Setup Guide - Complete Guide

## Overview

Thirdweb provides secure wallet infrastructure with embedded wallets stored in AWS enclaves. This guide shows you how to set up Thirdweb for production gas sponsorship.

## Step 1: Create Thirdweb Account

1. Go to [https://thirdweb.com/dashboard](https://thirdweb.com/dashboard)
2. Click **"Get Started"** or **"Sign In"**
3. Connect with:
   - Email
   - Google
   - GitHub
   - Or any Web3 wallet

## Step 2: Create API Keys

### Get Client ID and Secret Key

1. In Thirdweb dashboard, go to **Settings** (gear icon)
2. Click **"API Keys"** in the left sidebar
3. Click **"Create API Key"**
4. Enter key name: `x402-facilitator-production`
5. Click **"Create"**

**IMPORTANT: Save these immediately - Secret Key won't be shown again!**

You'll receive:
- **Client ID** (public) → `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- **Secret Key** (private) → `THIRDWEB_SECRET_KEY`

### Security Settings

In the API Key settings:
- ✅ **Allowed Domains**: Add your production domain
- ✅ **Allowed Bundle IDs**: Add your app bundle ID (if mobile)
- ✅ **Enable Services**:
  - Storage ✅
  - RPC Edge ✅
  - Embedded Wallets ✅ (IMPORTANT)

## Step 3: Generate Encryption Key

The system encrypts private keys before storing in database. Generate a secure 64-character hex key:

```bash
# Generate encryption key
openssl rand -hex 32
```

This outputs something like:
```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

**⚠️ SAVE THIS KEY SECURELY - You cannot recover wallets without it!**

## Step 4: Add to .env File

Open your `.env` file and add:

```bash
# ============ Thirdweb Configuration ============
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your-actual-client-id-here
THIRDWEB_SECRET_KEY=your-actual-secret-key-here

# Wallet Encryption Key (from Step 3)
WALLET_ENCRYPTION_KEY=your-64-character-hex-key-here

# ============ Reown AppKit Configuration ============
NEXT_PUBLIC_REOWN_PROJECT_ID=your-reown-project-id
```

### Example (with fake values):

```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=8f7a3c2b1d4e5f6a9b8c7d6e5f4a3b2c
THIRDWEB_SECRET_KEY=sk_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
WALLET_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
NEXT_PUBLIC_REOWN_PROJECT_ID=abc123def456ghi789
```

## Step 5: Reown AppKit Setup (for Login)

1. Go to [https://cloud.reown.com](https://cloud.reown.com)
2. Sign in with GitHub or email
3. Click **"Create New Project"**
4. Enter project name: `x402 Facilitator`
5. **Copy Project ID** → `NEXT_PUBLIC_REOWN_PROJECT_ID`

Add to `.env` (see above)

## Step 6: Verify Configuration

Test that everything works:

```bash
# Create test script
cat > test-thirdweb.ts << 'EOF'
import { getThirdwebService } from './lib/services/ThirdwebService';

async function test() {
  try {
    const thirdweb = getThirdwebService();
    console.log('✅ Thirdweb service initialized successfully!');

    // Test wallet creation
    const wallet = await thirdweb.createWallet('0x1234567890123456789012345678901234567890', 'avalanche');
    console.log('✅ Test wallet created:', wallet.address);
    console.log('Wallet ID:', wallet.walletId);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

test();
EOF

# Run test
npx tsx test-thirdweb.ts
```

Expected output:
```
✅ Thirdweb service initialized successfully!
✅ Test wallet created: 0x...
Wallet ID: tw-1234567890-123456
```

## Step 7: Start Development Server

```bash
npm run dev
```

Visit: [http://localhost:3402/dashboard](http://localhost:3402/dashboard)

## How It Works

### Security Architecture

1. **Wallet Creation**:
   - User logs in with Reown AppKit
   - Click "Create Sponsor Wallet"
   - Thirdweb generates private key client-side
   - Private key encrypted with AES-256-GCM
   - Encrypted key stored in Supabase
   - **Original private key NEVER stored unencrypted**

2. **Transaction Signing**:
   - API retrieves encrypted private key from database
   - Decrypt in memory (only during signing)
   - Sign transaction using Thirdweb SDK
   - Encrypted key returned to database
   - **Private key exists in memory for <100ms**

3. **Encryption Details**:
   - Algorithm: AES-256-GCM (Authenticated Encryption)
   - Key: 256-bit (from `WALLET_ENCRYPTION_KEY`)
   - IV: Random 128-bit (generated per encryption)
   - Auth Tag: 128-bit (prevents tampering)
   - Format: `iv:authTag:encrypted` (hex encoded)

### Comparison: Thirdweb vs Turnkey

| Feature | Thirdweb | Turnkey |
|---------|----------|---------|
| **Private Key Storage** | Encrypted in database | AWS Nitro Enclave (never exposed) |
| **Setup Complexity** | Simple (2 env vars) | Complex (org + API keys) |
| **Cost** | FREE tier → $99/mo | $10-20/month (usage-based) |
| **Performance** | <50ms signing | 50-100ms signing |
| **Security** | AES-256-GCM encryption | Hardware TEE isolation |
| **Recommended For** | Startups, MVPs | Enterprise, high-security |

## Security Best Practices

### ✅ DO:
- Use different API keys for development/staging/production
- Store `WALLET_ENCRYPTION_KEY` in secure vault (never commit to git)
- Rotate encryption key every 90 days (requires re-encrypting wallets)
- Use environment-specific Thirdweb projects
- Enable IP whitelisting in Thirdweb dashboard
- Monitor API usage for suspicious activity

### ❌ DON'T:
- Commit `.env` to version control
- Share API keys in Slack/Discord/email
- Use production keys in development
- Store keys in frontend code
- Log decrypted private keys
- Screenshot keys or encryption output

## Troubleshooting

### Error: "Missing Thirdweb configuration"

**Cause**: Environment variables not loaded

**Solution**:
```bash
# Check .env file
cat .env | grep THIRDWEB

# Restart dev server
npm run dev
```

### Error: "WALLET_ENCRYPTION_KEY must be set and at least 32 characters"

**Cause**: Missing or too short encryption key

**Solution**:
```bash
# Generate new key
openssl rand -hex 32

# Add to .env
WALLET_ENCRYPTION_KEY=paste-output-here
```

### Error: "Failed to decrypt private key"

**Cause**: Wrong encryption key or corrupted data

**Solution**:
- Verify `WALLET_ENCRYPTION_KEY` matches the one used to encrypt
- Check database for corrupted `encrypted_private_key` values
- If key was rotated, wallets need re-encryption

### Error: "Unauthorized" or "Invalid API key"

**Cause**: Wrong API keys

**Solution**:
1. Verify keys in Thirdweb dashboard → Settings → API Keys
2. Check no extra spaces/newlines when copying
3. Regenerate keys if needed

## Pricing

### Thirdweb Pricing (2025)

**Free Tier**:
- Unlimited API calls
- Embedded Wallets: Free
- RPC Edge: 1M requests/month
- Storage: 10GB

**Starter ($99/month)**:
- Everything in Free
- Higher rate limits
- Email support

**Growth ($299/month)**:
- Everything in Starter
- Dedicated support
- Custom contracts
- Priority RPC

**For 1,000 wallets + 10,000 tx/month**:
- **Free tier works perfectly!** ✅

### Cost Comparison

| Provider | Monthly Cost (1K wallets, 10K tx) |
|----------|-----------------------------------|
| **Thirdweb** | **$0** (Free tier) |
| Turnkey | $40-60 |
| Privy | $120 |
| Dynamic | $150-300 |
| Coinbase WaaS | $500+ |

## Migration from Turnkey (if applicable)

If you previously set up Turnkey:

1. Wallets created with Turnkey will continue to work
2. New wallets will use Thirdweb
3. No data migration needed (different `wallet_id` format)
4. Can remove Turnkey env vars after testing

## Next Steps

After setup:

1. ✅ Test wallet creation in dashboard
2. ✅ Fund a test wallet
3. ✅ Configure sponsor rules
4. ✅ Test gas payment flow
5. ✅ Set up monitoring

## Support

- **Thirdweb Docs**: https://portal.thirdweb.com
- **Thirdweb Discord**: https://discord.gg/thirdweb
- **Reown Docs**: https://docs.reown.com
- **AES-256-GCM Spec**: https://csrc.nist.gov/publications/detail/sp/800-38d/final

## Advanced: Key Rotation

To rotate the encryption key:

```typescript
// Script: rotate-encryption-key.ts
import { getThirdwebService } from './lib/services/ThirdwebService';
import { supabase } from './lib/db/supabase';

async function rotateKeys() {
  const oldKey = process.env.WALLET_ENCRYPTION_KEY;
  const newKey = process.env.NEW_WALLET_ENCRYPTION_KEY;

  // 1. Get all wallets
  const { data: wallets } = await supabase
    .from('perkos_sponsor_wallets')
    .select('*');

  // 2. Re-encrypt each wallet
  for (const wallet of wallets) {
    // Decrypt with old key
    const privateKey = await decryptWithKey(wallet.encrypted_private_key, oldKey);

    // Encrypt with new key
    const newEncrypted = await encryptWithKey(privateKey, newKey);

    // Update database
    await supabase
      .from('perkos_sponsor_wallets')
      .update({ encrypted_private_key: newEncrypted })
      .eq('id', wallet.id);
  }

  console.log(`✅ Rotated ${wallets.length} wallet keys`);
}
```
