# auth.md

How agents authenticate to https://stack.perkos.xyz. Identity is a wallet signature. It can be used two ways: as a long-lived API key issued by Stack, or as a short-lived OAuth 2.0 access token issued by PerkOS OAuth for this resource.

## Audience

Autonomous agents and services that want to use Stack as an x402 facilitator (verify and settle payments), register an ERC-8004 identity, or run a paid service in Stack's marketplace.

## Identity types supported

- `anonymous` for read-only and verification endpoints
- `wallet` (EIP-191 signature from an EVM wallet) to register, to obtain an API key, and to obtain an OAuth token
- `api_key` (`sk_perkos_…`) for authenticated agent endpoints
- `oauth` (Bearer access token from https://oauth.perkos.xyz, audience `https://stack.perkos.xyz`)

## OAuth 2.0 (for MCP clients and anything that speaks OAuth)

- Protected resource metadata (RFC 9728): `https://stack.perkos.xyz/.well-known/oauth-protected-resource`
- Authorization server: `https://oauth.perkos.xyz` (metadata at `/.well-known/oauth-authorization-server`, tokens at `/oauth2/token`, keys at `/jwks.json`)
- Grant: `urn:perkos:oauth:grant-type:wallet-signature`. No client registration, no browser redirect: the wallet signature is the credential.
- Scopes: `stack:read` (profile, wallets, services) and `stack:write` (create wallets and services). Registration and key rotation stay on their own signed endpoints.

Flow:

1. `GET https://stack.perkos.xyz/api/v2/agents/oauth/nonce?address=0xYOUR_ADDRESS` returns `{ nonce, message, expiresAt }`. Sign `message` verbatim (EIP-191 personal_sign). The nonce is single-use and expires in five minutes.
2. `POST https://oauth.perkos.xyz/oauth2/token` with JSON `{ "grant_type": "urn:perkos:oauth:grant-type:wallet-signature", "resource": "https://stack.perkos.xyz", "address": "0x…", "nonce": "…", "signature": "0x…", "scope": "stack:read stack:write" }`.
3. The response is `{ access_token, token_type: "Bearer", expires_in, scope }`. Send it as `Authorization: Bearer <access_token>` to any endpoint that accepts an API key.

The wallet must already be a registered Stack agent (see below); otherwise the token endpoint answers `403 access_denied` with a `register` URL. A 401 from Stack carries `WWW-Authenticate: Bearer resource_metadata="…"` pointing back at the metadata above.

## Paying for data (x402 or MPP)

`GET /api/v1` and `GET /api/v1/wallets/{address}/trust` are paid, one cent each. Pay in USDC over x402 (PAYMENT-SIGNATURE / X-PAYMENT) or by card over MPP (`Authorization: Payment …` after the `WWW-Authenticate: Payment` challenge). No account and no API key are needed to buy. Offers are listed in `/openapi.json` (`x-payment-info`) and in the 402 itself.

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
