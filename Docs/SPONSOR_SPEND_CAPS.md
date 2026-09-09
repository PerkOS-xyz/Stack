# Sponsor spend caps

Sponsor rules (`perkos_sponsor_rules`) carry three optional limits, in wei of gas paid by the sponsor wallet:

| Field | Meaning |
|---|---|
| `per_transaction_limit_wei` | Refuse a settlement whose estimated cost (`estimateGas × gasPrice`) exceeds this |
| `daily_limit_wei` | Refuse when the last 24h of recorded spend plus this settlement would exceed this |
| `monthly_limit_wei` | Same over the last 30 days |

`null` means no cap, which is what every rule created before 2026-09-09 has.

## How it is enforced

`lib/services/sponsorSpend.ts`:

- `findSponsorWallet` now returns the matched rule (`wallet.rule`) with its caps.
- Both settlement paths in `ExactSchemeService` (plain `transferWithAuthorization` and the CoffeeSplit path) call `guardSponsorSpend` **before** sending. It estimates the cost with the sponsor as `account`, reads the ledger, and evaluates the caps. A refusal is a normal `SettleResponse` with `errorReason` such as `Sponsor daily gas cap reached (… > … wei)`; nothing was sent.
- After a confirmed settlement the real cost from the receipt is appended to `perkos_sponsor_spend` (`sponsor_wallet_id, rule_id, network, transaction_hash, gas_cost_wei, created_at`). Windows are summed from that ledger.
- If gas estimation fails, only the per-transaction cap is skipped (logged); daily and monthly still apply to what was already spent. If the ledger cannot be read, window caps are not enforced for that call (logged loudly); the per-transaction cap still is.

## Setting caps

`PATCH /api/sponsor/rules` with the wallet-signature headers and `{ ruleId, perTransactionLimitWei, dailyLimitWei, monthlyLimitWei }` (strings in wei). Suggested starting point on Base, where a settlement costs well under 0.00001 ETH:

- per transaction: `500000000000000` (0.0005 ETH)
- daily: `5000000000000000` (0.005 ETH)
- monthly: `50000000000000000` (0.05 ETH)
