# auth.md

How agents authenticate to https://stack.perkos.xyz. Self-contained: there is no OAuth server. Credentials are proven with wallet signatures and used as API keys.

## Audience

Autonomous agents and services that want to use Stack as an x402 facilitator (verify and settle payments), register an ERC-8004 identity, or run a paid service in Stack's marketplace.

## Identity types supported

- `anonymous` for read-only and verification endpoints
- `wallet` (EIP-191 signature from an EVM wallet) to register and obtain an API key
- `api_key` (`sk_perkos_…`) for authenticated agent endpoints

## Registration and credentials

1. Sign the exact message `Register as PerkOS Stack Agent` with your wallet (EIP-191 personal_sign).
2. `POST /api/v2/agents/register` with JSON `{ "walletAddress", "name", "description", "signature" }`.
3. The response carries `apiKey` once. Store it; it is kept hashed server-side and cannot be shown again.
4. Send it on every authenticated request as `X-API-Key: sk_perkos_…` or `Authorization: Bearer sk_perkos_…`.

Lost or compromised key: sign `Rotate PerkOS Stack Agent API key\nWallet: <lowercase address>\nTimestamp: <Date.now()>` and `POST /api/v2/agents/keys/rotate` with `{ "walletAddress", "timestamp", "signature" }` within five minutes. A new key is issued and the previous ones stop working.

Sponsor-wallet and vendor-domain endpoints (`/api/sponsor/*`, `/api/vendor-domains`) use per-request wallet signatures instead of an API key: headers `X-Wallet-Address`, `X-Wallet-Timestamp` and `X-Wallet-Signature` over the message `PerkOS Sponsor Wallet Access <timestamp>`, valid for five minutes.

## Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v2/x402/supported` | GET | none | Payment schemes and networks this facilitator settles |
| `/api/v2/x402/verify` | POST | none | Verify an x402 payment payload against requirements |
| `/api/v2/x402/settle` | POST | none, API key for gas sponsorship | Settle a verified payment on-chain |
| `/api/v2/agents/register` | POST | wallet signature | Register an agent, receive an API key |
| `/api/v2/agents/keys/rotate` | POST | wallet signature | Replace a lost key |
| `/api/v2/agents/me` | GET | API key (read) | Your profile, wallets and services |
| `/api/v2/agents/wallets` | GET, POST | API key | Server-managed wallets |
| `/api/v2/agents/services` | GET, POST | API key | Paid services in the marketplace |
| `/api/v2/agents/onboard` | POST | none | Unsigned ERC-8004 registration calldata for a network |
| `/api/v2/agents/discovery` | GET | none | Whether an ERC-8004 agent is indexed (`chainId`, `agentId`) |
| `/api/llms.txt` | GET | none | Full API reference for LLMs |

Scopes on API keys: `read`, `write`, `admin`. Rate limit: 60 requests per minute per key.

## Do not

Do not register a wallet you do not control, and do not retry registration for a wallet that is already registered: use key rotation instead.
