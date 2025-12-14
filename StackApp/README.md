# x402 Avalanche Facilitator - Next.js App Router

Standards-compliant x402 Payment Facilitator built with Next.js 15 App Router on Avalanche blockchain.

## Features

- ✅ **Next.js 15** with App Router
- ✅ **TypeScript** for type safety
- ✅ **Tailwind CSS** for styling
- ✅ **Viem** for Ethereum interactions
- ✅ **Hardhat** for smart contract development
- ✅ **Exact Scheme** (EIP-3009)
- ✅ **Deferred Scheme** (Voucher-based)

## Quick Start

### 1. Install Dependencies

```bash
cd ServerApp
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```bash
# Required
PRIVATE_KEY=0x...your-private-key...
NEXT_PUBLIC_X402_PAYMENT_TOKEN=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
NEXT_PUBLIC_X402_PAYMENT_RECEIVER=0x...your-receiver-address...

# Optional - Enable deferred scheme
NEXT_PUBLIC_DEFERRED_ENABLED=true
NEXT_PUBLIC_DEFERRED_ESCROW_ADDRESS=0x...deployed-escrow-address...
```

### 3. Deploy Contracts (Optional - for deferred scheme)

**Compile:**
```bash
npm run compile
```

**Deploy to Fuji Testnet:**
```bash
npm run deploy:contracts fuji
```

**Deploy to Avalanche Mainnet:**
```bash
npm run deploy:contracts avalanche
```

Copy the deployed escrow address to your `.env` file.

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3402](http://localhost:3402)

## Project Structure

```
ServerApp/
├── app/
│   ├── api/
│   │   ├── v2/x402/          # Standard x402 API
│   │   │   ├── verify/
│   │   │   ├── settle/
│   │   │   ├── supported/
│   │   │   ├── health/
│   │   │   └── config/
│   │   ├── deferred/         # Deferred scheme API
│   │   │   ├── info/
│   │   │   ├── vouchers/
│   │   │   ├── settle-batch/
│   │   │   └── escrow/balance/
│   │   └── .well-known/      # Well-known endpoints
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── contracts/            # Solidity contracts
│   ├── services/             # Business logic
│   ├── types/                # TypeScript types
│   └── utils/                # Utilities
└── scripts/
    └── deploy.ts             # Contract deployment
```

## API Endpoints

### Standard x402 Facilitator

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/x402/verify` | Verify payment payload |
| POST | `/api/v2/x402/settle` | Settle payment on-chain |
| GET | `/api/v2/x402/supported` | Supported schemes/networks |
| GET | `/api/v2/x402/health` | Health check |
| GET | `/api/v2/x402/config` | Configuration |

### Deferred Scheme

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deferred/info` | Scheme configuration |
| GET | `/api/deferred/vouchers` | List stored vouchers |
| POST | `/api/deferred/vouchers` | Store a voucher |
| POST | `/api/deferred/vouchers/:id/:nonce/settle` | Settle specific voucher |
| POST | `/api/deferred/settle-batch` | Batch settle vouchers |
| GET | `/api/deferred/escrow/balance` | Query escrow balance |

### Well-Known

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/.well-known/agent-card.json` | A2A Agent Card |
| GET | `/api/.well-known/x402-payment.json` | x402 Payment Config |
| GET | `/api/.well-known/erc-8004.json` | ERC-8004 Registry Info |

## Example Usage

### Verify Payment

```bash
curl -X POST http://localhost:3402/api/v2/x402/verify \
  -H "Content-Type: application/json" \
  -d '{
    "x402Version": 1,
    "paymentPayload": {
      "x402Version": 1,
      "scheme": "exact",
      "network": "avalanche",
      "payload": {
        "signature": "0x...",
        "authorization": {
          "from": "0x...",
          "to": "0x...",
          "value": "1000000",
          "validAfter": "0",
          "validBefore": "1735689600",
          "nonce": "0x..."
        }
      }
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "avalanche",
      "maxAmountRequired": "1000000",
      "resource": "https://api.example.com/endpoint",
      "payTo": "0x...",
      "maxTimeoutSeconds": 60,
      "asset": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    }
  }'
```

### Check Health

```bash
curl http://localhost:3402/api/v2/x402/health
```

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run typecheck

# Lint code
npm run lint
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository to Vercel
3. Add environment variables
4. Deploy

