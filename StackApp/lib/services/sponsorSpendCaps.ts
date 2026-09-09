/**
 * Pure part of the sponsor spend caps: types, wei parsing, the cap
 * evaluation and the ledger window sum. No imports, so tests and any
 * caller can use it without Firestore or an RPC.
 */
export interface SponsorSpendRule {
  id: string;
  per_transaction_limit_wei?: string | number | null;
  daily_limit_wei?: string | number | null;
  monthly_limit_wei?: string | number | null;
}

export interface SpendSnapshot {
  /** Estimated cost of the settlement about to be sent; null when unknown. */
  estimatedCostWei: bigint | null;
  spentDayWei: bigint;
  spentMonthWei: bigint;
}

export type SpendVerdict = { ok: true } | { ok: false; cap: "per_transaction" | "daily" | "monthly"; reason: string };

export function toWei(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const n = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(String(value).trim());
    return n < 0n ? null : n;
  } catch {
    return null;
  }
}

/** Pure: does a settlement fit under the rule's caps. */
export function evaluateSpendCaps(rule: SponsorSpendRule | null | undefined, snap: SpendSnapshot): SpendVerdict {
  if (!rule) return { ok: true };
  const perTx = toWei(rule.per_transaction_limit_wei);
  const daily = toWei(rule.daily_limit_wei);
  const monthly = toWei(rule.monthly_limit_wei);
  const est = snap.estimatedCostWei ?? 0n;

  if (perTx !== null && snap.estimatedCostWei !== null && snap.estimatedCostWei > perTx) {
    return { ok: false, cap: "per_transaction", reason: `Sponsor per-transaction gas cap reached (${snap.estimatedCostWei} > ${perTx} wei)` };
  }
  if (daily !== null && snap.spentDayWei + est > daily) {
    return { ok: false, cap: "daily", reason: `Sponsor daily gas cap reached (${snap.spentDayWei + est} > ${daily} wei)` };
  }
  if (monthly !== null && snap.spentMonthWei + est > monthly) {
    return { ok: false, cap: "monthly", reason: `Sponsor monthly gas cap reached (${snap.spentMonthWei + est} > ${monthly} wei)` };
  }
  return { ok: true };
}

/** Pure: sum a ledger's rows that fall inside a window. */
export function sumSpend(rows: { gas_cost_wei?: string | number | null; created_at?: unknown }[], sinceMs: number): bigint {
  let total = 0n;
  for (const r of rows) {
    const at = createdAtMs(r.created_at);
    if (at === null || at < sinceMs) continue;
    total += toWei(r.gas_cost_wei) ?? 0n;
  }
  return total;
}

function createdAtMs(value: unknown): number | null {
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (value && typeof value === "object") {
    const v = value as { _seconds?: number; seconds?: number; toMillis?: () => number };
    if (typeof v.toMillis === "function") return v.toMillis();
    const s = v._seconds ?? v.seconds;
    if (typeof s === "number") return s * 1000;
  }
  return null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MONTH_MS = 30 * DAY_MS;
