# Protocol pin review

Stack builds on four protocols. **All four are moving drafts** — three EIPs in
Draft status and one vendor specification at Draft 0.2.0. A pin that was correct
last month can be a compatibility break this month, and none of these publish a
changelog we get notified about.

Run this review **monthly**, and always before a release that touches payment,
identity or commerce surfaces.

Baseline established 2026-07-29 (`STACK-PROTOCOL-RESEARCH-2026-07-29.md`, workspace root).

---

## What to check

### 1. x402

| | |
|---|---|
| Source of truth | [x402 v2 spec](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md), [x402.org](https://x402.org) |
| Governance | x402 Foundation / Linux Foundation TSC since 2026-07-14 |
| Pinned in Stack | `@x402/core`, `@x402/fetch`, `@x402/stellar` (`^2.19.0`) |
| Baseline | v2 live; **only `exact` standardized** |

Check:

- [ ] Has the TSC ratified any new scheme? **Especially `deferred`, `upto` or batch-settlement.** If `deferred` is standardized, compare its semantics against `perkos-deferred` in `lib/utils/x402-schemes.ts` and decide whether to implement the standard one alongside ours.
- [ ] Has a v1.0 been tagged? Backward-compatibility guarantees are expected to start there.
- [ ] Any change to the `PaymentRequirements` required fields, the `accepted` echo rule, or CAIP-2 handling?
- [ ] Does `GET /api/discovery/resources` still match the Discovery extension shape?
- [ ] `npm outdated @x402/core @x402/fetch @x402/stellar`

### 2. ERC-8004

| | |
|---|---|
| Source of truth | [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004), [erc-8004/erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts) |
| Pinned in Stack | Canonical addresses in `lib/utils/config.ts`; hand-maintained ABIs in `lib/contracts/erc8004/abis.ts` |
| Baseline | EIP **Draft**; Identity + Reputation live on 30+ chains; Validation **experimental** |

Check:

- [ ] EIP Status field — still Draft, or moved to Review / Last Call / Final?
- [ ] **Has the Validation Registry been officially deployed?** It was blocked on TEE-community discussion. If it ships, set the address instead of relying on the `NEXT_PUBLIC_<NETWORK>_VALIDATION_REGISTRY` override.
- [ ] Did the canonical addresses change, or gain new chains? Compare the reference repo against `ERC8004_MAINNET_ADDRESSES` / `ERC8004_TESTNET_ADDRESSES` / `ERC8004_OFFICIAL_NETWORKS`.
- [ ] Any ABI change that invalidates `lib/contracts/erc8004/abis.ts`?
- [ ] Has `@perkos/contracts-erc8004` been republished past `1.0.1`? It still describes pre-v2 contracts, which is why Stack keeps its own ABIs. If it is fixed, drop the local copies.

### 3. x401

| | |
|---|---|
| Source of truth | [x401.proof.com/spec/latest](https://x401.proof.com/spec/latest/) |
| Pinned in Stack | `@proof.com/x401-node` (`^0.3.0`), profile documented in `Docs/X401-STATUS-2026-07-22.md` |
| Baseline | **Draft 0.2.0**, SDK 0.3.0, no standards-body adoption |

Check:

- [ ] Spec version — still 0.2.0? **0.2.0 was already a breaking redesign of 0.1.0, so assume a 0.3.0 breaks the wire format.** Diff the header names and the `credential_requirements` shape before bumping.
- [ ] Did the FIDO Alliance agentic authentication workgroup accept the submission? That process may reshape the wire format.
- [ ] Upstream open questions moved? Multi-endpoint proof requests, agent-asserted origins, autonomous delegation, proof/payment binding.
- [ ] `npm outdated @proof.com/x401-node`
- [ ] Does `Docs/X401-STATUS-2026-07-22.md` still describe reality? If not, supersede it with a dated successor rather than editing history.

### 4. ERC-8183

| | |
|---|---|
| Source of truth | [EIP-8183](https://eips.ethereum.org/EIPS/eip-8183), [erc-8183/base-contracts](https://github.com/erc-8183/base-contracts) |
| Pinned in Stack | Submodule at commit `142e669c1fd318486a4628395b629f033654dd06` |
| Baseline | EIP **Draft** (created 2026-02-25); deployed + certified on Robinhood Testnet |

Check:

- [ ] EIP Status field, and whether the Job state machine or role model changed.
- [ ] New releases on `erc-8183/base-contracts`. Repin **deliberately** — read the diff, do not follow a branch.
- [ ] **Has `ERC8183WithAuthorization` been slimmed under the EIP-170 limit?** Stack excludes it today, which costs meta-transactions and gasless job actions. If upstream fixes the size, reconsider.
- [ ] Re-run `forge test` and confirm the runtime size margin in `Docs/ROBINHOOD-TESTNET-ERC8183-DEPLOYMENT.md` still holds.

---

## After the review

1. Note the date and outcome below, even when nothing changed — "checked, no change" is the useful signal.
2. If any status field moved, update the table in `CLAUDE.md` ("Protocol status") in the same PR.
3. If a pin changed, say so in the PR body with the diff you read, not just the version bump.

## Log

| Date | Reviewer | Outcome |
|---|---|---|
| 2026-07-29 | Baseline | x402 v2 / LF governance; ERC-8004 Draft, addresses verified, Validation still experimental; x401 Draft 0.2.0 + SDK 0.3.0 current; ERC-8183 Draft, pin current |
