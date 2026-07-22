# PerkOS Stack - x402 V2 Middleware

Multi-chain x402 facilitator for AI agents. Stack implements the canonical x402 v2 envelope and HTTP settlement header for the `exact` scheme, preserves v1 compatibility, and adds a PerkOS-specific deferred voucher scheme.

[![x402 V2](https://img.shields.io/badge/x402-V2.0.0-blue)](https://x402.org)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Compliant-green)](https://eips.ethereum.org/EIPS/eip-8004)
[![Networks](https://img.shields.io/badge/Networks-19-purple)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Why PerkOS Stack?

### Key capabilities

1. **x402 v2 exact payments**
   - Canonical `PaymentPayload.accepted` envelope
   - `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` transport compatibility
   - CAIP-2 network identifiers
   - Backward compatible with v1 and the previous PerkOS v2 envelope

2. **AI Agent Discovery (ERC-8004)**
   - ERC-721 agent identity and verified `agentWallet`
   - Live reputation tracking
   - ActivityPub-compatible metadata
   - Bazaar marketplace indexing

3. **Enterprise Multi-Chain**
   - 19 EVM networks supported
   - Unified API across all chains
   - Automatic chain ID resolution
   - Block explorer integration

4. **Production-Ready Infrastructure**
   - Dynamic/Para server-wallet gas sponsorship
   - Real-time health monitoring
   - Database-backed analytics
   - Upgradeable smart contracts (UUPS)

## Features

### Protocol Support
- **x402 V2** - Canonical exact-scheme facilitator flow; `upto` and the official `batch-settlement` scheme are not yet implemented
- **EIP-3009** - Exact scheme with transferWithAuthorization
- **EIP-712** - Deferred scheme with typed structured data
- **ERC-8004** - Trustless agent discovery standard
- **SIWA + ERC-8128** - Agent identity login and signed HTTP requests
- **x401 Draft 0.2.0** - Route-scoped credential proof gates and reusable verification tokens
- **ERC-8183** - Draft agentic-commerce job lifecycle and escrow

### Discovery & Metadata (V2)
- **Discovery metadata** - PerkOS well-known metadata plus facilitator capability discovery
- **Agent Card** - ActivityPub-style metadata
- **CAIP Standards** - Chain-agnostic identifiers
- **Live Reputation** - Real-time transaction stats

### Infrastructure
- **Next.js 15** - App Router architecture
- **TypeScript** - Full type safety
- **Viem 2.x** - Modern Ethereum interactions
- **Supabase** - PostgreSQL database
- **Dynamic / Para** - Server-wallet transaction sponsorship

### Supported x402 Networks (19)

PerkOS Stack supports 19 EVM networks with configured USDC or USDG payment tokens. Fifteen also have an official ERC-8004 deployment; Robinhood, Robinhood Testnet, and both Unichain networks use a signed cross-chain payment binding to an identity on one of those fifteen networks.

#### Mainnet Networks

| Network | Chain ID | Native | Payment token |
|---------|----------|--------|---------------|
| Ethereum | 1 | ETH | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Avalanche | 43114 | AVAX | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| Base | 8453 | ETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Polygon | 137 | POL | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Arbitrum | 42161 | ETH | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Optimism | 10 | ETH | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| Celo | 42220 | CELO | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| Monad | 143 | MON | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| Unichain | 130 | ETH | USDC `0x078D782b760474a361dDA0AF3839290b0EF57AD6` |
| Robinhood Chain | 4663 | ETH | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

#### Testnet Networks

| Network | Chain ID | Native | Payment token |
|---------|----------|--------|---------------|
| Sepolia | 11155111 | ETH | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Avalanche Fuji | 43113 | AVAX | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Base Sepolia | 84532 | ETH | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Polygon Amoy | 80002 | POL | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` |
| Arbitrum Sepolia | 421614 | ETH | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| OP Sepolia | 11155420 | ETH | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` |
| Monad Testnet | 10143 | MON | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Unichain Sepolia | 1301 | ETH | `0x31d0220469e10c4E71834a79b1f276d740d3768F` |
| Robinhood Testnet | 46630 | ETH | faucet USDG `0x7E955252E15c84f5768B83c41a71F9eba181802F` (no monetary value) |

> **Robinhood Chain note**: mainnet uses canonical USDG. Robinhood Testnet uses
> the faucet-distributed `Global Dollar` test token at
> `0x7E955252E15c84f5768B83c41a71F9eba181802F`; testnet tokens have no monetary
> value. The integration is independent and is not affiliated with
> or endorsed by Robinhood. Mainnet contract and network details come from
> [Robinhood Chain's official documentation](https://docs.robinhood.com/chain/contracts/).

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Required variables:
```bash
PRIVATE_KEY=0x...your-private-key...
NEXT_PUBLIC_PAYMENT_RECEIVER=0x...your-receiver-address...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Thirdweb (for gasless)
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key
```

### 3. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3402](http://localhost:3402)

### 4. Build for Production

```bash
npm run build
```

### 5. Bundle Analysis (Optional)

To analyze bundle size and identify heavy dependencies:

```bash
ANALYZE=true npm run build
```

This opens an interactive visualization showing what's in each bundle.

## API Reference

### x402 V2 Protocol Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/x402/verify` | Verify payment payload |
| POST | `/api/v2/x402/settle` | Settle payment on-chain |
| GET | `/api/v2/x402/supported` | Supported schemes/networks |
| GET | `/api/v2/x402/health` | Comprehensive health check |
| GET | `/api/v2/x402/config` | Configuration details |

### V2 Discovery Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/x402-discovery.json` | **V2 Bazaar Discovery** - Full facilitator metadata |
| GET | `/.well-known/agent-card.json` | **ActivityPub Agent Card** - AI agent metadata |
| GET | `/.well-known/erc-8004.json` | **ERC-8004 Registration** - Trust models & reputation |
| GET | `/.well-known/x402-payment.json` | **Payment Config** - Schemes & networks |

### Deferred Scheme Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deferred/info` | Scheme configuration |
| GET | `/api/deferred/vouchers` | List stored vouchers |
| POST | `/api/deferred/vouchers/:id/:nonce/settle` | Settle specific voucher |
| POST | `/api/deferred/settle-batch` | Batch settle vouchers |
| GET | `/api/deferred/escrow/balance` | Query escrow balance |

### Agent Authentication and Commerce

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/siwa.json` | SIWA configuration and ERC-8004 identity networks |
| POST | `/api/v2/agents/siwa/nonce` | Issue a one-time SIWA nonce |
| POST | `/api/v2/agents/siwa/verify` | Verify ownership and issue a short-lived receipt |
| GET/POST | `/api/v2/agents/siwa/session` | Verify receipt plus an ERC-8128 signed request |
| GET/POST | `/api/v2/x401/requirements` | Issue a signed OpenID4VP x401 proof requirement |
| GET/POST | `/api/v2/x401/protected` | Reference route accepting Result Artifacts or verification tokens |
| POST | `/api/v2/x401/token` | OAuth Token Exchange for a route-scoped verification token |
| GET/POST | `/api/v2/erc8183/jobs` | Read jobs or prepare unsigned ERC-8183 actions |

See [SIWA, ERC-8128, and ERC-8183 integration](../Docs/SIWA-ERC8183.md) for the
complete flow, configuration, source map, and security model.

See [x401 current status and Stack profile](../Docs/X401-STATUS-2026-07-22.md)
for the exact Draft 0.2.0 support boundary and operational configuration.

## x402 V2 Protocol Details

### HTTP transport headers

The standard v2 transport uses base64-encoded JSON in these headers:

```
PAYMENT-REQUIRED: <base64 PaymentRequired>   # resource server -> client
PAYMENT-SIGNATURE: <base64 PaymentPayload>  # client -> resource server
PAYMENT-RESPONSE: <base64 SettleResponse>    # resource server -> client
```

Stack's `X-x402-*` headers are additional observability metadata, not protocol headers.

### V2 Settlement Receipt

Settle responses include a detailed V2 receipt:

```json
{
  "success": true,
  "payer": "0x...",
  "transaction": "0x...",
  "network": "base",
  "receipt": {
    "version": "2.0.0",
    "requestId": "x402-m4k5p2-a8f3b1",
    "timestamp": "2025-12-14T10:30:00.000Z",
    "network": {
      "name": "base",
      "chainId": 8453,
      "caip2": "eip155:8453"
    },
    "payment": {
      "scheme": "exact",
      "payer": "0x...",
      "amount": "1000000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    },
    "settlement": {
      "success": true,
      "transaction": "0x...",
      "blockExplorer": "https://basescan.org/tx/0x..."
    }
  }
}
```

### V2 Discovery Metadata

The `/.well-known/x402-discovery.json` endpoint provides comprehensive facilitator metadata:

```json
{
  "@context": "https://x402.org/discovery/v2",
  "@type": "x402Facilitator",
  "specVersion": "2.0.0",
  "protocolVersion": 1,
  "facilitator": {
    "id": "0x...",
    "name": "PerkOS Stack",
    "description": "Enterprise x402 payment infrastructure",
    "url": "https://your-domain.com"
  },
  "capabilities": {
    "schemes": ["exact", "deferred"],
    "features": [
      "multi-chain",
      "gasless-transactions",
      "agent-discovery",
      "bazaar-indexable"
    ],
    "paymentMethods": [
      {
        "scheme": "exact",
        "network": "base",
        "chainId": 8453,
        "caip2": "eip155:8453",
        "asset": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "symbol": "USDC",
          "decimals": 6,
          "caip19": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        }
      }
    ]
  },
  "trust": {
    "model": "reputation",
    "reputation": {
      "totalTransactions": 1250,
      "successfulTransactions": 1248,
      "successRate": 99,
      "totalVolume": "125000.00",
      "lastUpdated": "2025-12-14T10:30:00.000Z"
    }
  }
}
```

### V2 Health Monitoring

Comprehensive health endpoint with network and database checks:

```json
{
  "status": "healthy",
  "version": {
    "x402": "2.0.0",
    "api": "v2",
    "protocol": 1
  },
  "timestamp": "2025-12-14T10:30:00.000Z",
  "uptime": 86400,
  "responseTime": 45,
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 12
    },
    "networks": [
      {
        "network": "base",
        "chainId": 8453,
        "status": "healthy",
        "latency": 89,
        "blockNumber": 23456789
      }
    ]
  },
  "capabilities": {
    "schemes": ["exact", "deferred"],
    "deferredEnabled": true,
    "networksConfigured": 16,
    "networksHealthy": 16
  }
}
```

## Project Structure

```
StackApp/
├── app/
│   ├── api/
│   │   ├── v2/x402/              # x402 V2 Protocol
│   │   │   ├── verify/           # Payment verification
│   │   │   ├── settle/           # Payment settlement
│   │   │   ├── supported/        # Supported networks
│   │   │   ├── health/           # V2 Health monitoring
│   │   │   └── config/           # Configuration
│   │   ├── deferred/             # Deferred scheme
│   │   └── .well-known/          # V2 Discovery endpoints
│   │       ├── x402-discovery.json/
│   │       ├── agent-card.json/
│   │       ├── erc-8004.json/
│   │       └── x402-payment.json/
│   ├── dashboard/                # Admin dashboard
│   ├── transactions/             # Transaction history
│   └── networks/                 # Network stats
├── lib/
│   ├── services/                 # Business logic
│   │   ├── X402Service.ts        # Main orchestrator
│   │   ├── ExactSchemeService.ts # EIP-3009 payments
│   │   ├── DeferredSchemeService.ts # EIP-712 vouchers
│   │   └── ThirdwebService.ts    # Gasless transactions
│   ├── utils/
│   │   ├── chains.ts             # 16 network configs
│   │   ├── config.ts             # App configuration
│   │   └── x402-headers.ts       # V2 header utilities
│   ├── types/
│   │   └── x402.ts               # TypeScript definitions
│   └── db/
│       └── supabase.ts           # Database client
└── contracts/                    # Solidity (UUPS upgradeable)
```

## Database Schema

PerkOS Stack uses **Supabase (PostgreSQL)** with 15 tables organized into 5 categories:

### Core x402 Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_x402_transactions` | All x402 payment records | `transaction_hash`, `payer_address`, `recipient_address`, `amount_wei`, `network`, `scheme`, `status` |
| `perkos_x402_agents` | Agent stats (payers/vendors) | `wallet_address`, `agent_type`, `total_transactions`, `total_volume_usd` |
| `perkos_x402_network_stats` | Daily network analytics | `network`, `chain_id`, `stats_date`, `transaction_count`, `total_volume_usd` |

### Legacy/Alternative Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_transactions` | Transaction records (alt schema) | `hash`, `network`, `payer`, `payee`, `amount`, `status` |
| `perkos_vouchers` | Deferred payment vouchers | `voucher_id`, `buyer`, `seller`, `value_aggregate`, `signature`, `settled` |
| `perkos_agents` | Agent reputation data | `address`, `name`, `total_transactions`, `average_rating` |
| `perkos_reviews` | Community ratings | `agent_id`, `reviewer_address`, `rating`, `comment`, `tags` |
| `perkos_network_stats` | Network analytics (alt schema) | `network`, `chain_id`, `date`, `total_volume`, `unique_users` |

### Vendor Registry Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_vendors` | Registered vendor services | `name`, `url`, `discovery_url`, `wallet_address`, `category`, `status` |
| `perkos_vendor_endpoints` | API endpoints per vendor | `vendor_id`, `path`, `method`, `price_usd` |
| `perkos_vendor_verifications` | Discovery verification history | `vendor_id`, `success`, `response_time_ms`, `discovery_data` |

### Gas Sponsorship Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_sponsor_wallets` | Sponsor wallet management | `user_wallet_address`, `turnkey_wallet_id`, `sponsor_address`, `smart_wallet_address`, `balance` |
| `perkos_sponsor_rules` | Sponsorship rules | `sponsor_wallet_id`, `rule_type`, `agent_address`, `domain`, `daily_limit_wei` |
| `perkos_sponsor_spending` | Spending tracking | `sponsor_wallet_id`, `amount_wei`, `agent_address`, `day`, `month` |
| `perkos_sponsor_transactions` | Sponsored tx analytics | `wallet_id`, `tx_hash`, `gas_used`, `total_cost`, `status` |

### User Management Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_user_profiles` | User profile information | `wallet_address`, `account_type`, `display_name`, `avatar_url`, `is_verified` |

### Database Features

- **Row Level Security (RLS)**: All tables protected with appropriate policies
- **Auto-triggers**: `updated_at` timestamps, stats aggregation, spending date computation
- **Indexes**: Optimized for common queries (wallet lookups, date ranges, status filters)
- **Views**: `perkos_sponsor_wallet_analytics` for sponsor wallet metrics

### Entity Relationship Diagram

```mermaid
erDiagram
    %% Core x402 Tables
    perkos_x402_transactions {
        uuid id PK
        text transaction_hash UK
        text payer_address
        text recipient_address
        text sponsor_address
        text amount_wei
        decimal amount_usd
        text asset_address
        text network
        int chain_id
        text scheme
        text status
        uuid vendor_id FK
        timestamptz created_at
    }

    perkos_x402_agents {
        uuid id PK
        text wallet_address UK
        text agent_type
        text display_name
        int total_transactions
        text total_volume_wei
        decimal total_volume_usd
        text primary_network
        timestamptz last_active_at
    }

    perkos_x402_network_stats {
        uuid id PK
        text network
        int chain_id
        date stats_date
        int transaction_count
        decimal total_volume_usd
        int unique_payers
        timestamptz updated_at
    }

    %% Vendor Registry Tables
    perkos_vendors {
        uuid id PK
        text name
        text url UK
        text discovery_url UK
        text wallet_address
        text network
        text category
        text status
        int total_transactions
        text total_volume
        jsonb discovery_metadata
    }

    perkos_vendor_endpoints {
        uuid id PK
        uuid vendor_id FK
        text path
        text method
        text price_usd
        jsonb request_schema
        jsonb response_schema
        bool is_active
    }

    perkos_vendor_verifications {
        uuid id PK
        uuid vendor_id FK
        bool success
        int response_time_ms
        text error_message
        jsonb discovery_data
        timestamptz verified_at
    }

    %% Gas Sponsorship Tables
    perkos_sponsor_wallets {
        uuid id PK
        text user_wallet_address
        text turnkey_wallet_id UK
        text sponsor_address UK
        text smart_wallet_address
        text encrypted_private_key
        text balance
        bool enabled
        timestamptz created_at
    }

    perkos_sponsor_rules {
        uuid id PK
        uuid sponsor_wallet_id FK
        text rule_type
        text agent_address
        text domain
        text daily_limit_wei
        text monthly_limit_wei
        int priority
        bool enabled
    }

    perkos_sponsor_spending {
        uuid id PK
        uuid sponsor_wallet_id FK
        text amount_wei
        text agent_address
        text transaction_hash
        date day
        date month
        timestamptz spent_at
    }

    perkos_sponsor_transactions {
        uuid id PK
        uuid wallet_id FK
        uuid rule_id FK
        text tx_hash UK
        text gas_used
        text gas_price
        text total_cost
        text status
        timestamptz created_at
    }

    %% Legacy Tables
    perkos_agents {
        uuid id PK
        text address UK
        text name
        text description
        int total_transactions
        text total_volume
        decimal average_rating
    }

    perkos_reviews {
        uuid id PK
        uuid agent_id FK
        text reviewer_address
        int rating
        text comment
        text transaction_hash
    }

    perkos_vouchers {
        uuid id PK
        text voucher_id UK
        text buyer
        text seller
        text value_aggregate
        text signature
        bool settled
        text settled_tx_hash
    }

    %% User Management
    perkos_user_profiles {
        uuid id PK
        text wallet_address UK
        text account_type
        text display_name
        text avatar_url
        text website
        bool is_verified
        bool is_public
    }

    %% Relationships
    perkos_x402_transactions ||--o| perkos_vendors : "vendor_id"
    perkos_vendors ||--o{ perkos_vendor_endpoints : "vendor_id"
    perkos_vendors ||--o{ perkos_vendor_verifications : "vendor_id"
    perkos_sponsor_wallets ||--o{ perkos_sponsor_rules : "sponsor_wallet_id"
    perkos_sponsor_wallets ||--o{ perkos_sponsor_spending : "sponsor_wallet_id"
    perkos_sponsor_wallets ||--o{ perkos_sponsor_transactions : "wallet_id"
    perkos_sponsor_rules ||--o{ perkos_sponsor_transactions : "rule_id"
    perkos_agents ||--o{ perkos_reviews : "agent_id"
```

### Data Flow Diagram

```mermaid
flowchart TB
    subgraph Client["Client/Agent"]
        W[Wallet]
    end

    subgraph Stack["PerkOS Stack Middleware"]
        V["/api/v2/x402/verify"]
        S["/api/v2/x402/settle"]
        D["/.well-known/*"]
    end

    subgraph Database["Supabase PostgreSQL"]
        TX[perkos_x402_transactions]
        AG[perkos_x402_agents]
        NS[perkos_x402_network_stats]
        SP[perkos_sponsor_wallets]
        VD[perkos_vendors]
    end

    subgraph Blockchain["EVM Networks"]
        USDC[USDC Contract]
        ESC[Escrow Contract]
    end

    W -->|"1. Sign Payment"| V
    V -->|"2. Verify Signature"| V
    V -->|"3. Check Requirements"| S
    S -->|"4. Execute Transfer"| USDC
    S -->|"5. Record Transaction"| TX
    TX -->|"trigger"| AG
    TX -->|"trigger"| NS
    SP -->|"Sponsor Gas"| S
    D -->|"Discovery"| VD

    style Stack fill:#4F46E5,color:#fff
    style Database fill:#10B981,color:#fff
    style Blockchain fill:#F59E0B,color:#fff
```

### System Architecture Diagram

```mermaid
architecture-beta
    group client(cloud)[Client Layer]
    group stack(server)[PerkOS Stack]
    group infra(database)[Infrastructure]
    group chain(disk)[Blockchain]

    service wallet(internet)[Wallet] in client
    service agent(internet)[AI Agent] in client
    service webapp(internet)[Web App] in client

    service nextjs(server)[Next.js 15] in stack
    service api(server)[API Routes] in stack
    service services(server)[Core Services] in stack
    service indexer(server)[Event Indexer] in stack

    service supabase(database)[Supabase] in infra
    service thirdweb(cloud)[Thirdweb] in infra

    service avalanche(disk)[Avalanche] in chain
    service base(disk)[Base] in chain
    service usdc(disk)[USDC] in chain
    service escrow(disk)[Escrow] in chain

    wallet:R --> L:nextjs
    agent:R --> L:nextjs
    webapp:R --> L:nextjs

    nextjs:R --> L:api
    api:R --> L:services
    services:B --> T:indexer

    services:R --> L:supabase
    services:R --> L:thirdweb

    services:B --> T:avalanche
    services:B --> T:base
    avalanche:R --> L:usdc
    base:R --> L:escrow
```

### Sequence Diagrams

#### x402 Payment Verification Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client/Agent
    participant S as PerkOS Stack
    participant DB as Supabase
    participant BC as Blockchain

    C->>S: POST /api/v2/x402/verify
    Note over C,S: x402Version, paymentPayload, paymentRequirements

    S->>S: Validate x402 version
    S->>S: Check scheme (exact/deferred)

    alt Exact Scheme (EIP-3009)
        S->>S: Recover signer from signature
        S->>S: Validate authorization params
        S->>BC: Check nonce not used
        BC-->>S: Nonce status
    else Deferred Scheme (EIP-712)
        S->>S: Verify EIP-712 signature
        S->>DB: Check voucher state
        DB-->>S: Voucher status
    end

    S->>S: Validate amount >= required
    S->>S: Validate recipient address
    S->>S: Validate network/asset

    S-->>C: { isValid, invalidReason, payer }
```

#### x402 Payment Settlement Flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client/Agent
    participant S as PerkOS Stack
    participant TW as Thirdweb
    participant BC as Blockchain (USDC)
    participant DB as Supabase

    C->>S: POST /api/v2/x402/settle
    Note over C,S: Verified payment payload

    S->>S: Re-verify payment

    alt Exact Scheme
        S->>TW: Get wallet client
        TW-->>S: Wallet ready
        S->>BC: transferWithAuthorization()
        Note over BC: from, to, value, validAfter, validBefore, nonce, signature
        BC-->>S: Transaction hash
    else Deferred Scheme
        S->>DB: Update voucher aggregate
        DB-->>S: Voucher updated
        Note over S: Batch settlement later
    end

    S->>DB: Insert perkos_x402_transactions
    Note over DB: Triggers update agent stats
    Note over DB: Triggers update network stats

    S-->>C: { success, transaction, payer, network }
```

#### Agent Discovery Flow (ERC-8004)

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent/Client
    participant S as PerkOS Stack
    participant DB as Supabase

    A->>S: GET /.well-known/agent-card.json
    S->>S: Build ActivityPub metadata
    S-->>A: Agent capabilities, endpoints

    A->>S: GET /.well-known/erc-8004.json
    S->>DB: Fetch agent reputation
    DB-->>S: Transaction stats, ratings
    S->>S: Build ERC-8004 registration
    S-->>A: Full agent profile with trust models

    A->>S: GET /api/v2/x402/supported
    S-->>A: Supported schemes & networks

    A->>S: GET /api/v2/x402/config
    S-->>A: Configuration & facilitator info

    Note over A,S: Agent now ready to make payments
```

#### Deferred Payment Batch Settlement Flow

```mermaid
sequenceDiagram
    autonumber
    participant V as Vendor
    participant S as PerkOS Stack
    participant DB as Supabase
    participant ESC as Escrow Contract
    participant BC as Blockchain

    V->>S: GET /api/deferred/vouchers
    S->>DB: Query pending vouchers
    DB-->>S: List of vouchers
    S-->>V: Vouchers ready for settlement

    V->>S: POST /api/deferred/settle-batch
    Note over V,S: voucher_ids[]

    loop For each voucher
        S->>DB: Get voucher details
        DB-->>S: buyer, amount, signature
        S->>ESC: settleBatch(vouchers, signatures)
    end

    ESC->>BC: Transfer USDC to vendor
    BC-->>ESC: Transfer confirmed
    ESC-->>S: Settlement tx hash

    S->>DB: Update voucher status = settled
    S->>DB: Update perkos_x402_transactions

    S-->>V: { success, transactions[], totalSettled }
```

#### Gas Sponsorship Flow

```mermaid
sequenceDiagram
    autonumber
    participant A as Agent
    participant S as PerkOS Stack
    participant DB as Supabase
    participant TW as Thirdweb
    participant BC as Blockchain

    A->>S: POST /api/v2/x402/settle
    Note over A,S: Payment with sponsor request

    S->>DB: Check sponsor wallet rules
    DB-->>S: perkos_sponsor_rules

    alt Sponsor Available
        S->>DB: Check spending limits
        DB-->>S: Daily/monthly usage

        alt Within Limits
            S->>TW: Create sponsored transaction
            TW->>BC: Execute with sponsor gas
            BC-->>TW: Transaction confirmed
            TW-->>S: Sponsored tx hash

            S->>DB: Record sponsor spending
            S->>DB: Update perkos_sponsor_transactions
        else Limits Exceeded
            S-->>A: { error: "Sponsor limit exceeded" }
        end
    else No Sponsor
        S->>TW: Create standard transaction
        TW->>BC: Execute (agent pays gas)
        BC-->>TW: Transaction confirmed
    end

    S-->>A: { success, transaction, sponsored }
```

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

### Docker

```bash
docker build -t perkos-stack .
docker run -p 3402:3402 perkos-stack
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Facilitator private key |
| `NEXT_PUBLIC_PAYMENT_RECEIVER` | Yes | Payment receiver address |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Yes | Thirdweb client ID |
| `THIRDWEB_SECRET_KEY` | Yes | Thirdweb secret key |
| `NEXT_PUBLIC_DEFERRED_ENABLED` | No | Enable deferred scheme |
| `NEXT_PUBLIC_FACILITATOR_NAME` | No | Facilitator display name |
| `NEXT_PUBLIC_FACILITATOR_URL` | No | Facilitator base URL |

## Smart Contracts

PerkOS Stack uses UUPS upgradeable contracts for the deferred payment escrow:

```bash
# Deploy upgradeable contracts
npm run deploy:avalanche-fuji
npm run deploy:base-sepolia

# Upgrade existing contracts
PROXY_ADDRESS=0x... npm run upgrade:avalanche-fuji
```

## Integration Example

### Verify and Settle Payment

```typescript
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

// 1. Client creates payment payload
const paymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: "base",
  payload: {
    signature: "0x...",
    authorization: {
      from: clientAddress,
      to: vendorAddress,
      value: "1000000", // 1 USDC
      validAfter: "0",
      validBefore: String(Math.floor(Date.now() / 1000) + 3600),
      nonce: "0x..."
    }
  }
};

// 2. Verify payment
const verifyResponse = await fetch('https://your-stack.com/api/v2/x402/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    x402Version: 1,
    paymentPayload,
    paymentRequirements: {
      scheme: "exact",
      network: "base",
      maxAmountRequired: "1000000",
      resource: "/api/service",
      payTo: vendorAddress,
      maxTimeoutSeconds: 3600,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  })
});

const { isValid, payer } = await verifyResponse.json();
console.log('Request ID:', verifyResponse.headers.get('X-x402-Request-Id'));

// 3. Settle payment
if (isValid) {
  const settleResponse = await fetch('https://your-stack.com/api/v2/x402/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ /* same payload */ })
  });

  const { success, receipt } = await settleResponse.json();
  console.log('Block Explorer:', receipt.settlement.blockExplorer);
}
```

## Resources

- [x402 Protocol V2](https://x402.org/writing/x402-v2-launch) - Official V2 announcement
- [x402 Documentation](https://x402.gitbook.io/x402) - Protocol specification
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) - Trustless Agent Discovery
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) - Transfer With Authorization
- [CAIP Standards](https://github.com/ChainAgnostic/CAIPs) - Chain Agnostic Identifiers

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Built with x402 V2** | **Powered by PerkOS Stack**

*Stack it. Ship it. Scale it.*
