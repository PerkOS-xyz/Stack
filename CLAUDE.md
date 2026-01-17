# PerkOS Stack — Infrastructure Middleware

## Project Overview

**PerkOS Stack** is enterprise-grade agent infrastructure that provides the complete backbone for building agent-powered applications. Built on the x402 protocol, PerkOS Stack delivers production-ready REST APIs, micropayment infrastructure, agent discovery, and ERC-8004 identity management in one unified platform.

Supports both exact (EIP-3009) and deferred (EIP-712) payment schemes across multiple blockchain networks with native multi-chain support.

### Key Features

- 🔌 **REST APIs**: Standards-compliant x402 facilitator endpoints for payment verification and settlement
- 💰 **x402 Micropayments**: Dual payment schemes (exact + deferred) with gasless transactions
- 🪪 **ERC-8004 Identity**: On-chain agent identity NFTs (ERC-721) with metadata storage
- ⭐ **Reputation System**: On-chain feedback with EIP-712 signatures and aggregated ratings
- 🛡️ **Validation Registry**: Stake-based validator attestations with confidence scoring
- ⛓️ **Multi-Chain**: 16 networks including Avalanche, Base, Ethereum, Polygon, Arbitrum, Optimism
- 🔐 **Production-Ready**: UUPS upgradeable contracts, event indexing, and enterprise security
- 📊 **Analytics & Monitoring**: Real-time dashboards and network statistics

## Project Structure

```
PerkOS-Stack/
├── CLAUDE.md                     # This file - Main project documentation
├── Documents/                    # Detailed guides and documentation
│   ├── FIREBASE_SETUP.md        # Database setup guide
│   ├── DEPLOYMENT_CHECKLIST.md  # Production deployment
│   ├── X402_DEFERRED_SCHEME.md  # Deferred payments guide
│   ├── MULTI_CHAIN_GUIDE.md     # Multi-chain configuration
│   └── COMPARISON.md            # Solution comparison
├── SmartContracts/               # Smart contracts directory (Foundry)
│   ├── src/                      # Solidity smart contracts
│   │   ├── DeferredPaymentEscrow.sol            # Legacy non-upgradeable
│   │   ├── DeferredPaymentEscrowUpgradeable.sol # UUPS upgradeable (recommended)
│   │   └── erc8004/              # ERC-8004 Registry Contracts
│   │       ├── IIdentityRegistry.sol            # Identity interface
│   │       ├── IdentityRegistry.sol             # ERC-721 agent identity NFT
│   │       ├── IReputationRegistry.sol          # Reputation interface
│   │       ├── ReputationRegistry.sol           # On-chain feedback system
│   │       ├── IValidationRegistry.sol          # Validation interface
│   │       └── ValidationRegistry.sol           # Third-party attestations
│   ├── scripts/                  # Deployment scripts
│   │   └── deploy-erc8004.ts     # ERC-8004 registry deployment
│   ├── script/                   # Foundry scripts
│   │   └── DeployUpgradeable.s.sol
│   ├── lib/                      # Dependencies (forge-std, openzeppelin)
│   └── foundry.toml              # Foundry configuration
└── StackApp/                     # PerkOS Stack middleware server (port 3402)
    ├── app/                      # Next.js 15 App Router
    │   ├── page.tsx              # Landing page with analytics
    │   ├── dashboard/            # Admin dashboard
    │   ├── networks/             # Network statistics
    │   ├── transactions/         # Transaction history
    │   ├── marketplace/          # Service provider marketplace
    │   ├── agents/               # Community agents directory
    │   └── api/                  # API routes (20+ endpoints)
    │       ├── v2/x402/          # x402 protocol endpoints
    │       │   ├── verify/       # Payment verification
    │       │   ├── settle/       # Payment settlement
    │       │   ├── supported/    # Supported payment methods
    │       │   ├── config/       # Configuration endpoint
    │       │   └── health/       # Health check
    │       ├── .well-known/      # Discovery endpoints
    │       │   ├── agent-card.json/     # Agent metadata (ActivityPub-style)
    │       │   ├── erc-8004.json/       # ERC-8004 agent registration
    │       │   └── x402-payment.json/   # x402 payment metadata
    │       ├── erc8004/          # ERC-8004 Registry API endpoints
    │       │   ├── identity/     # Agent identity registration
    │       │   ├── reputation/   # Feedback and ratings
    │       │   └── validation/   # Third-party attestations
    │       ├── deferred/         # Deferred scheme endpoints
    │       │   ├── info/         # Deferred scheme info
    │       │   ├── vouchers/     # Voucher management
    │       │   ├── settle-batch/ # Batch settlement
    │       │   └── escrow/       # Escrow operations
    │       ├── dashboard/        # Dashboard statistics
    │       │   └── stats/        # Analytics data
    │       └── sponsor/          # Sponsorship endpoints
    │           └── wallets/      # Wallet management
    ├── lib/                      # Core business logic
    │   ├── services/             # Service layer (6 core services)
    │   │   ├── X402Service.ts           # Main x402 protocol orchestrator
    │   │   ├── ExactSchemeService.ts    # EIP-3009 exact payments
    │   │   ├── DeferredSchemeService.ts # EIP-712 deferred payments
    │   │   ├── EventIndexer.ts          # Blockchain event indexing
    │   │   ├── ThirdwebService.ts       # Thirdweb SDK integration
    │   │   └── TurnkeyService.ts        # Turnkey wallet management
    │   ├── db/                   # Database layer (Firebase)
    │   │   └── firebase.ts       # Firebase Firestore client
    │   ├── utils/                # Utilities
    │   │   ├── chains.ts         # Multi-chain config (16 networks)
    │   │   ├── config.ts         # Application configuration
    │   │   └── logger.ts         # Logging utilities
    │   ├── types/                # TypeScript types
    │   │   └── x402.ts           # x402 protocol types
    │   ├── contracts/            # Smart contract ABIs
    │   │   └── erc8004/          # ERC-8004 registry ABIs
    │   │       ├── IdentityRegistry.ts
    │   │       ├── ReputationRegistry.ts
    │   │       ├── ValidationRegistry.ts
    │   │       └── index.ts
    │   └── config/               # Configuration files
    ├── scripts/                  # Deployment and utility scripts
    │   ├── deploy-upgradeable.ts # UUPS proxy deployment (recommended)
    │   ├── upgrade.ts            # Contract upgrade script
    │   ├── deploy.ts             # Legacy contract deployment
    │   └── deploy-all.ts         # Multi-network deployment
    ├── DATABASE_TABLES.md        # Database schema (5 tables)
    ├── README_PRODUCTION.md      # Production setup summary
    ├── package.json              # Dependencies
    └── hardhat.config.ts         # Hardhat configuration
```

