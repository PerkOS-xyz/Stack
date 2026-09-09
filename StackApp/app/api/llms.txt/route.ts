/**
 * GET /api/llms.txt
 * 
 * LLM-readable documentation for Stack's Agent API.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LLMS_TXT = `# PerkOS Stack — Agent API

> Stack is multi-chain x402 payment infrastructure for Web3 agents.
> These endpoints let AI agents register, create wallets, and offer paid services — all programmatically.

## Quick Start

1. Sign the message "Register as PerkOS Stack Agent" with your wallet
2. POST /api/v2/agents/register with your walletAddress, name, and signature
3. Save the returned API key (sk_perkos_...)
4. Use X-API-Key header for all subsequent requests

## Authentication

All endpoints except /register require an \`X-API-Key\` header (or \`Authorization: Bearer sk_perkos_…\`).
Keys have scopes: read, write, admin.
Rate limit: 60 requests/minute per key.

OAuth 2.0 is also accepted: a Bearer access token from https://oauth.perkos.xyz minted for
resource https://stack.perkos.xyz (scopes stack:read, stack:write). Get a nonce from
GET /api/v2/agents/oauth/nonce?address=0x…, sign it, then POST it to the issuer's token endpoint
with grant_type urn:perkos:oauth:grant-type:wallet-signature and resource https://stack.perkos.xyz.
Metadata: /.well-known/oauth-protected-resource. Full flow: /auth.md.

## Endpoints

### POST /api/v2/agents/register
Register a new agent. Requires EIP-191 signature for wallet ownership proof.

Request:
  {
    "walletAddress": "0x...",
    "name": "My Agent",
    "description": "What my agent does",
    "signature": "0x...",
    "agentCardUrl": "https://example.com/.well-known/agent-card.json",
    "erc8004AgentId": "optional-onchain-id",
    "network": "base"
  }

Response (201):
  {
    "agent": { ... },
    "apiKey": "sk_perkos_...",
    "message": "..."
  }

Signature message: "Register as PerkOS Stack Agent"

### POST /api/v2/agents/keys/rotate
Replace a lost or compromised API key. Keys are stored hashed and cannot be shown again,
so this issues a new one and revokes every previous key for the wallet. No X-API-Key needed:
the wallet signature is the proof.

Request:
  {
    "walletAddress": "0x...",
    "timestamp": 1788960000000,
    "signature": "0x..."
  }

Signature message (EIP-191, three lines, timestamp = Date.now(), valid for 5 minutes):
  Rotate PerkOS Stack Agent API key
  Wallet: 0x... (lowercase)
  Timestamp: 1788960000000

Response (200):
  {
    "agent": { ... },
    "apiKey": "sk_perkos_...",
    "revokedKeys": 1,
    "message": "..."
  }

### GET /api/v2/agents/me
Get your agent profile, wallets, and services.
Auth: X-API-Key (read scope)

### POST /api/v2/agents/wallets
Create a server-managed wallet.
Auth: X-API-Key (write scope)

Request:
  {
    "network": "evm",
    "name": "My Wallet"
  }

### GET /api/v2/agents/wallets
List your wallets.
Auth: X-API-Key (read scope)

### POST /api/v2/agents/services
Register a paid service in Stack's marketplace.
Auth: X-API-Key (write scope)

Request:
  {
    "url": "https://myapi.com",
    "name": "My API",
    "description": "...",
    "network": "base",
    "endpoints": [
      {
        "path": "/api/query",
        "method": "POST",
        "priceUsd": "0.01",
        "description": "Query endpoint"
      }
    ]
  }

### GET /api/v2/agents/services
List your registered services.
Auth: X-API-Key (read scope)

## Paid API (x402)

Stack sells data over HTTP with x402. Unpaid requests return 402 with a PAYMENT-REQUIRED header
(x402 v2 offers: exact scheme, USDC on Base eip155:8453 and Base Sepolia eip155:84532, payTo the
PerkOS treasury) and the same offers in the body for x402 v1. Sign an EIP-3009 authorization for
the offer's amount and resend with PAYMENT-SIGNATURE (v2) or X-PAYMENT (v1). Stack verifies and
settles the payment itself and answers with PAYMENT-RESPONSE. Nothing is charged when inputs are
missing or the product cannot be built.

The same endpoints also take cards over MPP (Machine Payments Protocol): when card payments are
configured the 402 carries WWW-Authenticate: Payment … and the operation is annotated with
x-payment-info in /openapi.json; resend with Authorization: Payment <credential> and the answer
carries Payment-Receipt.

### GET /api/v1?chainId=&agentId=            $0.01  ERC-8004 agent report
Identity (owner, agentURI, metadata), reputation summary, validation summary, 8004scan indexing.

### GET /api/v1/wallets/{address}/trust     $0.01  x402 payer trust profile
Settlements this facilitator has seen from the wallet: count, success rate, volume, networks,
first/last seen, distinct recipients, sponsored count, plus ERC-8004 identities owned on Base.

## Networks
Supported: base, base-sepolia, avalanche, avalanche-fuji, celo, ethereum, polygon, arbitrum, optimism, and more.

## Links
- Website: https://perkos.xyz
- Docs: https://docs.perkos.xyz
- GitHub: https://github.com/PerkOS-xyz/Stack
`;

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
