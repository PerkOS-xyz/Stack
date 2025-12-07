# Gas Sponsorship with Reown AppKit + Turnkey Integration

Complete implementation guide using **Reown AppKit** for user authentication (social login + wallet connect) and **Turnkey** for secure server-side sponsor wallets.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Why This Combination](#why-this-combination)
3. [User Flow](#user-flow)
4. [Implementation Guide](#implementation-guide)
5. [Complete Code Examples](#complete-code-examples)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
│                                                               │
│  Reown AppKit (Authentication Layer)                         │
│  ├── Social Login (Google, Apple, Discord)                   │
│  ├── Email Login (passwordless OTP)                          │
│  └── Wallet Connect (700+ wallets)                           │
│      → Creates Universal Wallet + Smart Account             │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   User Authenticated
                   (email, social, or wallet)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  SPONSOR WALLET SYSTEM                       │
│                                                               │
│  Turnkey (Server-Side Wallet Infrastructure)                │
│  ├── Create sponsor wallet per user per network             │
│  ├── User funds wallet (deposit AVAX/ETH/CELO)              │
│  ├── User configures sponsorship rules                      │
│  └── NO PRIVATE KEYS STORED (AWS Nitro Enclaves)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   x402 Payment Request
                   (domain: example.com)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│               AUTOMATIC GAS SPONSORSHIP                      │
│                                                               │
│  1. Match sponsor wallet (domain/agent rules)                │
│  2. Validate balance + limits                                │
│  3. Sign transaction via Turnkey API (NO user action)        │
│  4. Broadcast to blockchain                                  │
│  5. Deduct gas from sponsor wallet balance                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Why This Combination

### Reown AppKit (Authentication)

**Features**:
- ✅ Social login: Google, Apple, Discord, GitHub, Facebook, X (Twitter)
- ✅ Email login: Passwordless OTP
- ✅ Wallet Connect: 700+ wallets (MetaMask, Coinbase, Rainbow, etc.)
- ✅ Universal Wallet: Auto-created for email/social users
- ✅ Smart Accounts: Built-in account abstraction
- ✅ **Free**: No monthly fees for authentication
- ✅ Next.js ready: `@reown/appkit` npm package

**Why Use It**:
- Users can choose their preferred login method
- No need to build custom auth (social OAuth, email verification)
- Works seamlessly with existing Web3 wallets
- Creates non-custodial wallet for Web2 users automatically

### Turnkey (Sponsor Wallets)

**Features**:
- ✅ Server-side wallets (NO private key storage)
- ✅ AWS Nitro Enclaves (50-100ms signing)
- ✅ All EVM chains (Avalanche, Base, Celo)
- ✅ Low cost: ~$1-2/month for 10K transactions
- ✅ Policy-based access control

**Why Use It**:
- Users fund sponsor wallets to pay gas fees
- Facilitator signs transactions automatically (no user intervention)
- Keys never leave secure enclaves
- Perfect for programmatic gas sponsorship

---

## User Flow

### Phase 1: User Onboarding

```typescript
// 1. User visits dashboard → Reown AppKit modal appears
<AppKitButton /> // Opens modal with login options

// 2. User chooses login method:
//    - Google → OAuth redirect → Universal Wallet created
//    - Email → OTP sent → Universal Wallet created
//    - MetaMask → Wallet Connect → Existing wallet connected

// 3. User authenticated, wallet address retrieved
const { address, isConnected } = useAccount(); // Wagmi hook
```

**User sees**:
```
┌─────────────────────────────────────┐
│      Connect Your Wallet            │
│                                     │
│  [🔵 Continue with Google]          │
│  [🍎 Continue with Apple]           │
│  [💬 Continue with Discord]         │
│  [📧 Continue with Email]           │
│                                     │
│  ────────── or ──────────           │
│                                     │
│  [🦊 MetaMask]  [🌈 Rainbow]        │
│  [💰 Coinbase]  [🔗 WalletConnect]  │
│                                     │
│  + 700 more wallets                 │
└─────────────────────────────────────┘
```

### Phase 2: Create Sponsor Wallet

```typescript
// 4. Backend creates Turnkey wallet for user
const turnkeyWallet = await turnkey.createWallet({
  walletName: `sponsor-${address}-avalanche`,
  accounts: [{
    curve: 'SECP256K1',
    pathFormat: 'BIP32',
    path: "m/44'/60'/0'/0/0",
  }],
});

// 5. Store wallet reference (NOT private key)
await supabase.from('perkos_sponsor_wallets').insert({
  user_wallet_address: address, // User's Reown wallet
  network: 'avalanche',
  turnkey_wallet_id: turnkeyWallet.walletId,
  sponsor_address: turnkeyWallet.addresses[0],
  balance: '0',
});
```

**User sees**:
```
┌─────────────────────────────────────┐
│  Sponsor Wallet Created ✅          │
│                                     │
│  Network: Avalanche                 │
│  Address: 0x1234...5678             │
│                                     │
│  Deposit AVAX to start sponsoring: │
│  [Copy Address] [Show QR Code]      │
└─────────────────────────────────────┘
```

### Phase 3: Fund Sponsor Wallet

```typescript
// 6. User sends AVAX to sponsor wallet address
// Can use their Reown wallet or any other wallet

// 7. Backend monitors deposits
const indexer = new DepositIndexer();
indexer.on('deposit', async (deposit) => {
  await updateSponsorBalance(deposit.walletId, deposit.amount);
});
```

**User sees**:
```
┌─────────────────────────────────────┐
│  Sponsor Wallet Balance             │
│                                     │
│  10.5 AVAX                          │
│  ~$425 USD                          │
│                                     │
│  [Deposit More] [Withdraw]          │
└─────────────────────────────────────┘
```

### Phase 4: Configure Sponsorship Rules

```typescript
// 8. User creates sponsorship rules
await createSponsorRule({
  walletId: wallet.id,
  ruleType: 'domain',
  ruleValue: 'example.com',
  dailyLimit: parseEther('0.1').toString(),
  perTxLimit: parseEther('0.01').toString(),
});
```

**User sees**:
```
┌─────────────────────────────────────┐
│  Sponsorship Rules                  │
│                                     │
│  ✅ Sponsor example.com             │
│     Daily: 0.1 AVAX max             │
│     Per-tx: 0.01 AVAX max           │
│                                     │
│  ✅ Sponsor agent 0xABC...DEF       │
│     Monthly: 1 AVAX max             │
│                                     │
│  [+ Add New Rule]                   │
└─────────────────────────────────────┘
```

### Phase 5: Automatic Gas Sponsorship

```typescript
// 9. x402 payment settlement happens
// API consumer (example.com) submits payment envelope

// 10. Facilitator finds matching sponsor
const sponsor = await findSponsorWallet({
  network: 'avalanche',
  domain: 'example.com',
});

// 11. Sign transaction via Turnkey (NO user intervention)
const signedTx = await turnkey.signTransaction({
  walletId: sponsor.turnkey_wallet_id,
  unsignedTransaction: rawTx,
});

// 12. Broadcast and deduct gas
const receipt = await publicClient.waitForTransactionReceipt({ hash });
await deductGasCost(sponsor.id, receipt.gasUsed * receipt.effectiveGasPrice);
```

**User sees** (in analytics):
```
┌─────────────────────────────────────┐
│  Recent Transactions                │
│                                     │
│  ✅ example.com                     │
│     Gas: 0.0089 AVAX                │
│     2 minutes ago                   │
│                                     │
│  ✅ example.com                     │
│     Gas: 0.0092 AVAX                │
│     15 minutes ago                  │
│                                     │
│  Balance: 10.48 AVAX (↓0.02)        │
└─────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Install Dependencies

```bash
cd ServerApp

# Reown AppKit + Wagmi (authentication)
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query

# Turnkey SDK (server-side wallets)
npm install @turnkey/sdk-server @turnkey/viem

# Already installed:
# - @supabase/supabase-js (database)
# - next, react, react-dom (Next.js 15)
```

### Step 2: Setup Reown AppKit (Frontend)

**Get Project ID**: https://cloud.reown.com/ (free)

**Create `lib/config/reown.ts`**:
```typescript
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { avalanche, base, celo } from 'viem/chains';
import { QueryClient } from '@tanstack/react-query';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID!;

const metadata = {
  name: 'PerkOS x402 Facilitator',
  description: 'Multi-chain payment facilitator with gas sponsorship',
  url: 'https://perkos.x402.io',
  icons: ['https://perkos.x402.io/logo.png'],
};

// Networks
const networks = [avalanche, base, celo];

// Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

// Query client
export const queryClient = new QueryClient();

// Create AppKit
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    email: true, // Email login enabled
    socials: ['google', 'apple', 'discord', 'github'], // Social logins
    emailShowWallets: true, // Show wallet options after email
    analytics: true,
  },
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#7B3FF2', // Purple accent
  },
});
```

**Create `app/providers.tsx`**:
```typescript
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, queryClient } from '@/lib/config/reown';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Update `app/layout.tsx`**:
```typescript
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Step 3: Create Dashboard UI

**Create `app/dashboard/page.tsx`**:
```typescript
'use client';