## Architecture

### Middleware Server Overview

The **MiddlewareApp** is a Next.js 15 middleware server that powers PerkOS Stack infrastructure:

**Primary Functions:**

- 🔄 **Protocol Orchestration**: Routes x402 payment requests between wallets and services
- ✅ **Payment Verification**: Validates signatures, amounts, and network parameters
- ⛓️ **On-Chain Settlement**: Executes payments on blockchain networks
- 📊 **Event Indexing**: Monitors and indexes blockchain transactions to database
- 🔍 **Agent Discovery**: Provides ERC-8004 compliant discovery endpoints
- 💰 **Deferred Payments**: Manages off-chain voucher aggregation and batch settlement

**Key Capabilities:**

- Supports 6 blockchain networks (Avalanche, Base, Celo + testnets)
- Dual payment schemes (exact via EIP-3009, deferred via EIP-712)
- Gasless transactions via Thirdweb sponsorship
- Real-time analytics and reputation tracking
- Multi-wallet support (Thirdweb, Turnkey)

### Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Database**: Firebase Firestore with 5 core collections (perkos\_\* prefix)
- **Smart Contracts**: Foundry, Solidity 0.8.20+, OpenZeppelin Upgradeable
- **Blockchain**: Viem 2.40+, Thirdweb 5.114+, multi-chain RPC providers
- **Wallet Integration**: Para SDK (@getpara/react-sdk), Thirdweb SDK, Turnkey wallet service
- **Event Indexing**: Custom blockchain event listener service (EventIndexer)
- **ERC-8004**: Three on-chain registries (Identity, Reputation, Validation)

### Para Wallet Integration

PerkOS Stack uses **Para SDK** for user wallet management with full customization:

**Features:**

- Multi-chain wallet support (Ethereum, Base, Celo, Optimism, Arbitrum)
- External wallet connections (MetaMask, Phantom)
- Social login (Google, Twitter, Discord)
- On-ramp support for fiat-to-crypto
- Custom dark theme with full color palette

**Theme Configuration** (`app/providers.tsx`):

```typescript
paraModalConfig={{
  theme: {
    backgroundColor: "#1e293b",
    foregroundColor: "#f3ebeb",
    accentColor: "#4e6edf",
    mode: "dark",
    borderRadius: "md",
    customPalette: {
      text: {
        primary: "#f3ebeb",
        secondary: "#c4c4c4",
        subtle: "#9ca3af",
        inverted: "#090b0e",
        error: "#ef4444",
      },
      modal: {
        surface: { main: "#090b0e", footer: "#111318" },
        border: "#2a2e37",
      },
    },
  },
}}
```

