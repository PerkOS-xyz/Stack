# PerkOS Stack — Solana x402 Exact Scheme

## Goal

Add Solana (SVM) `exact` scheme support to the Stack facilitator, parallel to the existing Stellar path and EVM `ExactSchemeService`.

## Networks (CAIP-2)

| Network | CAIP-2 |
|---|---|
| Solana mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |

## Asset

- Mainnet USDC mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (`@x402/svm` `USDC_MAINNET_ADDRESS`)
- Devnet USDC mint: package `USDC_DEVNET_ADDRESS`

## Library

Use official `@x402/svm` (same family as `@x402/stellar`):

- `ExactSvmScheme` from `@x402/svm/exact/facilitator`
- `toFacilitatorSvmSigner` from `@x402/svm`
- Key material via `@solana/kit` `createKeyPairSignerFromBytes`

## Env

| Var | Purpose |
|---|---|
| `SOLANA_FACILITATOR_SECRET_KEY` | Base58 secret key **or** JSON byte array (64 bytes) for facilitator fee-payer |
| `SOLANA_RPC_URL` | Optional mainnet RPC override |
| `SOLANA_DEVNET_RPC_URL` | Optional devnet RPC override |
| `SOLANA_X402_NETWORKS` | Optional CSV of CAIP-2 networks (default: mainnet+devnet) |

If `SOLANA_FACILITATOR_SECRET_KEY` is missing, Solana scheme stays uninitialized (same fail-soft pattern as Stellar).

## Facilitator wiring

1. `SolanaExactSchemeService` wraps `ExactSvmScheme.verify/settle`
2. `X402Service.normalizeNetwork` accepts `solana:*`
3. `getSupported()` advertises `{ scheme: "exact", network: "solana:..." }` when secret is configured
4. `networkToCAIP2` passes through `solana:*` / `stellar:*` unchanged

## Knowledge consumer

PerkOS Knowledge should advertise Solana in `/api/x402/policy` once Stack `/api/v2/x402/supported` lists Solana. Default prod payment chain can stay Base until Julio flips `KNOWLEDGE_X402_CHAIN` / multi-chain accept list.

## Out of scope (v1)

- Deferred / batch-settlement / upto schemes on Solana
- Server-managed deposit wallets (Stellar-style) — separate later
- Gas sponsorship already exists under `/api/sponsor/wallets/solana-*` and is independent
