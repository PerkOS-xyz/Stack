---
name: stack-paid-api
description: Buy data from PerkOS Stack over x402: ERC-8004 agent reports and x402 payer trust profiles, one cent each, paid in USDC on Base.
---

# Buy data from Stack over x402

Use this when an agent needs a verified picture of another agent (ERC-8004 identity, reputation, validation, indexing) or of a paying wallet (its x402 history at this facilitator), and can pay one cent in USDC.

## Products

| Endpoint | Price | Inputs | Returns |
|---|---|---|---|
| `GET https://stack.perkos.xyz/api/v1?chainId=&agentId=` | $0.01 | chainId, agentId | identity, reputation summary, validation summary, 8004scan indexing |
| `GET https://stack.perkos.xyz/api/v1/wallets/{address}/trust` | $0.01 | address | settlements, success rate, volume, networks, first/last seen, distinct recipients, ERC-8004 identities owned |

## Steps

1. Call the endpoint with the inputs. Without a payment it answers `402` with a `PAYMENT-REQUIRED` header (base64 JSON, x402 v2) whose `accepts` lists one offer per network: `scheme: exact`, `network` (CAIP-2), `amount` in USDC base units (`10000` = $0.01), `asset`, `payTo`, `maxTimeoutSeconds`, `extra.name`/`extra.version` (the token's EIP-712 domain). The body carries the same offers in x402 v1 shape plus the whole catalog.
2. Pick an offer (Base `eip155:8453`, Celo `eip155:42220` or Robinhood Chain `eip155:4663` for real use; Base Sepolia `eip155:84532` for integration tests) and sign an EIP-3009 `TransferWithAuthorization` for exactly `amount` to `payTo`, `validBefore` within `maxTimeoutSeconds`, a fresh 32-byte nonce. Use the offer's `extra.name`/`extra.version` as the EIP-712 domain: USDC is `USD Coin` v2 on Base and `USDC` v2 on Celo and Base Sepolia; Robinhood settles in USDG (`Global Dollar` v1), 6 decimals, so `amount` is the same number.
3. Resend the same request with `PAYMENT-SIGNATURE` (base64 of `{ x402Version: 2, resource, accepted: <the offer>, payload: { signature, authorization } }`) or, for x402 v1 clients, `X-PAYMENT` (base64 of `{ x402Version: 1, scheme: "exact", network, payload }`).
4. A `200` carries the product and a `PAYMENT-RESPONSE` header (base64 `{ success, payer, transaction, network }`). A `400` means inputs were missing and nothing was charged; a `502` means the product could not be built and nothing was charged; a `402` after paying means the payment did not verify or settle, with the reason in the body.

## Facts you can rely on

- Stack is its own facilitator: verification and settlement run in-process, gas is paid by Stack's sponsor wallet, and the payment lands in the PerkOS treasury named in `payTo`.
- The order is verify, build, settle, deliver. You are never charged for something you did not receive.
- Rate limit: 60 requests per minute per IP on paid endpoints.

## Do not

Do not reuse a nonce or an authorization across calls. Do not sign for more than `amount`; the offer is exact.