**User Menu Options:**
| Option | Icon | Description |
|--------|------|-------------|
| User Wallet | 👛 | Opens Para modal for on-ramp, send/receive, wallet tools |
| Sponsor Wallets | 💰 | Manage sponsor wallets (visible when sponsor wallet exists) |

### Middleware Server Architecture

The **MiddlewareApp** is the main middleware server that:

- Runs on port **3402** (configurable)
- Orchestrates x402 payment protocol between wallets and services
- Manages 6 blockchain networks (3 mainnet + 3 testnet)
- Implements dual payment schemes (exact + deferred)
- Provides ERC-8004 compliant agent discovery
- Indexes blockchain events to Firebase Firestore database

### Core Services

#### 1. X402Service (Main Orchestrator)

- Routes requests to ExactSchemeService or DeferredSchemeService
- Validates x402 protocol version and network compatibility
- Manages payment verification and settlement workflows
- Coordinates multi-network support

#### 2. ExactSchemeService (EIP-3009)

- Implements immediate payment execution
- ECDSA signature recovery and verification
- Nonce tracking to prevent replay attacks
- On-chain settlement via `transferWithAuthorization`

#### 3. DeferredSchemeService (EIP-712)

- Implements off-chain voucher aggregation
- EIP-712 structured data signing
- Batch settlement with escrow contracts
- Voucher state management in database

#### 4. EventIndexer

- Monitors blockchain events across all networks
- Indexes transaction data to Firebase Firestore
- Updates agent reputation metrics
- Aggregates network statistics

#### 5. ThirdwebService

- Thirdweb SDK integration for wallet interactions
- Sponsored transactions for gasless payments
- Multi-chain wallet management

#### 6. TurnkeyService

- Turnkey wallet infrastructure integration
- Secure key management
- Transaction signing and submission

### Database Schema (5 Tables)

All tables use `perkos_` prefix for shared database deployments:

1. **perkos_transactions** - Payment transactions (exact + deferred)
2. **perkos_vouchers** - Deferred payment vouchers
3. **perkos_agents** - Agent reputation and metadata
4. **perkos_reviews** - Community reviews and ratings
5. **perkos_network_stats** - Daily aggregated network statistics

See [DATABASE_TABLES.md](MiddlewareApp/DATABASE_TABLES.md) for complete schema reference.

## x402 Protocol Implementation

### Payment Schemes

#### 1. Exact Scheme (EIP-3009)

Immediate payment execution using EIP-3009 `transferWithAuthorization`.

```typescript
// Example: Exact payment verification
POST /api/v2/x402/verify
{
  "x402Version": 1,
  "paymentPayload": {
    "scheme": "exact",
    "network": "avalanche",
    "payload": {
      "signature": "0x...",
      "authorization": {
        "from": "0x...",
        "to": "0x...",
        "value": "1000000",
        "validAfter": "0",
        "validBefore": "1234567890",
        "nonce": "0x..."
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "avalanche",
    "maxAmountRequired": "1000000",
    "resource": "/api/service",
    "payTo": "0x...",
    "maxTimeoutSeconds": 3600,
    "asset": "0x..."
  }
}
```

#### 2. Deferred Scheme (EIP-712)

Off-chain voucher aggregation with batch settlement.

```typescript
// Example: Deferred payment verification
POST /api/v2/x402/verify
{
  "x402Version": 1,
  "paymentPayload": {
    "scheme": "deferred",
    "network": "avalanche",
    "payload": {
      "voucher": {
        "id": "0x...",
        "buyer": "0x...",
        "seller": "0x...",
        "valueAggregate": "5000000",
        "asset": "0x...",
        "timestamp": "1234567890",
        "nonce": "1",
        "escrow": "0x...",
        "chainId": "43114"
      },
      "signature": "0x..."
    }
  },
  "paymentRequirements": {
    "scheme": "deferred",
    "network": "avalanche",
    "maxAmountRequired": "1000000",
    "resource": "/api/service",
    "payTo": "0x...",
    "maxTimeoutSeconds": 3600,
    "asset": "0x...",
    "extra": {
      "type": "aggregation",
      "escrow": "0x...",
      "facilitator": "https://x402.perkos.io"
    }
  }
}
```

### Supported Networks

