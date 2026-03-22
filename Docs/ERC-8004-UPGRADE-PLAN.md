# ERC-8004 Upgrade Plan: v1 → v2 Spec Compliance

**Date:** 2025-03-08
**Branch:** `upgrade-erc8004-v2`
**Status:** In Progress

---

## Executive Summary

The ERC-8004 specification has evolved significantly from our current implementation. This upgrade aligns Stack's contracts, types, and API routes with the latest spec from [eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004).

**Key changes:**
1. Reputation Registry: `uint8 score` → `int128 value` + `uint8 valueDecimals` (signed, decimal-aware)
2. Identity Registry: `endpoints` → `services`, new wallet functions, MetadataEntry field rename
3. Validation Registry: Remove `ValidationStatus` enum, simplify to spec-only functions
4. Config: Hardcode official CREATE2 addresses for 25+ networks (no more env vars for registry addresses)

---

## 1. Reputation Registry — BIGGEST CHANGE

### Current Implementation
- `uint8 score` (0–100), no decimals
- `giveFeedback(agentId, score, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — 7 params
- `getSummary` returns `(count, averageScore)`
- `readFeedback` returns `(score, tag1, tag2, isRevoked)`
- `readAllFeedback` returns `(clients[], scores[], tag1s[], tag2s[], revokedStatuses[])`

### Spec Requirements
- `int128 value` + `uint8 valueDecimals` (0–18 decimals, SIGNED — allows negatives and decimals)
  - Example: uptime 99.77% = `(9977, 2)`
  - Example: negative sentiment = `(-50, 0)`
- `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — 8 params
- `getSummary` returns `(count, summaryValue, summaryValueDecimals)`
- `readFeedback` returns `(value, valueDecimals, tag1, tag2, isRevoked)`
- `readAllFeedback` returns `(clients[], feedbackIndexes[], values[], valueDecimals[], tag1s[], tag2s[], revokedStatuses[])`

### Missing Functions
- `appendResponse(agentId, clientAddress, feedbackIndex, responseURI, responseHash)` — anyone can respond (**spec says anyone, our current impl restricts to agent owner**)
- `revokeFeedback(agentId, feedbackIndex)` — already exists ✅
- `getResponseCount(agentId, clientAddress, feedbackIndex, responders[])` — NEW
- `getLastIndex(agentId, clientAddress)` — already exists ✅

### Changes Required

#### Solidity (`IReputationRegistry.sol`, `ReputationRegistry.sol`)
- [ ] Change `uint8 score` → `int128 value` in Feedback struct
- [ ] Add `uint8 valueDecimals` to Feedback struct
- [ ] Update `giveFeedback` signature: add `valueDecimals` param, change `score` to `value` (int128)
- [ ] Update `getSummary` to return `(count, summaryValue, summaryValueDecimals)` — note: aggregation of signed decimals
- [ ] Update `readFeedback` to return `(value, valueDecimals, tag1, tag2, isRevoked)`
- [ ] Update `readAllFeedback` to include `feedbackIndexes[]` and `valueDecimals[]` in return
- [ ] Update `appendResponse` — spec allows ANYONE to respond (not just agent owner)
- [ ] Add `getResponseCount(agentId, clientAddress, feedbackIndex, responders[])`
- [ ] Update events: `NewFeedback` should emit `int128 value` + `uint8 valueDecimals` instead of `uint8 score`

#### TypeScript Types (`lib/contracts/erc8004/index.ts`)
- [ ] `Feedback.score: number` → `Feedback.value: bigint` (int128) + `Feedback.valueDecimals: number`
- [ ] `ReputationSummary.averageScore` → `ReputationSummary.summaryValue: bigint` + `summaryValueDecimals: number`
- [ ] Remove `isScoreApproved()` helper (no longer applicable with signed decimals)
- [ ] Update ABI references (will need local ABI if @perkos/contracts-erc8004 not updated yet)

