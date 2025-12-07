# Gas Sponsorship System Setup Instructions

## 1. Database Setup

The database migration has been applied and created these tables:
- `perkos_sponsor_wallets` - Stores Turnkey wallet references
- `perkos_sponsor_rules` - Sponsor rule configurations
- `perkos_sponsor_transactions` - Transaction analytics
- `perkos_sponsor_wallet_analytics` - Aggregated wallet stats

✅ **Database schema is ready**

## 2. Turnkey Configuration

To enable production wallet creation, you need Turnkey API credentials:

### Get Turnkey Credentials

1. Go to [https://app.turnkey.com](https://app.turnkey.com)
2. Create an account or sign in
3. Create a new organization (if you don't have one)
4. Go to **Settings → API Keys**
5. Create a new API key pair
6. Copy your credentials

### Add to .env

```bash
# ============ Turnkey Configuration ============
TURNKEY_API_BASE_URL=https://api.turnkey.com
TURNKEY_ORGANIZATION_ID=your-org-id-here
TURNKEY_API_PUBLIC_KEY=your-public-key-here
TURNKEY_API_PRIVATE_KEY=your-private-key-here
```

### Add Reown Project ID

```bash
# ============ Reown AppKit Configuration ============
NEXT_PUBLIC_REOWN_PROJECT_ID=your-reown-project-id
```

Get this from [https://cloud.reown.com](https://cloud.reown.com)

## 3. Start Development Server

```bash
npm run dev
```

## 4. Access Dashboard

Navigate to: [http://localhost:3402/dashboard](http://localhost:3402/dashboard)

## 5. Test Wallet Creation

1. Click "Connect Wallet" button
2. Choose login method:
   - Social (Google, Apple, Discord, GitHub, X)
   - Email (passwordless OTP)
   - Any of 700+ wallets
3. After connecting, click one of:
   - "Create Avalanche Wallet"
   - "Create Base Wallet"
   - "Create Celo Wallet"
4. Turnkey will create a wallet in AWS Nitro Enclave
5. Wallet address will be displayed
6. Fund the wallet by sending native tokens to the sponsor address

## Architecture Summary

### Frontend (Reown AppKit)
- Social login (Google, Apple, Discord, GitHub, X)
- Email login (passwordless OTP)
- 700+ wallet connections
- User-friendly modal UI

### Backend (Turnkey)
- Wallets created in AWS Nitro Enclaves (TEE)
- Private keys NEVER stored in database
- Only `turnkey_wallet_id` stored as reference
- Signing via API (50-100ms latency)

### Flow
1. User logs in → Reown authenticates
2. User creates wallet → Turnkey generates in enclave
3. User funds wallet → Deposits to sponsor address
4. System pays gas → Turnkey signs transaction
5. No user intervention per transaction!

## Security Features

✅ Private keys in hardware-isolated enclaves
✅ Row Level Security (RLS) on all tables
✅ Users can only see their own wallets
✅ Network validation on wallet creation
✅ Duplicate wallet prevention

## Cost Estimate

- **Turnkey**: $0.02 per wallet creation + $0.002 per transaction
- **Reown AppKit**: Free
- **Estimated monthly cost** (1,000 wallets, 10,000 tx): ~$40-60/month

## Next Steps

1. Configure sponsor rules (domain/agent restrictions)
2. Add wallet funding interface
3. Implement analytics dashboard
4. Add transaction monitoring
5. Create rule management UI