| Network           | Chain ID | Type    | USDC Address     | Status                 |
| ----------------- | -------- | ------- | ---------------- | ---------------------- |
| Avalanche C-Chain | 43114    | Mainnet | 0xB97E...c48a6E  | ✅ Active              |
| Base              | 8453     | Mainnet | 0x8335...dA02913 | ✅ Active              |
| Celo              | 42220    | Mainnet | 0xcebA...2118C   | 🔧 Infrastructure only |
| Avalanche Fuji    | 43113    | Testnet | 0x5425...31Bc65  | ✅ Active              |
| Base Sepolia      | 84532    | Testnet | 0x036C...3dCF7e  | ✅ Active              |
| Celo Sepolia      | 11142220 | Testnet | TBD              | 🔧 Infrastructure only |

**Note**: Celo network support exists in infrastructure (chains.ts) but is currently hidden from UI screens. The middleware supports all 6 networks for future expansion.

## ERC-8004: Trustless Agent Discovery

PerkOS Stack implements **ERC-8004** for standardized agent discovery and trust mechanisms with three on-chain registries.

### On-Chain Registry Architecture

ERC-8004 defines three interconnected registries for complete agent lifecycle management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ERC-8004 Registry System                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │    Identity     │    │   Reputation    │    │   Validation    │ │
│  │    Registry     │───▶│    Registry     │◀───│    Registry     │ │
│  │   (ERC-721)     │    │  (On-chain)     │    │  (Attestations) │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│         │                       │                       │          │
│         ▼                       ▼                       ▼          │
│  • Agent NFT mint        • Feedback/ratings      • Validator stake │
│  • Metadata storage      • EIP-712 signatures    • Attestations    │
│  • Owner management      • Summary aggregation   • Confidence score│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Identity Registry (ERC-721)

The Identity Registry mints unique NFTs representing agent identities on-chain.

**Smart Contract**: `SmartContracts/src/erc8004/IdentityRegistry.sol`

```solidity
// Core functions
function register(string memory tokenURI_) external returns (uint256 agentId);
function register(string memory tokenURI_, Metadata[] memory metadata) external returns (uint256 agentId);
function setMetadata(uint256 agentId, string memory key, bytes memory value) external;
function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory);
function getAgentsByOwner(address owner) external view returns (uint256[] memory);
function totalAgents() external view returns (uint256);
```

**Key Features**:

- ERC-721 compliant agent identity NFT
- URIStorage for metadata management
- Owner-controlled metadata updates
- Enumerable agent queries

### 2. Reputation Registry (On-Chain Feedback)

The Reputation Registry enables cryptographically-signed feedback from clients.

**Smart Contract**: `SmartContracts/src/erc8004/ReputationRegistry.sol`

```solidity
// Feedback with EIP-712 authorization
struct FeedbackAuth {
    uint256 agentId;
    address client;
    uint256 nonce;
    uint256 deadline;
}

struct Feedback {
    address client;
    int8 rating;        // -100 to +100
    string comment;
    uint256 timestamp;
    bool revoked;
    string response;    // Agent's response
}

// Core functions
function giveFeedback(uint256 agentId, int8 rating, string memory comment) external returns (uint256);
function giveFeedback(uint256 agentId, int8 rating, string memory comment, FeedbackAuth memory auth, bytes memory signature) external returns (uint256);
function revokeFeedback(uint256 agentId, uint256 index) external;
function appendResponse(uint256 agentId, uint256 index, string memory response) external;
function getSummary(uint256 agentId) external view returns (ReputationSummary memory);
```

**Key Features**:

- EIP-712 typed signature support for delegated feedback
- Rating scale from -100 (worst) to +100 (best)
- Agent response capability
- Aggregated reputation summary (average, positive/negative counts)

### 3. Validation Registry (Third-Party Attestations)

The Validation Registry allows trusted validators to provide attestations about agents.

**Smart Contract**: `SmartContracts/src/erc8004/ValidationRegistry.sol`

```solidity
struct Validator {
    string name;
    string metadataURI;
    uint256 stake;
    uint256 registeredAt;
    bool active;
    uint256 attestationCount;
}

struct Attestation {
    address validator;
    string attestationType;     // e.g., "security-audit", "performance", "compliance"
    bytes32 dataHash;
    string dataURI;
    uint256 createdAt;
    uint256 expiresAt;
    bool revoked;
    uint8 confidenceScore;      // 0-100
}

// Validator management (requires minimum stake)
function registerValidator(string memory name, string memory metadataURI) external payable;
function updateStake() external payable;
function withdrawStake(uint256 amount) external;

// Attestation management
function attest(uint256 agentId, string memory attestationType, bytes32 dataHash, string memory dataURI, uint256 validityPeriod, uint8 confidenceScore) external returns (uint256);
function revokeAttestation(uint256 agentId, uint256 attestationId) external;
function getValidationSummary(uint256 agentId) external view returns (ValidationSummary memory);
function hasValidAttestation(uint256 agentId, string memory attestationType) external view returns (bool);
```