#### API Route (`/api/erc8004/reputation/route.ts`)
- [ ] Update GET: `readFeedback` destructuring to use `value, valueDecimals`
- [ ] Update GET: `getSummary` to use `summaryValue, summaryValueDecimals`
- [ ] Update GET: `readAllFeedback` to include `feedbackIndexes` and `valueDecimals`
- [ ] Update POST: Accept `value` (int128 range) + `valueDecimals` instead of `score` (0–100)
- [ ] Remove 0–100 score validation, add int128 range validation
- [ ] Add POST endpoint for `appendResponse`
- [ ] Add POST endpoint for `revokeFeedback`

---

## 2. Identity Registry

### Current Implementation
- Registration file uses `"endpoints": [...]`
- MetadataEntry struct: `{ key, value }`
- No wallet management functions in API

### Spec Requirements
- Registration file uses `"services": [...]` (field renamed)
- New top-level fields: `"x402Support": boolean`, `"active": boolean`
- `agentRegistry` format: `{namespace}:{chainId}:{identityRegistry}` (e.g. `eip155:1:0x742...`)
- MetadataEntry struct: `{ metadataKey, metadataValue }` (fields renamed)
- New contract functions: `setAgentWallet`, `getAgentWallet`, `unsetAgentWallet`
- `setAgentURI` emits `URIUpdated` event

### Changes Required

#### Solidity (`IIdentityRegistry.sol`, `IdentityRegistry.sol`)
- [ ] Rename MetadataEntry fields: `key` → `metadataKey`, `value` → `metadataValue`
- [ ] Verify `setAgentWallet`, `getAgentWallet`, `unsetAgentWallet` exist (they do ✅)
- [ ] Verify `setAgentURI` emits `URIUpdated` (it does ✅)

#### TypeScript Types
- [ ] Update `MetadataEntry` interface: `key` → `metadataKey`, `value` → `metadataValue`

#### API Route (`/api/erc8004/identity/route.ts`)
- [ ] Add GET support for `getAgentWallet(agentId)`
- [ ] Add POST action for `setAgentWallet` (with EIP-712 signature params)
- [ ] Add POST action for `unsetAgentWallet`
- [ ] Add POST action for `setAgentURI`

#### Well-Known Route (`/api/.well-known/erc-8004.json/route.ts`)
- [ ] Rename `endpoints` → `services` in output
- [ ] Add `x402Support: true` top-level field
- [ ] Add `active: true` top-level field
- [ ] Use `agentRegistry` format: `eip155:{chainId}:{identityRegistryAddress}`

---

## 3. Validation Registry — Simplified

### Current Implementation
- Uses `ValidationStatus` enum (None, Pending, Approved, Rejected, Cancelled)
- Has extra functions: `hasApprovedValidation`, `getValidationStatistics`, `getPendingRequests`
- `getValidationStatus` returns `(status, agentId, validatorAddress, response, tag)`

### Spec Requirements
- Response is `uint8` (0–100), NO `ValidationStatus` enum
- `validationResponse()` can be called multiple times per requestHash (progressive validation)
- `getValidationStatus(requestHash)` returns `(validatorAddress, agentId, response, responseHash, tag, lastUpdate)`
- `getSummary(agentId, validatorAddresses[], tag)` returns `(count, averageResponse)`
- `getAgentValidations(agentId)` returns `requestHashes[]`
- `getValidatorRequests(validatorAddress)` returns `requestHashes[]`
- Functions NOT in spec to consider removing: `hasApprovedValidation`, `getValidationStatistics`, `getPendingRequests`, `cancelValidation`

### Changes Required

#### Solidity (`IValidationRegistry.sol`, `ValidationRegistry.sol`)
- [ ] Remove `ValidationStatus` enum
- [ ] Allow `validationResponse()` to be called multiple times (progressive)
- [ ] Update `getValidationStatus` return signature to include `responseHash` and `lastUpdate`
- [ ] Remove `cancelValidation` if not in spec
- [ ] Remove `hasApprovedValidation` if not in spec
- [ ] Remove `getValidationStatistics` / `getValidation` if not in spec

