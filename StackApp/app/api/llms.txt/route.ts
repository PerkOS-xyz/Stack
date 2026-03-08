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

All endpoints except /register require an \`X-API-Key\` header.
Keys have scopes: read, write, admin.
Rate limit: 60 requests/minute per key.

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