**Key Features**:

- Stake-based validator registration (cryptoeconomic security)
- Multiple attestation types (security, compliance, performance, etc.)
- Expiring attestations with confidence scores
- Aggregated validation summary per agent

### Discovery Endpoints

#### 1. Agent Card (ActivityPub-style)

```
GET /.well-known/agent-card.json
```

Returns agent metadata with payment capabilities:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "0x...",
  "type": "Agent",
  "name": "PerkOS x402 Middleware",
  "description": "Community-friendly multi-chain payment facilitator",
  "url": "https://x402.perkos.io",
  "capabilities": [
    "x402-payment-exact",
    "x402-payment-deferred",
    "erc-8004-discovery",
    "bazaar-discovery"
  ],
  "paymentMethods": [
    {
      "scheme": "exact",
      "network": "avalanche",
      "asset": "0x..."
    }
  ],
  "endpoints": {
    "x402": "https://x402.perkos.io/api/v2/x402",
    "discovery": "https://x402.perkos.io/discovery"
  }
}
```

#### 2. ERC-8004 Registration

```
GET /.well-known/erc-8004.json
```

Returns ERC-8004 compliant agent registration with on-chain registry integration:

```json
{
  "schemaVersion": "1.0.0",
  "spec": "ERC-8004",
  "agent": {
    "name": "Stack",
    "description": "Multi-chain x402 payment infrastructure",
    "image": "https://x402.perkos.io/logo.png"
  },
  "identity": {
    "format": "caip-2",
    "chains": [
      {
        "chainId": "eip155:43114",
        "registryAddress": "0x...",
        "agentId": null
      }
    ]
  },
  "endpoints": {
    "a2a": "https://x402.perkos.io/api/v2/x402",
    "mcp": null,
    "discovery": "https://x402.perkos.io/api/.well-known/erc-8004.json"
  },
  "registries": {
    "identity": {
      "address": "0x...",
      "network": "avalanche"
    },
    "reputation": {
      "address": "0x...",
      "network": "avalanche"
    },
    "validation": {
      "address": "0x...",
      "network": "avalanche"
    }
  },
  "trustModels": [
    {
      "type": "reputation",
      "description": "On-chain feedback from clients with EIP-712 signatures",
      "enabled": true,
      "registry": "reputation"
    },
    {
      "type": "cryptoeconomic",
      "description": "Stake-secured validator attestations",
      "enabled": true,
      "registry": "validation"
    }
  ]
}
```

### ERC-8004 API Endpoints

#### Identity Registry API

```
GET  /api/erc8004/identity?network=avalanche                    # Get identity info
POST /api/erc8004/identity                                       # Register new agent
PUT  /api/erc8004/identity                                       # Update metadata
```

#### Reputation Registry API

```
GET  /api/erc8004/reputation?network=avalanche&agentId=1        # Get reputation
POST /api/erc8004/reputation                                     # Submit feedback
```

#### Validation Registry API

```
GET  /api/erc8004/validation?network=avalanche&agentId=1        # Get attestations
POST /api/erc8004/validation                                     # Create attestation
```

### ERC-8004 Trust Models

1. **Reputation System** (✅ Implemented)

   - On-chain feedback with EIP-712 signatures
   - Rating scale from -100 to +100
   - Agent response capability
   - Aggregated reputation metrics

2. **Crypto-economic Validation** (✅ Implemented)

   - Stake-based validator registration
   - Multiple attestation types
   - Confidence scoring (0-100)
   - Expiring attestations

3. **TEE Attestation** (🔜 Planned)
   - Trusted Execution Environment verification
   - Hardware-based security guarantees
   - Confidential computing support

### Environment Configuration

```bash
# ERC-8004 Registry Addresses (per network)
NEXT_PUBLIC_AVALANCHE_IDENTITY_REGISTRY=0x...
NEXT_PUBLIC_AVALANCHE_REPUTATION_REGISTRY=0x...
NEXT_PUBLIC_AVALANCHE_VALIDATION_REGISTRY=0x...

NEXT_PUBLIC_BASE_IDENTITY_REGISTRY=0x...
NEXT_PUBLIC_BASE_REPUTATION_REGISTRY=0x...
NEXT_PUBLIC_BASE_VALIDATION_REGISTRY=0x...

# ... similar for all 16 supported networks
```

### Deployment

Deploy all three registries using the Foundry deployment script:

```bash
cd SmartContracts

# Deploy to testnet
forge script scripts/deploy-erc8004.ts --rpc-url avalanche-fuji --broadcast