import { useAccount } from 'wagmi';
import { AppKitButton } from '@reown/appkit/react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [sponsorWallets, setSponsorWallets] = useState([]);

  useEffect(() => {
    if (isConnected && address) {
      // Fetch user's sponsor wallets
      fetchSponsorWallets(address);
    }
  }, [isConnected, address]);

  async function fetchSponsorWallets(userAddress: string) {
    const res = await fetch(`/api/sponsors/wallets?address=${userAddress}`);
    const data = await res.json();
    setSponsorWallets(data.wallets || []);
  }

  async function createSponsorWallet(network: string) {
    const res = await fetch('/api/sponsors/wallets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: address, network }),
    });

    const data = await res.json();
    if (data.success) {
      fetchSponsorWallets(address!);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">PerkOS Gas Sponsorship</h1>
          <p className="text-gray-600 mb-8">
            Login to create sponsor wallets and pay gas fees for your users
          </p>
          <AppKitButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Gas Sponsorship Dashboard</h1>
        <AppKitButton />
      </header>

      <div className="mb-8">
        <p className="text-gray-600">Connected: {address}</p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Sponsor Wallets</h2>

        {sponsorWallets.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No sponsor wallets yet</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => createSponsorWallet('avalanche')}
                className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600"
              >
                Create Avalanche Wallet
              </button>
              <button
                onClick={() => createSponsorWallet('base')}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
              >
                Create Base Wallet
              </button>
              <button
                onClick={() => createSponsorWallet('celo')}
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600"
              >
                Create Celo Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sponsorWallets.map((wallet: any) => (
              <div key={wallet.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-2">{wallet.network}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {wallet.sponsor_address.slice(0, 10)}...{wallet.sponsor_address.slice(-8)}
                </p>
                <p className="text-2xl font-bold mb-4">
                  {(parseFloat(wallet.balance) / 1e18).toFixed(4)} {wallet.network === 'avalanche' ? 'AVAX' : wallet.network === 'base' ? 'ETH' : 'CELO'}
                </p>
                <div className="space-y-2">
                  <button className="w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600">
                    Deposit
                  </button>
                  <button className="w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300">
                    Configure Rules
                  </button>
                  <button className="w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300">
                    View Analytics
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Step 4: Setup Turnkey (Backend)

**Get Turnkey Credentials**: https://app.turnkey.com/

**Create `lib/services/TurnkeyService.ts`**:
```typescript
import { TurnkeyClient } from '@turnkey/sdk-server';
import type { Address } from 'viem';
import { supabase } from '../db/supabase';
import { logger } from '../utils/logger';

export class TurnkeyService {
  private client: TurnkeyClient;

  constructor() {
    this.client = new TurnkeyClient({
      apiBaseUrl: 'https://api.turnkey.com',
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    });
  }

  async createSponsorWallet(userAddress: Address, network: string) {
    try {
      // Create wallet in Turnkey
      const walletName = `sponsor-${userAddress}-${network}`;
      const wallet = await this.client.createWallet({
        walletName,
        accounts: [{
          curve: 'SECP256K1',
          pathFormat: 'BIP32',
          path: "m/44'/60'/0'/0/0",
          addressFormat: 'ETHEREUM',
        }],
      });

      const sponsorAddress = wallet.addresses[0];
      const turnkeyWalletId = wallet.walletId;

      // Store in database (NO private key!)
      const { data, error } = await supabase
        .from('perkos_sponsor_wallets')
        .insert({
          user_wallet_address: userAddress,
          network,
          chain_id: this.getChainId(network),
          turnkey_wallet_id: turnkeyWalletId,
          sponsor_address: sponsorAddress,
          balance: '0',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Sponsor wallet created', {
        userAddress,
        network,
        sponsorAddress,
      });

      return data;
    } catch (error) {
      logger.error('Failed to create sponsor wallet', { error });
      throw error;
    }
  }

  async signTransaction(
    turnkeyWalletId: string,
    unsignedTx: string
  ): Promise<string> {
    const result = await this.client.signTransaction({
      walletId: turnkeyWalletId,
      type: 'TRANSACTION_TYPE_ETHEREUM',
      unsignedTransaction: unsignedTx,
    });

    return result.signedTransaction;
  }

  private getChainId(network: string): number {
    const chainIds: Record<string, number> = {
      avalanche: 43114,
      'avalanche-fuji': 43113,
      base: 8453,
      'base-sepolia': 84532,
      celo: 42220,
      'celo-alfajores': 44787,
    };
    return chainIds[network] || 43114;
  }
}

export const turnkeyService = new TurnkeyService();
```

### Step 5: Create API Endpoints

**Create `app/api/sponsors/wallets/create/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { turnkeyService } from '@/lib/services/TurnkeyService';

export async function POST(req: NextRequest) {
  try {
    const { userAddress, network } = await req.json();

    if (!userAddress || !network) {
      return NextResponse.json(
        { success: false, error: 'Missing userAddress or network' },
        { status: 400 }
      );
    }

    const wallet = await turnkeyService.createSponsorWallet(userAddress, network);

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        sponsorAddress: wallet.sponsor_address,
        network: wallet.network,
        balance: wallet.balance,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create wallet' },
      { status: 500 }
    );
  }
}
```

**Create `app/api/sponsors/wallets/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Missing address' },
        { status: 400 }
      );
    }

    const { data: wallets, error } = await supabase
      .from('perkos_sponsor_wallets')
      .select('*')
      .eq('user_wallet_address', address.toLowerCase());

    if (error) throw error;

    return NextResponse.json({ success: true, wallets });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch wallets' },
      { status: 500 }
    );
  }
}
```

### Step 6: Update Database Schema

```sql
-- Update sponsor wallets table for Reown + Turnkey
CREATE TABLE perkos_sponsor_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_wallet_address TEXT NOT NULL, -- User's Reown wallet address
    network TEXT NOT NULL CHECK (network IN ('avalanche', 'avalanche-fuji', 'base', 'base-sepolia', 'celo', 'celo-alfajores')),
    chain_id INTEGER NOT NULL,
    turnkey_wallet_id TEXT NOT NULL, -- Turnkey wallet reference (NOT private key!)
    sponsor_address TEXT NOT NULL UNIQUE, -- Sponsor wallet address (for deposits)
    balance TEXT NOT NULL DEFAULT '0',
    total_deposited TEXT NOT NULL DEFAULT '0',
    total_spent TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sponsor_wallets_user_address ON perkos_sponsor_wallets(user_wallet_address);
CREATE INDEX idx_sponsor_wallets_network ON perkos_sponsor_wallets(network);
CREATE INDEX idx_sponsor_wallets_sponsor_address ON perkos_sponsor_wallets(sponsor_address);
```

### Step 7: Integrate with Settlement Flow

**Update `lib/services/ExactSchemeService.ts`**:
```typescript
import { turnkeyService } from './TurnkeyService';
import { createWalletClient, http, serializeTransaction } from 'viem';

async settle(
  payload: ExactPayload,
  requirements: PaymentRequirements,
  requestMetadata?: {
    domain?: string;
    agentAddress?: string;
  }
): Promise<SettleResponse> {
  // Find matching sponsor
  const sponsor = await findSponsorWallet({
    network: this.network,
    domain: requestMetadata?.domain,
    agentAddress: requestMetadata?.agentAddress,
  });

  let walletClient;
  let usingSponsor = false;

  if (sponsor) {
    // Create Turnkey-backed wallet client
    walletClient = createWalletClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
      account: {
        address: sponsor.sponsor_address,
        signTransaction: async (tx) => {
          const serialized = serializeTransaction(tx);
          const signed = await turnkeyService.signTransaction(
            sponsor.turnkey_wallet_id,
            serialized
          );
          return signed as `0x${string}`;
        },
      },
    });
    usingSponsor = true;
  } else {
    // Use facilitator wallet
    walletClient = this.walletClient;
  }

  // Submit transaction (rest of settlement logic)
  const hash = await walletClient.writeContract({
    address: requirements.asset,
    abi: TRANSFER_WITH_AUTHORIZATION_ABI,
    functionName: 'transferWithAuthorization',
    args: [...],
  });

  // Wait for receipt and record usage
  const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

  if (usingSponsor && receipt.status === 'success') {
    await recordSponsorUsage(sponsor.id, receipt);
  }

  return {
    success: true,
    payer: authorization.from,
    transaction: hash,
    network: this.network,
    sponsoredBy: usingSponsor ? sponsor.sponsor_address : null,
  };
}
```

---

## Environment Variables

```env
# Reown AppKit (Frontend)
NEXT_PUBLIC_REOWN_PROJECT_ID=your-project-id-from-cloud-reown-com

# Turnkey (Backend)
TURNKEY_API_PUBLIC_KEY=your-turnkey-public-key
TURNKEY_API_PRIVATE_KEY=your-turnkey-private-key
TURNKEY_ORGANIZATION_ID=your-turnkey-org-id

# Supabase (Already configured)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Summary

### What User Does

1. **Login** (Reown AppKit) - Choose: Google, Apple, Discord, Email, or 700+ wallets
2. **Create Sponsor Wallet** (one-time) - Click "Create Avalanche Wallet"
3. **Deposit AVAX** - Send AVAX to sponsor wallet address (like funding MetaMask)
4. **Configure Rules** - Set which domains/agents can use wallet + spending limits
5. **Done!** - System automatically pays gas fees for matching requests

### What System Does

1. **Authenticate user** - Reown AppKit handles all auth flows
2. **Create Turnkey wallet** - Server-side, keys in AWS Nitro Enclave
3. **Monitor deposits** - Track when user funds wallet
4. **Match sponsors** - Find wallet matching domain/agent rules
5. **Sign transactions** - Call Turnkey API (50-100ms signing)
6. **Deduct gas** - Update balance after transaction
7. **Show analytics** - User sees usage in dashboard

### Key Benefits

- ✅ **No private keys stored** - Turnkey manages keys in secure enclaves
- ✅ **Easy login** - Social, email, or wallet (user choice)
- ✅ **No user intervention** - Automatic gas payment per transaction
- ✅ **Low cost** - ~$1-2/month for Turnkey + $0 for Reown
- ✅ **Multi-chain** - Avalanche, Base, Celo supported

**This is the recommended architecture for PerkOS x402 gas sponsorship!** 🚀

---

## Next Steps

1. Sign up for Reown Cloud (free): https://cloud.reown.com/
2. Sign up for Turnkey: https://app.turnkey.com/
3. Install dependencies: `npm install @reown/appkit @turnkey/sdk-server`
4. Implement dashboard UI with Reown AppKit
5. Create Turnkey service for wallet management
6. Update settlement flow to use sponsor wallets
7. Deploy and test!

**Estimated implementation time**: 5-7 days
