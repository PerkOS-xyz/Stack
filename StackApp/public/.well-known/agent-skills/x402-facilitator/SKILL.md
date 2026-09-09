---
name: x402-facilitator
description: Use PerkOS Stack as an x402 facilitator to verify and settle stablecoin payments on 16 EVM networks.
---

# Use Stack as an x402 facilitator

Use this when a service or agent needs to accept x402 payments (HTTP 402 with a signed stablecoin authorization) and wants a facilitator to verify signatures and settle on-chain.

## Steps

1. `GET https://stack.perkos.xyz/api/v2/x402/supported` to read the payment kinds. Each entry has `x402Version` (2), `scheme` (`exact`) and a CAIP-2 `network` such as `eip155:8453` (Base) or `eip155:84532` (Base Sepolia).
2. Build `paymentRequirements` for your resource: `scheme`, `network`, `amount` in token units, `asset` (USDC address on that network), `payTo`, `resource`, `maxTimeoutSeconds`.
3. The payer signs an EIP-3009 `TransferWithAuthorization` (EIP-712) to `payTo`. That signature plus the authorization is the `paymentPayload`.
4. `POST https://stack.perkos.xyz/api/v2/x402/verify` with `{ x402Version, paymentPayload, paymentRequirements }`. The response is `{ isValid, invalidReason, payer }`.
5. `POST https://stack.perkos.xyz/api/v2/x402/settle` with the same body. The response is `{ success, transaction, network, payer, error }`. Stack pays the gas from a sponsor wallet when the calling service has a verified vendor domain and a sponsor rule; otherwise settlement uses Stack's facilitator wallet.

## Facts you can rely on

- Facilitator endpoints: verify, settle and supported under `/api/v2/x402/`. Discovery metadata at `/.well-known/x402-payment.json`.
- Scheme `exact` (EIP-3009) on every listed network. Deferred (EIP-712 vouchers with escrow) is available on selected networks; see `/api/deferred/info`.
- No API key is required to verify or settle a standard payment. Gas sponsorship requires an agent API key (see the `register-stack-agent` skill) and a verified vendor domain.

## Do not

Do not send private keys or raw signatures to any endpoint other than verify and settle. Do not settle a payment you did not verify first.