# Deploy to mainnet
forge script scripts/deploy-erc8004.ts --rpc-url avalanche --broadcast
```

The deployment script automatically:

1. Deploys IdentityRegistry first
2. Deploys ReputationRegistry linked to IdentityRegistry
3. Deploys ValidationRegistry linked to IdentityRegistry
4. Sets minimum stake for validators
5. Outputs all contract addresses for `.env` configuration

## API Reference

### Core Endpoints

#### 1. Verify Payment

Validates a payment payload against requirements.

```
POST /api/v2/x402/verify
```

**Request Body**:

```typescript
{
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}
```

**Response**:

```typescript
{
  isValid: boolean;
  invalidReason: string | null;
  payer: Address | null;
}
```

#### 2. Settle Payment

Executes the payment on-chain.

```
POST /api/v2/x402/settle
```

**Request Body**: Same as verify

**Response**:

```typescript
{
  success: boolean;
  error: string | null;
  payer: Address | null;
  transaction: Hex | null;
  network: string;
}
```

#### 3. Supported Payment Methods

Returns all supported payment schemes and networks.

```
GET /api/v2/x402/supported
```

**Response**:

```typescript
{
  kinds: Array<{
    scheme: "exact" | "deferred";
    network: string;
  }>;
}
```

### Discovery Endpoints

```
GET /api/.well-known/agent-card.json      # Agent metadata (ActivityPub-style)
GET /api/.well-known/erc-8004.json        # ERC-8004 agent registration
GET /api/.well-known/x402-payment.json    # x402 payment metadata
GET /api/v2/x402/config                   # Configuration endpoint
GET /api/v2/x402/health                   # Health check endpoint
GET /api/dashboard/stats                  # Dashboard statistics
```

### ERC-8004 Registry Endpoints

```
GET  /api/erc8004/identity                # Get agent identity info
POST /api/erc8004/identity                # Register new agent identity
PUT  /api/erc8004/identity                # Update agent metadata

GET  /api/erc8004/reputation              # Get agent reputation summary
POST /api/erc8004/reputation              # Submit feedback for agent

GET  /api/erc8004/validation              # Get agent attestations
POST /api/erc8004/validation              # Create new attestation (validators only)
```

### Deferred Payment Endpoints

```
GET  /api/deferred/info                   # Deferred scheme information
GET  /api/deferred/vouchers               # List all vouchers
POST /api/deferred/vouchers/{id}/{nonce}/settle  # Settle specific voucher
POST /api/deferred/settle-batch           # Batch settle multiple vouchers
GET  /api/deferred/escrow/balance         # Check escrow balance
```

### Sponsorship Endpoints

```
GET /api/sponsor/wallets                  # Wallet management for sponsored transactions
```

## Configuration

### Environment Variables

```bash
# Network Configuration
NEXT_PUBLIC_AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org
NEXT_PUBLIC_CELO_RPC=https://forno.celo.org

# Facilitator Configuration
NEXT_PUBLIC_FACILITATOR_NAME="PerkOS x402 Middleware"
NEXT_PUBLIC_FACILITATOR_DESCRIPTION="Community-friendly multi-chain payment facilitator"
NEXT_PUBLIC_FACILITATOR_URL=https://x402.perkos.io
NEXT_PUBLIC_PAYMENT_RECEIVER=0x...  # Facilitator wallet address

# Payment Configuration
NEXT_PUBLIC_PAYMENT_TOKEN=0x...     # USDC or payment token address
NEXT_PUBLIC_DEFERRED_ENABLED=true   # Enable deferred payments

# Private Keys (Server-side only)
PRIVATE_KEY=0x...                   # Facilitator private key for settlements
```

### Chain Configuration

The middleware supports 6 networks defined in [MiddlewareApp/lib/utils/chains.ts](MiddlewareApp/lib/utils/chains.ts):

```typescript
// Supported networks array
export const SUPPORTED_NETWORKS = [
  "avalanche",
  "avalanche-fuji",
  "celo",
  "celo-sepolia",
  "base",
  "base-sepolia",
] as const;

// Chain definitions using Viem
export const chains: Record<string, Chain> = {
  avalanche: defineChain({ id: 43114, name: "Avalanche C-Chain", ... }),
  "avalanche-fuji": defineChain({ id: 43113, name: "Avalanche Fuji", ... }),
  celo: defineChain({ id: 42220, name: "Celo", ... }),
  "celo-sepolia": defineChain({ id: 11142220, name: "Celo Sepolia", ... }),
  base: defineChain({ id: 8453, name: "Base", ... }),
  "base-sepolia": defineChain({ id: 84532, name: "Base Sepolia", ... }),
};