### Self-Hosted

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_AVALANCHE_RPC_URL` | No | Avalanche mainnet RPC |
| `NEXT_PUBLIC_AVALANCHE_TESTNET_RPC_URL` | No | Avalanche testnet RPC |
| `PRIVATE_KEY` | Yes | Facilitator private key |
| `NEXT_PUBLIC_X402_PAYMENT_TOKEN` | Yes | Payment token address (USDC) |
| `NEXT_PUBLIC_X402_PAYMENT_RECEIVER` | Yes | Payment receiver address |
| `NEXT_PUBLIC_DEFERRED_ENABLED` | No | Enable deferred scheme |
| `NEXT_PUBLIC_DEFERRED_ESCROW_ADDRESS` | Conditional | Escrow contract address |
| `NEXT_PUBLIC_FACILITATOR_NAME` | No | Facilitator name |
| `NEXT_PUBLIC_FACILITATOR_DESCRIPTION` | No | Facilitator description |
| `NEXT_PUBLIC_FACILITATOR_URL` | No | Facilitator URL |

## Supported Tokens (Avalanche)

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 6 |
| USDC.e | `0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664` | 6 |
| USDT | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | 6 |

## Gas Tracking & Analytics Workflow

The system tracks both x402 USDC payments and native token gas costs paid by sponsor wallets.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        x402 Payment Transaction                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Client signs EIP-3009 authorization (USDC payment)                  │
│     - from: client wallet                                               │
│     - to: vendor address                                                │
│     - value: USDC amount                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. Facilitator calls ExactSchemeService.settle()                       │
│     - Looks up sponsor wallet for client                                │
│     - Sponsor wallet pays gas in native token (AVAX/ETH/CELO)          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. ThirdwebTransactionService.executeTransferWithAuthorization()       │
│     - Executes transferWithAuthorization via Thirdweb Engine            │
│     - Polls for transaction hash                                        │
│     - Fetches transaction receipt for gas info                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. Transaction Receipt Processing                                      │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │  gasUsed: actual gas units consumed                             │ │
│     │  effectiveGasPrice: gas price in wei                            │ │
│     │  gasCostWei: gasUsed × effectiveGasPrice (native token)         │ │
│     └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│  5a. Log x402 Transaction (USDC)  │ │  5b. Log Sponsor Spending (Gas)   │
│  ─────────────────────────────────│ │  ─────────────────────────────────│
│  Table: perkos_x402_transactions  │ │  Table: perkos_sponsor_spending   │
│  ─────────────────────────────────│ │  ─────────────────────────────────│
│  • transaction_hash               │ │  • sponsor_wallet_id              │
│  • payer_address (client)         │ │  • amount_wei (gas cost)          │
│  • recipient_address (vendor)     │ │  • agent_address                  │
│  • amount_wei (USDC)              │ │  • transaction_hash               │
│  • network, chain_id              │ │  • chain_id, network_name         │
│  • scheme: "exact"                │ │  • created_at                     │
└───────────────────────────────────┘ └───────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│  Dashboard: Transaction History   │ │  Dashboard: Gas Payment Analytics │
│  /api/x402/transactions           │ │  /api/sponsor/analytics           │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

### Key Services

| Service | File | Purpose |
|---------|------|---------|
| `ExactSchemeService` | `lib/services/ExactSchemeService.ts` | Processes EIP-3009 payments, logs transactions |
| `ThirdwebTransactionService` | `lib/services/ThirdwebTransactionService.ts` | Executes transactions via Thirdweb, fetches gas info |
| `TransactionLoggingService` | `lib/services/TransactionLoggingService.ts` | Logs to `perkos_x402_transactions` and `perkos_sponsor_spending` |

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `perkos_x402_transactions` | x402 payment records | `amount_wei` (USDC), `payer_address`, `recipient_address` |
| `perkos_sponsor_spending` | Gas costs by sponsor | `amount_wei` (native token), `sponsor_wallet_id` |
| `perkos_sponsor_wallets` | Sponsor wallet registry | `sponsor_address`, `user_wallet_address`, `balance` |
| `perkos_sponsor_rules` | Agent whitelist rules | `agent_address`, `sponsor_wallet_id` |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/x402/transactions` | x402 transaction history |
| GET | `/api/sponsor/analytics` | Gas spending analytics |
| GET | `/api/sponsor/wallets/[id]/balance` | Sponsor wallet balance |
| GET | `/api/dashboard/stats` | Combined dashboard stats |

### Gas Cost Calculation

```typescript
// In ThirdwebTransactionService.getTransactionReceipt()
const receipt = await client.getTransactionReceipt({ hash: transactionHash });

const gasUsed = receipt.gasUsed;                    // Gas units consumed
const effectiveGasPrice = receipt.effectiveGasPrice; // Wei per gas unit
const gasCostWei = gasUsed * effectiveGasPrice;     // Total gas cost in wei

// Example on Avalanche:
// gasUsed: 65000
// effectiveGasPrice: 25000000000 (25 gwei)
// gasCostWei: 1625000000000000 (0.001625 AVAX)
```

## Resources

- [x402 Protocol](https://x402.gitbook.io/x402)
- [CDP x402 Documentation](https://docs.cdp.coinbase.com/x402)
- [Next.js Documentation](https://nextjs.org/docs)
- [Viem Documentation](https://viem.sh)

## License

MIT