#### TypeScript Types
- [ ] Remove `ValidationStatus` enum
- [ ] Remove `isValidationApproved()`, `getValidationStatusString()` helpers
- [ ] Update `ValidationRequest` interface to match simplified spec
- [ ] Update `ValidationSummary` — remove approvedCount, rejectedCount, pendingCount

#### API Route (`/api/erc8004/validation/route.ts`)
- [ ] Remove calls to `getPendingRequests`, `hasApprovedValidation`, `getValidationStatistics`
- [ ] Update `getValidationStatus` destructuring to new return format
- [ ] Remove `formatValidationSummary` with old fields
- [ ] Allow progressive validation responses

---

## 4. Official Contract Addresses (CREATE2 Deterministic)

Since addresses are deterministic via CREATE2, we can hardcode them — no env vars needed.

### Mainnet Addresses (same on ALL mainnet chains)
- Identity: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

### Testnet Addresses (same on ALL testnet chains)
- Identity: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Reputation: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

### Validation Registry
- NOT officially deployed yet — keep as env-var configurable

### Supported Networks (25+)
**Mainnets:** Ethereum, Base, Arbitrum, Optimism, Avalanche, Celo, BSC, Linea, Monad, Gnosis, Mantle, Metis, MegaETH, Abstract, GOAT Network
**Testnets:** All corresponding testnets

### Changes Required (`lib/utils/config.ts`)
- [ ] Replace per-network env var registry addresses with hardcoded CREATE2 addresses
- [ ] Add `isTestnet()` helper to select mainnet vs testnet addresses
- [ ] Add new networks: BSC, Linea, Gnosis, Mantle, Metis, MegaETH, Abstract, GOAT Network
- [ ] Keep validation registry addresses as env-var (not yet deployed)
- [ ] Simplify `erc8004Registries` config — all mainnets share same addresses, all testnets share same addresses

---

## 5. Implementation Order

| Step | File(s) | Description | Est. Lines |
|------|---------|-------------|------------|
| 1 | `Docs/ERC-8004-UPGRADE-PLAN.md` | This document | — |
| 2 | `lib/contracts/erc8004/index.ts` | Update types, remove old helpers, add new interfaces | ~100 |
| 3 | `lib/utils/config.ts` | Hardcode CREATE2 addresses, add networks, simplify | ~120 |
| 4 | `api/erc8004/identity/route.ts` | Add wallet functions, update metadata format | ~80 |
| 5 | `api/erc8004/reputation/route.ts` | int128 value + decimals, new endpoints | ~130 |
| 6 | `api/erc8004/validation/route.ts` | Simplify, remove non-spec functions | ~100 |
| 7 | `api/.well-known/erc-8004.json/route.ts` | services not endpoints, x402Support, active | ~60 |
| 8 | Solidity contracts (if needed) | Update interfaces + implementations | TBD |

---

## 6. Breaking Changes & Migration Notes

### API Breaking Changes
- `score` field → `value` + `valueDecimals` in all reputation endpoints
- `endpoints` → `services` in well-known file
- Validation status enum removed from responses
- `averageScore` → `summaryValue` + `summaryValueDecimals` in reputation summary

### Contract Breaking Changes
- `giveFeedback` signature changes (8 params instead of 7)
- `getSummary` return type changes
- `readFeedback` / `readAllFeedback` return types change
- Validation Registry: enum removed, progressive responses allowed

### Backward Compatibility
- Consider keeping deprecated aliases for one version cycle
- Contracts use UUPS proxy → upgradeable without redeployment
- API routes can version via query param if needed

---

## 7. Notes

- **DO NOT PUSH** — all commits local only until Julio authorizes
- Commits ≤150 lines each
- ~95 seconds between commits
- The `@perkos/contracts-erc8004` package may need updating separately — for now, define ABIs locally
- Official deployed contracts use CREATE2 so addresses are deterministic across all EVM chains