// USDC token addresses by chain ID
export const USDC_ADDRESSES: Record<number, Address> = {
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",  // Avalanche
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65",  // Fuji
  42220: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",  // Celo
  11142220: "0x0000000000000000000000000000000000000000", // Celo Sepolia (TBD)
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",   // Base
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // Base Sepolia
};
```

To add new networks:

1. Add chain definition to `chains` object
2. Add to `SUPPORTED_NETWORKS` array
3. Add USDC address to `USDC_ADDRESSES`
4. Configure RPC URL in environment variables
5. Deploy escrow contract (for deferred payments)

## Development

### Prerequisites

- Node.js 18+ (recommend 20+)
- npm, yarn, or pnpm
- Wallet with testnet tokens (Fuji AVAX, Base Sepolia ETH)

### Installation

```bash
cd MiddlewareApp
npm install
```

### Development Server

```bash
npm run dev
# Server runs on http://localhost:3402
```

The development server runs on port **3402** by default (configured in package.json).

### Build for Production

```bash
npm run build
npm start
```

### Bundle Analysis

To analyze bundle size and identify heavy dependencies:

```bash
cd StackApp
ANALYZE=true npm run build
```

This opens an interactive visualization in your browser showing what's in each bundle. Use this to:

- Identify large dependencies that may need optimization
- Find duplicate packages
- Verify code splitting is working correctly
- Track bundle size changes over time

**Note**: The `@next/bundle-analyzer` package is a devDependency and only runs locally. It is not included in production builds.

### Smart Contract Development

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy upgradeable contracts (recommended)
npm run deploy:avalanche-fuji    # Deploy to Avalanche Fuji testnet
npm run deploy:base-sepolia      # Deploy to Base Sepolia testnet
npm run deploy:avalanche         # Deploy to Avalanche mainnet
npm run deploy:base              # Deploy to Base mainnet

# Upgrade existing contracts
PROXY_ADDRESS=0x... npm run upgrade:avalanche-fuji
```

See [Documents/UPGRADEABLE_CONTRACTS_GUIDE.md](Documents/UPGRADEABLE_CONTRACTS_GUIDE.md) for complete deployment and upgrade instructions.

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

## Deployment

### Smart Contract Deployment (Upgradeable)

PerkOS x402 uses **UUPS (Universal Upgradeable Proxy Standard)** for smart contracts, allowing bug fixes and feature additions without redeployment.

#### Initial Deployment

```bash
# 1. Deploy to testnet first
cd MiddlewareApp
npm run compile
npm run deploy:avalanche-fuji

# 2. Update .env with proxy address
NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_DEFERRED_ENABLED=true

# 3. Deploy to mainnet
npm run deploy:avalanche
npm run deploy:base
```

#### Upgrading Contracts

```bash
# 1. Modify contract in lib/contracts/DeferredPaymentEscrowUpgradeable.sol
# 2. Compile
npm run compile

# 3. Test on testnet
PROXY_ADDRESS=0x... npm run upgrade:avalanche-fuji

# 4. Upgrade mainnet
PROXY_ADDRESS=0x... npm run upgrade:avalanche
```

**Important**: See [Documents/UPGRADEABLE_CONTRACTS_GUIDE.md](Documents/UPGRADEABLE_CONTRACTS_GUIDE.md) for:

- Complete deployment procedures
- Upgrade safety rules
- State migration strategies
- Troubleshooting guide

### Middleware Server Deployment

#### Vercel (Recommended)

```bash
vercel --prod
```

#### Docker

```bash
docker build -t perkos-x402 .
docker run -p 3402:3402 perkos-x402
```

### Environment Setup

1. Deploy upgradeable escrow contracts to all networks
2. Set all required environment variables in Vercel/hosting platform
3. Configure RPC endpoints for production networks
4. Set up payment receiver wallet and private key
5. Enable HTTPS (required for wallet interactions)
6. Configure CORS for API endpoints
7. Update escrow addresses in .env for each network

## Security Considerations

### EIP-3009 (Exact Payments)

- ✅ Signature verification using ECDSA recovery
- ✅ Nonce tracking to prevent replay attacks
- ✅ Time-bound authorizations (validAfter/validBefore)
- ✅ On-chain settlement with atomic transactions

### EIP-712 (Deferred Payments)

- ✅ Structured data hashing for secure signatures
- ✅ Voucher aggregation with cumulative amounts
- ✅ Escrow contract for buyer protection
- ✅ Thaw period for dispute resolution

### Upgradeable Contracts (UUPS)

