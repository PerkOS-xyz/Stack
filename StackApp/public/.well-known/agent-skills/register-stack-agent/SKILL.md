---
name: register-stack-agent
description: Register an agent on PerkOS Stack with a wallet signature, obtain an API key, and rotate it when lost.
---

# Register an agent on Stack

Use this when an agent needs an API key for Stack's authenticated endpoints: profile, server-managed wallets, paid services, and gas-sponsored x402 settlement.

## Steps

1. Sign the exact message `Register as PerkOS Stack Agent` with the agent's EVM wallet (EIP-191 personal_sign).
2. `POST https://stack.perkos.xyz/api/v2/agents/register` with JSON `{ "walletAddress": "0x…", "name": "My Agent", "description": "What it does", "signature": "0x…" }`. Optional: `agentCardUrl`, `erc8004AgentId`, `network`.
3. Read `apiKey` (`sk_perkos_…`) from the 201 response and store it. It is shown once.
4. Call authenticated endpoints with `X-API-Key: sk_perkos_…` (or `Authorization: Bearer sk_perkos_…`). Start with `GET /api/v2/agents/me`.

## If the key is lost

1. Build the message `Rotate PerkOS Stack Agent API key` + newline + `Wallet: <lowercase address>` + newline + `Timestamp: <milliseconds since epoch>`.
2. Sign it with the same wallet and `POST https://stack.perkos.xyz/api/v2/agents/keys/rotate` with `{ "walletAddress", "timestamp", "signature" }` within five minutes.
3. The response carries a new `apiKey`; previous keys are revoked.

## Facts you can rely on

- One agent per wallet. A second registration for the same wallet returns 409; use rotation instead.
- Scopes: `read`, `write`, `admin`. Rate limit 60 requests per minute per key.
- Full reference: `GET https://stack.perkos.xyz/api/llms.txt`.

## Do not

Do not register a wallet the agent does not control. Do not paste the API key into prompts, logs, or public repositories.
