# Gas Sponsorship System Design

Complete architecture for implementing user-funded gas sponsorship in the x402 facilitator.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Architecture Options](#architecture-options)
4. [Recommended Implementation](#recommended-implementation)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Integration Flow](#integration-flow)
8. [Security Considerations](#security-considerations)
9. [Implementation Plan](#implementation-plan)

---

## Problem Statement

**Current Issue**: The facilitator server pays gas fees for all settlement transactions, creating:
- **Financial burden** on the facilitator operator
- **Scalability bottleneck** as transaction volume grows
- **No monetization** mechanism for gas costs
- **Centralized cost** structure

**Desired Solution**: User-funded gas sponsorship system where:
- Users can create and fund sponsor wallets
- Sponsor wallets pay gas fees for specific domains/agents
- Facilitator tracks usage and provides analytics
- Users control spending limits and access policies

---

## Solution Overview

### Core Concept

Users authenticate, create sponsor wallets, deposit funds, and configure sponsorship rules (domain, agent, spending limits). When settlement occurs, the system selects the appropriate sponsor wallet to pay gas fees instead of the facilitator's wallet.

```
User Dashboard
    ↓ (authenticate)
    ↓ (create sponsor wallet)
    ↓ (deposit funds)
    ↓ (configure rules: domain/agent/limits)
    ↓
Sponsor Wallet Pool
    ↓ (settlement request)
    ↓ (match sponsor by domain/agent)
    ↓ (deduct gas from sponsor balance)
    ↓
Settlement Transaction
    (sponsor wallet pays gas)
```

### Key Features

1. **User Authentication**: Login via Privy (email/social) or wallet
2. **Wallet Creation**: Auto-generated server wallets per user
3. **Funding**: Deposit native tokens (AVAX, CELO, ETH) to sponsor wallet
4. **Access Control**: Whitelist domains, agents, or API endpoints
5. **Spending Limits**: Daily/monthly caps, per-transaction limits
6. **Analytics**: Real-time usage tracking, cost breakdown, transaction history
7. **Multi-Network**: Separate sponsor wallets per chain

---

## Architecture Options

### Option 1: Privy Server Wallets (Recommended)

**Description**: Use Privy's server wallet API to create and manage sponsor wallets.

**Pros**:
- ✅ **Enterprise-grade security**: SOC 2 compliant, hardware-secured wallets
- ✅ **Simple API**: Create wallets, sign transactions via REST API
- ✅ **Automatic gas management**: Never worry about topping up wallets
- ✅ **Multi-chain support**: EVM, Solana, Bitcoin
- ✅ **Built-in monitoring**: Transaction tracking and analytics

**Cons**:
- ❌ **Vendor lock-in**: Dependency on Privy infrastructure
- ❌ **Cost**: Monthly fees + per-wallet pricing (~$0.01-0.10/wallet/month)
- ❌ **API limits**: Rate limits on wallet creation and transactions

**Implementation**:
```typescript
// Create sponsor wallet via Privy API
const wallet = await privyClient.createServerWallet({
  userId: user.id,
  chainType: 'ethereum',
  metadata: {
    purpose: 'gas-sponsorship',
    network: 'avalanche',
  }
});

// Sign transaction with sponsor wallet
const signature = await privyClient.signTransaction(wallet.id, {
  to: '0x...',
  value: '1000000',
  data: '0x...',
});
```

**Cost Estimate**:
- Setup: Free
- Wallet creation: ~$0.01/wallet
- Transaction signing: ~$0.001/signature
- Monthly hosting: ~$0.10/wallet/month

---

### Option 2: Custom Server Wallets (viem)

**Description**: Generate and manage wallets server-side using viem + encrypted private key storage.

**Pros**:
- ✅ **No vendor fees**: Only blockchain gas costs
- ✅ **Full control**: Custom logic, unlimited wallets
- ✅ **Simple integration**: Already using viem
- ✅ **No API limits**: No rate limits

**Cons**:
- ❌ **Security responsibility**: Must implement encryption, key management
- ❌ **Infrastructure overhead**: Database, backup, recovery systems
- ❌ **Compliance burden**: SOC 2, security audits required for production

**Implementation**:
```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';

// Generate new sponsor wallet
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

// Encrypt private key before storing
const encryptedKey = encrypt(privateKey, process.env.ENCRYPTION_KEY);

// Store in database
await supabase.from('perkos_sponsor_wallets').insert({
  user_id: userId,
  address: account.address,
  encrypted_private_key: encryptedKey,
  network: 'avalanche',
  balance: '0',
});

// Later: Decrypt and sign transaction
const decryptedKey = decrypt(encryptedKey, process.env.ENCRYPTION_KEY);
const account = privateKeyToAccount(decryptedKey);
const hash = await walletClient.sendTransaction({
  account,
  to: '0x...',
  value: parseEther('1'),
});
```

**Security Requirements**:
- 🔐 AES-256-GCM encryption for private keys
- 🔐 Hardware Security Module (HSM) for encryption keys
- 🔐 Key rotation policy (90 days)
- 🔐 Audit logging for all key access
- 🔐 Multi-signature for high-value wallets

---

### Option 3: ERC-4337 Account Abstraction + Paymaster

**Description**: Use ERC-4337 smart accounts with third-party paymaster (Pimlico, Gelato, Stackup).

**Pros**:
- ✅ **Native gas sponsorship**: Built into ERC-4337 standard
- ✅ **Flexible policies**: Complex sponsorship rules (per-user limits, allowlists)
- ✅ **No private key management**: User operations, not transactions
- ✅ **Production-ready**: Pimlico/Gelato support 30-100+ chains
- ✅ **ERC-20 gas payment**: Users can pay gas in USDC/DAI

**Cons**:
- ❌ **Network support**: Not all chains support ERC-4337 (Avalanche limited)
- ❌ **Complexity**: Requires UserOperation flow, bundlers, entry points
- ❌ **Service fees**: 10-20% markup on gas costs
- ❌ **Migration effort**: Significant code changes required

**Implementation**:
```typescript
import { pimlico } from '@pimlico/permissionless';

// Create smart account
const smartAccount = await createSmartAccount({
  owner: userWallet,
  chain: 'base',
});

// Create sponsored user operation
const userOp = await pimlico.sponsorUserOperation({
  userOperation: {
    sender: smartAccount.address,
    callData: callData,
  },
  sponsorshipPolicyId: 'sp_...',
});

// Submit to bundler
const txHash = await bundler.sendUserOperation(userOp);
```

**Service Comparison**:

| Provider | Chains | Pricing | Features |
|----------|--------|---------|----------|
| **Pimlico** | 30+ | 15-20% markup | Verifying + ERC-20 paymasters, sponsorship policies |
| **Gelato** | 100+ | 10-15% markup | Fastest bundler, OneBalance gas tank, unified management |
| **Stackup** | 20+ | Variable | Developer-friendly SDK, simple integration |

---

### Option 4: Hybrid Approach

**Description**: Combine server wallets (Option 2) with optional ERC-4337 paymaster for supported chains.

**Pros**:
- ✅ **Best of both worlds**: Custom wallets + AA where supported
- ✅ **Maximum flexibility**: Choose strategy per network
- ✅ **Cost optimization**: Use cheapest option per transaction
- ✅ **Future-proof**: Ready for AA adoption

**Cons**:
- ❌ **Complex implementation**: Two separate code paths
- ❌ **Maintenance overhead**: Manage both systems
- ❌ **Testing complexity**: More edge cases

**Strategy**:
```typescript
async function selectGasSponsor(network: string, domain: string) {
  // Check if network supports ERC-4337
  if (supportsAccountAbstraction(network)) {
    // Try to use paymaster first (better UX)
    const paymaster = await getPaymaster(network, domain);
    if (paymaster && paymaster.hasBalance) {
      return { type: 'paymaster', service: paymaster };
    }
  }

  // Fallback to server wallet
  const wallet = await getSponsorWallet(network, domain);
  return { type: 'server-wallet', wallet };
}
```

---

## Recommended Implementation

**Choice**: **Option 2 (Custom Server Wallets)** with **Option 3 (ERC-4337) migration path**

**Rationale**:
1. **Cost-effective**: No vendor fees, only gas costs
2. **Full control**: Custom sponsorship logic per domain/agent
3. **Multi-chain**: Works on all EVM chains (Avalanche, Celo, Base)
4. **Migration path**: Can add ERC-4337 later for supported chains
5. **Existing stack**: Leverages viem already in use

**Phase 1**: Custom server wallets (3-5 days)
**Phase 2**: Dashboard UI + analytics (5-7 days)
**Phase 3**: ERC-4337 integration for Base/Celo (optional, 7-10 days)

---

## Database Schema

### New Tables

```sql
-- Sponsor wallets (one per user per network)
CREATE TABLE perkos_sponsor_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('avalanche', 'avalanche-fuji', 'base', 'base-sepolia', 'celo', 'celo-alfajores')),
    chain_id INTEGER NOT NULL,
    address TEXT NOT NULL UNIQUE,
    encrypted_private_key TEXT NOT NULL,
    balance TEXT NOT NULL DEFAULT '0', -- Native token balance (wei)
    total_deposited TEXT NOT NULL DEFAULT '0',
    total_spent TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sponsor wallet deposits
CREATE TABLE perkos_sponsor_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL UNIQUE,
    from_address TEXT NOT NULL,
    amount TEXT NOT NULL, -- Native token amount (wei)
    network TEXT NOT NULL,
    block_number BIGINT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sponsor access rules (domain/agent whitelist)
CREATE TABLE perkos_sponsor_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('domain', 'agent', 'endpoint', 'all')),
    rule_value TEXT, -- domain name, agent address, endpoint path, or null for 'all'
    daily_limit TEXT, -- Max spend per day (wei), null = unlimited
    monthly_limit TEXT, -- Max spend per month (wei), null = unlimited
    per_tx_limit TEXT, -- Max spend per transaction (wei), null = unlimited
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sponsor usage tracking
CREATE TABLE perkos_sponsor_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES perkos_sponsor_wallets(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES perkos_transactions(id) ON DELETE SET NULL,
    tx_hash TEXT NOT NULL,
    gas_used BIGINT NOT NULL,
    gas_price TEXT NOT NULL, -- Wei
    gas_cost TEXT NOT NULL, -- Total cost in wei
    network TEXT NOT NULL,
    matched_rule_id UUID REFERENCES perkos_sponsor_rules(id) ON DELETE SET NULL,
    domain TEXT,
    agent_address TEXT,
    endpoint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User authentication (for dashboard)
CREATE TABLE perkos_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    wallet_address TEXT UNIQUE,
    auth_provider TEXT NOT NULL CHECK (auth_provider IN ('privy', 'wallet', 'email')),
    external_user_id TEXT, -- Privy user ID
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_sponsor_wallets_user ON perkos_sponsor_wallets(user_id);
CREATE INDEX idx_sponsor_wallets_network ON perkos_sponsor_wallets(network);
CREATE INDEX idx_sponsor_wallets_address ON perkos_sponsor_wallets(address);

CREATE INDEX idx_sponsor_deposits_wallet ON perkos_sponsor_deposits(wallet_id);
CREATE INDEX idx_sponsor_deposits_status ON perkos_sponsor_deposits(status);
CREATE INDEX idx_sponsor_deposits_tx_hash ON perkos_sponsor_deposits(tx_hash);

CREATE INDEX idx_sponsor_rules_wallet ON perkos_sponsor_rules(wallet_id);
CREATE INDEX idx_sponsor_rules_type ON perkos_sponsor_rules(rule_type);
CREATE INDEX idx_sponsor_rules_enabled ON perkos_sponsor_rules(enabled);

CREATE INDEX idx_sponsor_usage_wallet ON perkos_sponsor_usage(wallet_id);
CREATE INDEX idx_sponsor_usage_tx ON perkos_sponsor_usage(transaction_id);
CREATE INDEX idx_sponsor_usage_created ON perkos_sponsor_usage(created_at);

CREATE INDEX idx_users_email ON perkos_users(email);
CREATE INDEX idx_users_wallet ON perkos_users(wallet_address);
CREATE INDEX idx_users_external_id ON perkos_users(external_user_id);

-- RLS Policies
ALTER TABLE perkos_sponsor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_sponsor_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_sponsor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_sponsor_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own sponsor wallets" ON perkos_sponsor_wallets
    FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can view own deposits" ON perkos_sponsor_deposits
    FOR SELECT USING (
        wallet_id IN (SELECT id FROM perkos_sponsor_wallets WHERE user_id = auth.uid()::uuid)
    );

CREATE POLICY "Users can manage own rules" ON perkos_sponsor_rules
    FOR ALL USING (
        wallet_id IN (SELECT id FROM perkos_sponsor_wallets WHERE user_id = auth.uid()::uuid)
    );

CREATE POLICY "Users can view own usage" ON perkos_sponsor_usage
    FOR SELECT USING (
        wallet_id IN (SELECT id FROM perkos_sponsor_wallets WHERE user_id = auth.uid()::uuid)
    );

-- Facilitator (service role) can insert usage records
CREATE POLICY "Service can insert usage records" ON perkos_sponsor_usage
    FOR INSERT WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION update_sponsor_wallet_balance(
    wallet_id UUID,
    amount TEXT,
    operation TEXT -- 'deposit' or 'spend'
) RETURNS VOID AS $$
BEGIN
    IF operation = 'deposit' THEN
        UPDATE perkos_sponsor_wallets
        SET
            balance = (CAST(balance AS NUMERIC) + CAST(amount AS NUMERIC))::TEXT,
            total_deposited = (CAST(total_deposited AS NUMERIC) + CAST(amount AS NUMERIC))::TEXT,
            updated_at = NOW()
        WHERE id = wallet_id;
    ELSIF operation = 'spend' THEN
        UPDATE perkos_sponsor_wallets
        SET
            balance = (CAST(balance AS NUMERIC) - CAST(amount AS NUMERIC))::TEXT,
            total_spent = (CAST(total_spent AS NUMERIC) + CAST(amount AS NUMERIC))::TEXT,
            updated_at = NOW()
        WHERE id = wallet_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update wallet balance on deposit confirmation
CREATE OR REPLACE FUNCTION on_deposit_confirmed() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        PERFORM update_sponsor_wallet_balance(NEW.wallet_id, NEW.amount, 'deposit');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deposit_confirmed
    AFTER UPDATE ON perkos_sponsor_deposits
    FOR EACH ROW
    EXECUTE FUNCTION on_deposit_confirmed();

-- Trigger to update wallet balance on usage
CREATE OR REPLACE FUNCTION on_sponsor_usage() RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_sponsor_wallet_balance(NEW.wallet_id, NEW.gas_cost, 'spend');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sponsor_usage
    AFTER INSERT ON perkos_sponsor_usage
    FOR EACH ROW
    EXECUTE FUNCTION on_sponsor_usage();
```

---

## API Design

### Authentication Endpoints

```typescript
// POST /api/auth/login
interface LoginRequest {
  provider: 'privy' | 'wallet' | 'email';
  token?: string; // Privy token or wallet signature
  email?: string; // For email login
  walletAddress?: string; // For wallet login
}

interface LoginResponse {
  success: boolean;
  userId: string;
  sessionToken: string;
  user: {
    id: string;
    email?: string;
    walletAddress?: string;
    displayName?: string;
  };
}

// POST /api/auth/logout
interface LogoutRequest {
  sessionToken: string;
}
```

### Sponsor Wallet Endpoints

```typescript
// POST /api/sponsors/wallets/create
interface CreateWalletRequest {
  network: 'avalanche' | 'base' | 'celo';
  testnet?: boolean;
}

interface CreateWalletResponse {
  success: boolean;
  wallet: {
    id: string;
    address: string;
    network: string;
    balance: string; // Wei
  };
}

// GET /api/sponsors/wallets
interface GetWalletsResponse {
  success: boolean;
  wallets: Array<{
    id: string;
    address: string;
    network: string;
    chainId: number;
    balance: string;
    totalDeposited: string;
    totalSpent: string;
    status: 'active' | 'paused' | 'suspended';
    createdAt: string;
  }>;
}

// POST /api/sponsors/wallets/:id/deposit-address
interface DepositAddressResponse {
  success: boolean;
  depositAddress: string; // Same as wallet address
  network: string;
  chainId: number;
  qrCode?: string; // Base64 QR code image
}

// GET /api/sponsors/wallets/:id/balance
interface BalanceResponse {
  success: boolean;
  balance: string; // Wei
  balanceFormatted: string; // Human-readable (e.g., "1.5 AVAX")
  usdValue?: string;
}
```

### Sponsor Rules Endpoints

```typescript
// POST /api/sponsors/rules/create
interface CreateRuleRequest {
  walletId: string;
  ruleType: 'domain' | 'agent' | 'endpoint' | 'all';
  ruleValue?: string; // domain, agent address, endpoint path
  dailyLimit?: string; // Wei
  monthlyLimit?: string; // Wei
  perTxLimit?: string; // Wei
}

interface CreateRuleResponse {
  success: boolean;
  rule: {
    id: string;
    ruleType: string;
    ruleValue?: string;
    dailyLimit?: string;
    monthlyLimit?: string;
    perTxLimit?: string;
    enabled: boolean;
  };
}

// GET /api/sponsors/rules?walletId=...
interface GetRulesResponse {
  success: boolean;
  rules: Array<{
    id: string;
    ruleType: string;
    ruleValue?: string;
    dailyLimit?: string;
    monthlyLimit?: string;
    perTxLimit?: string;
    enabled: boolean;
    createdAt: string;
  }>;
}

// PATCH /api/sponsors/rules/:id
interface UpdateRuleRequest {
  dailyLimit?: string;
  monthlyLimit?: string;
  perTxLimit?: string;
  enabled?: boolean;
}

// DELETE /api/sponsors/rules/:id
```

### Usage Analytics Endpoints

```typescript
// GET /api/sponsors/usage?walletId=...&startDate=...&endDate=...
interface UsageResponse {
  success: boolean;
  usage: {
    totalGasCost: string; // Wei
    totalTransactions: number;
    averageGasPerTx: string;
    breakdown: {
      byNetwork: Record<string, {
        gasCost: string;
        txCount: number;
      }>;
      byDomain: Record<string, {
        gasCost: string;
        txCount: number;
      }>;
      byAgent: Record<string, {
        gasCost: string;
        txCount: number;
      }>;
    };
    timeline: Array<{
      date: string;
      gasCost: string;
      txCount: number;
    }>;
  };
}

// GET /api/sponsors/usage/transactions?walletId=...&limit=50
interface TransactionsResponse {
  success: boolean;
  transactions: Array<{
    id: string;
    txHash: string;
    gasUsed: number;
    gasPrice: string;
    gasCost: string;
    network: string;
    domain?: string;
    agentAddress?: string;
    endpoint?: string;
    createdAt: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

---

## Integration Flow

### 1. User Onboarding

```typescript
// User visits dashboard → Login with Privy
const user = await privy.login({ provider: 'google' });

// Create sponsor wallet for each network
for (const network of ['avalanche', 'base', 'celo']) {
  const wallet = await createSponsorWallet({
    userId: user.id,
    network,
  });

  console.log(`Created ${network} wallet: ${wallet.address}`);
}
```

### 2. Funding Sponsor Wallet

```typescript
// User deposits native tokens to sponsor wallet
const depositAddress = await getDepositAddress(walletId);

// Show QR code + address to user
// User sends AVAX/ETH/CELO to depositAddress

// Monitor blockchain for deposit
const indexer = new DepositIndexer();
indexer.on('deposit', async (deposit) => {
  // Record deposit in database
  await supabase.from('perkos_sponsor_deposits').insert({
    wallet_id: deposit.walletId,
    tx_hash: deposit.txHash,
    from_address: deposit.from,
    amount: deposit.amount,
    network: deposit.network,
    block_number: deposit.blockNumber,
    status: 'confirmed',
  });

  // Update wallet balance (handled by trigger)
});
```

### 3. Configuring Sponsorship Rules

```typescript
// User creates rule: sponsor gas for specific domain
await createSponsorRule({
  walletId: walletId,
  ruleType: 'domain',
  ruleValue: 'example.com',
  dailyLimit: parseEther('0.1').toString(), // 0.1 AVAX/day
  perTxLimit: parseEther('0.01').toString(), // 0.01 AVAX/tx
});

// Or sponsor for specific agent
await createSponsorRule({
  walletId: walletId,
  ruleType: 'agent',
  ruleValue: '0x1234...5678', // Agent's wallet address
  monthlyLimit: parseEther('1').toString(), // 1 AVAX/month
});

// Or sponsor all requests (no restrictions)
await createSponsorRule({
  walletId: walletId,
  ruleType: 'all',
  dailyLimit: parseEther('0.5').toString(),
});
```

### 4. Payment Settlement with Sponsorship

```typescript
// Modified settlement flow in ExactSchemeService
async settle(
  payload: ExactPayload,
  requirements: PaymentRequirements,
  requestMetadata?: {
    domain?: string;
    agentAddress?: string;
    endpoint?: string;
  }
): Promise<SettleResponse> {
  // Find matching sponsor wallet
  const sponsor = await findSponsorWallet({
    network: this.network,
    domain: requestMetadata?.domain,
    agentAddress: requestMetadata?.agentAddress,
    endpoint: requestMetadata?.endpoint,
  });

  // Use sponsor wallet if found, otherwise use facilitator wallet
  const walletClient = sponsor
    ? await createSponsorWalletClient(sponsor)
    : this.walletClient; // Facilitator wallet (fallback)

  // Estimate gas cost
  const gasEstimate = await this.publicClient.estimateGas({
    account: walletClient.account,
    to: requirements.asset,
    data: encodeFunctionData({
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [...],
    }),
  });

  const gasPrice = await this.publicClient.getGasPrice();
  const gasCost = gasEstimate * gasPrice;

  // Check sponsor balance + limits
  if (sponsor) {
    const canSponsor = await validateSponsorLimits({
      walletId: sponsor.id,
      gasCost: gasCost.toString(),
      domain: requestMetadata?.domain,
    });

    if (!canSponsor) {
      // Fallback to facilitator wallet
      walletClient = this.walletClient;
      sponsor = null;
    }
  }

  // Submit transaction
  const hash = await walletClient.writeContract({
    address: requirements.asset,
    abi: TRANSFER_WITH_AUTHORIZATION_ABI,
    functionName: 'transferWithAuthorization',
    args: [...],
  });

  const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

  // Record sponsor usage
  if (sponsor && receipt.status === 'success') {
    await supabase.from('perkos_sponsor_usage').insert({
      wallet_id: sponsor.id,
      tx_hash: hash,
      gas_used: Number(receipt.gasUsed),
      gas_price: gasPrice.toString(),
      gas_cost: (receipt.gasUsed * gasPrice).toString(),
      network: this.network,
      domain: requestMetadata?.domain,
      agent_address: requestMetadata?.agentAddress,
      endpoint: requestMetadata?.endpoint,
    });
  }

  return {
    success: true,
    payer: authorization.from,
    transaction: hash,
    network: this.network,
    sponsoredBy: sponsor?.address, // NEW: Track which sponsor paid gas
  };
}
```

### 5. Sponsor Matching Algorithm

```typescript
async function findSponsorWallet(criteria: {
  network: string;
  domain?: string;
  agentAddress?: string;
  endpoint?: string;
}): Promise<SponsorWallet | null> {
  // Query sponsor wallets with matching rules
  const { data: wallets } = await supabase
    .from('perkos_sponsor_wallets')
    .select(`
      *,
      rules:perkos_sponsor_rules(*)
    `)
    .eq('network', criteria.network)
    .eq('status', 'active')
    .gt('balance', '0'); // Has balance

  if (!wallets || wallets.length === 0) return null;

  // Score each wallet based on rule matches
  const scored = wallets.map(wallet => {
    let score = 0;
    let matchedRule = null;

    for (const rule of wallet.rules) {
      if (!rule.enabled) continue;

      // Exact match > wildcard match
      if (rule.rule_type === 'domain' && rule.rule_value === criteria.domain) {
        score = Math.max(score, 100);
        matchedRule = rule;
      } else if (rule.rule_type === 'agent' && rule.rule_value === criteria.agentAddress) {
        score = Math.max(score, 90);
        matchedRule = rule;
      } else if (rule.rule_type === 'endpoint' && rule.rule_value === criteria.endpoint) {
        score = Math.max(score, 80);
        matchedRule = rule;
      } else if (rule.rule_type === 'all') {
        score = Math.max(score, 50);
        matchedRule = rule;
      }
    }

    return { wallet, score, matchedRule };
  });

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Return best match if score > 0
  return scored[0]?.score > 0 ? scored[0].wallet : null;
}

async function validateSponsorLimits(params: {
  walletId: string;
  gasCost: string;
  domain?: string;
}): Promise<boolean> {
  const { data: wallet } = await supabase
    .from('perkos_sponsor_wallets')
    .select('balance')
    .eq('id', params.walletId)
    .single();

  // Check balance
  if (BigInt(wallet.balance) < BigInt(params.gasCost)) {
    return false;
  }

  // Get active rules
  const { data: rules } = await supabase
    .from('perkos_sponsor_rules')
    .select('*')
    .eq('wallet_id', params.walletId)
    .eq('enabled', true);

  for (const rule of rules || []) {
    // Check per-transaction limit
    if (rule.per_tx_limit && BigInt(params.gasCost) > BigInt(rule.per_tx_limit)) {
      return false;
    }

    // Check daily limit
    if (rule.daily_limit) {
      const { data: todayUsage } = await supabase
        .from('perkos_sponsor_usage')
        .select('gas_cost')
        .eq('wallet_id', params.walletId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const dailyTotal = todayUsage?.reduce(
        (sum, u) => sum + BigInt(u.gas_cost),
        0n
      ) || 0n;

      if (dailyTotal + BigInt(params.gasCost) > BigInt(rule.daily_limit)) {
        return false;
      }
    }

    // Check monthly limit
    if (rule.monthly_limit) {
      const { data: monthUsage } = await supabase
        .from('perkos_sponsor_usage')
        .select('gas_cost')
        .eq('wallet_id', params.walletId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const monthlyTotal = monthUsage?.reduce(
        (sum, u) => sum + BigInt(u.gas_cost),
        0n
      ) || 0n;

      if (monthlyTotal + BigInt(params.gasCost) > BigInt(rule.monthly_limit)) {
        return false;
      }
    }
  }

  return true;
}
```

---

## Security Considerations

### 1. Private Key Encryption

```typescript
import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function encrypt(privateKey: string, masterKey: string): string {
  // Derive key from master key (use PBKDF2 or similar)
  const key = crypto.scryptSync(masterKey, 'salt', KEY_LENGTH);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + encrypted data
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

function decrypt(encryptedData: string, masterKey: string): string {
  // Derive key
  const key = crypto.scryptSync(masterKey, 'salt', KEY_LENGTH);

  // Extract IV, auth tag, and encrypted data
  const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
  const authTag = Buffer.from(
    encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
    'hex'
  );
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

  // Create decipher
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Best Practices**:
- 🔐 Store master encryption key in environment variable or HSM
- 🔐 Rotate encryption keys every 90 days
- 🔐 Use separate encryption keys per environment (dev/staging/prod)
- 🔐 Never log decrypted private keys
- 🔐 Implement key access audit logging

### 2. Rate Limiting

```typescript
// Rate limit sponsor wallet creation
const WALLET_CREATION_LIMIT = {
  perUser: 5, // Max 5 wallets per user per network
  perHour: 10, // Max 10 wallets per user per hour
};

// Rate limit deposit monitoring
const DEPOSIT_SCAN_INTERVAL = 12000; // 12 seconds

// Rate limit API endpoints
app.use('/api/sponsors', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
}));
```

### 3. Access Control

```typescript
// Middleware: Verify user owns the sponsor wallet
async function verifySponsorWalletOwnership(req, res, next) {
  const userId = req.user.id;
  const walletId = req.params.walletId || req.body.walletId;

  const { data: wallet } = await supabase
    .from('perkos_sponsor_wallets')
    .select('user_id')
    .eq('id', walletId)
    .single();

  if (wallet?.user_id !== userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
}

// Apply to all sponsor endpoints
app.use('/api/sponsors/wallets/:walletId', verifySponsorWalletOwnership);
app.use('/api/sponsors/rules', verifySponsorWalletOwnership);
```

### 4. Spending Limits Validation

```typescript
// Validate limits before creating rule
function validateLimits(rule: CreateRuleRequest): boolean {
  const { dailyLimit, monthlyLimit, perTxLimit } = rule;

  // Monthly >= Daily >= Per-Tx
  if (dailyLimit && monthlyLimit && BigInt(dailyLimit) > BigInt(monthlyLimit)) {
    return false;
  }

  if (perTxLimit && dailyLimit && BigInt(perTxLimit) > BigInt(dailyLimit)) {
    return false;
  }

  // Reasonable maximums (prevent abuse)
  const MAX_DAILY = parseEther('10'); // 10 native tokens
  const MAX_MONTHLY = parseEther('100');
  const MAX_PER_TX = parseEther('1');

  if (dailyLimit && BigInt(dailyLimit) > MAX_DAILY) return false;
  if (monthlyLimit && BigInt(monthlyLimit) > MAX_MONTHLY) return false;
  if (perTxLimit && BigInt(perTxLimit) > MAX_PER_TX) return false;

  return true;
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-3)

**Tasks**:
1. ✅ Database schema (tables, indexes, triggers, RLS)
2. ✅ Wallet encryption/decryption utilities
3. ✅ Sponsor wallet service (create, fund, balance tracking)
4. ✅ Sponsor rule matching algorithm
5. ✅ Deposit indexing service

**Deliverables**:
- Database migration script
- `lib/services/SponsorWalletService.ts`
- `lib/services/DepositIndexer.ts`
- `lib/utils/encryption.ts`

### Phase 2: API Endpoints (Days 4-5)

**Tasks**:
1. ✅ Authentication endpoints (login/logout)
2. ✅ Wallet management APIs (create, list, balance)
3. ✅ Rule management APIs (create, update, delete, list)
4. ✅ Usage analytics APIs (stats, transactions)
5. ✅ API documentation (OpenAPI/Swagger)

**Deliverables**:
- `app/api/auth/*`
- `app/api/sponsors/wallets/*`
- `app/api/sponsors/rules/*`
- `app/api/sponsors/usage/*`

### Phase 3: Settlement Integration (Day 6)

**Tasks**:
1. ✅ Modify ExactSchemeService to use sponsor wallets
2. ✅ Modify DeferredSchemeService to use sponsor wallets
3. ✅ Add request metadata extraction (domain, agent, endpoint)
4. ✅ Implement sponsor selection + validation
5. ✅ Record sponsor usage in database

**Deliverables**:
- Updated `lib/services/ExactSchemeService.ts`
- Updated `lib/services/DeferredSchemeService.ts`
- Updated `lib/services/X402Service.ts`

### Phase 4: Dashboard UI (Days 7-10)

**Tasks**:
1. ✅ User authentication UI (Privy integration)
2. ✅ Wallet management page (create, view, fund)
3. ✅ Rule configuration page (create, edit, delete)
4. ✅ Usage analytics dashboard (charts, tables)
5. ✅ Transaction history page

**Deliverables**:
- `app/dashboard/page.tsx`
- `app/dashboard/wallets/page.tsx`
- `app/dashboard/rules/page.tsx`
- `app/dashboard/analytics/page.tsx`
- `components/sponsor/*`

### Phase 5: Testing & Documentation (Days 11-12)

**Tasks**:
1. ✅ Unit tests (services, utilities)
2. ✅ Integration tests (API endpoints)
3. ✅ End-to-end tests (full sponsorship flow)
4. ✅ Security audit (encryption, access control)
5. ✅ Documentation (user guide, API reference)

**Deliverables**:
- Test suites with >80% coverage
- `Documents/GAS_SPONSORSHIP_USER_GUIDE.md`
- `Documents/GAS_SPONSORSHIP_API_REFERENCE.md`

### Phase 6 (Optional): ERC-4337 Integration (Days 13-20)

**Tasks**:
1. ✅ Research Pimlico/Gelato paymaster integration
2. ✅ Implement smart account creation
3. ✅ Add UserOperation flow for Base/Celo
4. ✅ Hybrid sponsor selection (server wallet vs paymaster)
5. ✅ Performance benchmarking

**Deliverables**:
- `lib/services/PaymasterService.ts`
- Updated settlement services with AA support
- Performance comparison report

---

## Cost Analysis

### Monthly Operational Costs

**Custom Server Wallets (Option 2)**:
- Infrastructure: $0 (uses existing Supabase)
- Encryption: $0 (crypto library)
- Maintenance: ~2 hours/month = $100-200
- **Total**: ~$100-200/month

**Privy Server Wallets (Option 1)**:
- Base plan: $99/month
- Per wallet: $0.01/wallet/month
- Per signature: $0.001/signature
- 100 wallets, 10K tx/month: ~$99 + $1 + $10 = **$110/month**

**ERC-4337 Paymaster (Option 3)**:
- Pimlico: 15-20% markup on gas costs
- 10K tx/month, avg $0.10 gas: 10K × $0.10 × 1.15 = **$1,150/month**
- Gelato: 10-15% markup: 10K × $0.10 × 1.10 = **$1,100/month**

**Recommendation**: Start with **Option 2 (Custom Server Wallets)** for lowest cost.

---

## Related Documentation

- [PAYMENT_ENVELOPE_FLOW.md](PAYMENT_ENVELOPE_FLOW.md) - Payment settlement flow
- [DATABASE_TABLES.md](DATABASE_TABLES.md) - Current database schema
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Database configuration
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Production deployment

---

## Next Steps

1. **Review design**: Gather feedback on architecture choices
2. **Approve schema**: Confirm database tables and relationships
3. **Start Phase 1**: Begin implementation with core infrastructure
4. **Iterate**: Build incrementally with frequent testing
5. **Deploy**: Roll out to production with monitoring

**Estimated Timeline**: 12-15 working days for full implementation (Phases 1-5)