- ✅ **Owner-only upgrades**: Only contract owner can upgrade implementation
- ✅ **State preservation**: All user data maintained across upgrades
- ✅ **Fixed proxy address**: Users always interact with same address
- ✅ **Version tracking**: Built-in version() function for transparency
- ⚠️ **Storage layout rules**: Never change order of state variables
- ⚠️ **Multi-sig recommended**: Use Gnosis Safe for production ownership
- ⚠️ **Testnet first**: Always test upgrades on testnet before mainnet

See [Documents/UPGRADEABLE_CONTRACTS_GUIDE.md](Documents/UPGRADEABLE_CONTRACTS_GUIDE.md) for complete security practices.

### Best Practices

- 🔒 Never expose private keys in client-side code
- 🔒 Use environment variables for sensitive configuration
- 🔒 Implement rate limiting on API endpoints
- 🔒 Validate all user inputs before processing
- 🔒 Use HTTPS for all production deployments
- 🔒 Monitor for unusual transaction patterns
- 🔒 Regular security audits of smart contracts
- 🔒 Use multi-sig wallets for contract ownership
- 🔒 Test all contract upgrades on testnet first
- 🔒 Maintain 24-48 hour monitoring period after upgrades

## Roadmap

### Phase 1: Foundation (✅ Complete)

- [x] x402 protocol implementation (exact + deferred)
- [x] Multi-chain support (Avalanche, Base, Celo + 13 additional networks)
- [x] ERC-8004 agent discovery endpoints
- [x] Dashboard and analytics UI
- [x] Service marketplace
- [x] UUPS upgradeable contracts (OpenZeppelin)

### Phase 2: Trust & Reputation (✅ Complete)

- [x] On-chain reputation tracking (ReputationRegistry)
- [x] ERC-721 agent registry (IdentityRegistry)
- [x] Community feedback system with EIP-712 signatures
- [x] Rating and review mechanism (-100 to +100 scale)
- [x] Third-party validator attestations (ValidationRegistry)
- [x] Stake-based validator registration (cryptoeconomic security)
- [x] ERC-8004 API endpoints (/api/erc8004/\*)
- [x] Frontend ABIs for all registries

### Phase 3: Advanced Features (🚧 In Progress)

- [ ] TEE attestation support
- [ ] zkML verification
- [ ] Cross-chain messaging (LayerZero/Axelar)
- [ ] Advanced analytics and reporting
- [ ] Agent reputation dashboards

### Phase 4: Ecosystem Growth (🔜 Planned)

- [ ] Developer SDK/libraries
- [ ] Plugin system for wallets
- [ ] Integration with major DeFi protocols
- [ ] Governance token and DAO
- [ ] Mobile app support

## Contributing

We welcome contributions from the community! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Resources

### Project Documentation

All detailed documentation is located in the `/Documents` folder:

- **[UPGRADEABLE_CONTRACTS_GUIDE.md](Documents/UPGRADEABLE_CONTRACTS_GUIDE.md)** - ⭐ Upgradeable contract deployment and upgrade guide
- **[FIREBASE_SETUP.md](Documents/FIREBASE_SETUP.md)** - Complete Firebase database setup guide
- **[DEPLOYMENT_CHECKLIST.md](Documents/DEPLOYMENT_CHECKLIST.md)** - Production deployment checklist
- **[X402_DEFERRED_SCHEME.md](Documents/X402_DEFERRED_SCHEME.md)** - Deferred payment implementation guide
- **[MULTI_CHAIN_GUIDE.md](Documents/MULTI_CHAIN_GUIDE.md)** - Multi-chain configuration and deployment
- **[COMPARISON.md](Documents/COMPARISON.md)** - Comparison with other payment solutions

### Additional Resources (MiddlewareApp)

- **[DATABASE_TABLES.md](MiddlewareApp/DATABASE_TABLES.md)** - Complete database schema reference
- **[README_PRODUCTION.md](MiddlewareApp/README_PRODUCTION.md)** - Production setup summary
- **[package.json](MiddlewareApp/package.json)** - Dependencies and scripts

### External Documentation

- [x402 Protocol Specification](https://github.com/x402/protocol)
- [ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712: Typed Structured Data](https://eips.ethereum.org/EIPS/eip-712)

### Built on PerkOS Stack

- Website: https://perkos.io
- Discord: [PerkOS Stack Community](#)
- Twitter: [@PerkOS](#)
- GitHub: https://github.com/perkos/PerkOS-Stack

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

Need help? We're here for you:

- 📧 Email: support@perkos.io
- 💬 Discord: [PerkOS Stack Community](#)
- 🐛 Issues: [GitHub Issues](#)
- 📖 Docs: [PerkOS Stack Documentation](#)

---

**Stack it. Ship it. Scale it.** 🏗️

_The infrastructure behind the spark_

Built on x402 · Powered by PerkOS Stack
