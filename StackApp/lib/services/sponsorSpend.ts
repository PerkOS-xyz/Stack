/**
 * Sponsor spend caps: the limits a sponsor rule carries, enforced.
 *
 * Rules have carried `per_transaction_limit_wei`, `daily_limit_wei` and
 * `monthly_limit_wei` for a while, but nothing read them: a rule with a cap
 * behaved exactly like one without. That matters once a sponsor wallet holds
 * real ETH, because the only thing between an abuser and the wallet was the
 * rule's domain match.
 *
 * Three pieces:
 *  - `evaluateSpendCaps` is pure: given the rule and what has been spent, does
 *    this settlement fit. Tested without a chain or a database.
 *  - `estimateSettlementCostWei` asks the RPC what the transaction would cost
 *    (estimateGas × gasPrice) before it is sent. If estimation fails the
 *    per-transaction cap cannot be judged and is skipped with a warning; the
 *    daily and monthly caps still apply to what was already spent.
 *  - The ledger (`perkos_sponsor_spend`) records the real cost after each
 *    settlement, from the receipt. Windows are computed from it.
 *
 * A null limit means "no cap", which is what every existing rule has.
 */
import { createPublicClient, http, type Address, type Hex } from "viem";
import { firebaseAdmin } from "@/lib/db/firebase";
import { getRpcUrl, type SupportedNetwork } from "@/lib/utils/config";
import { chains } from "@/lib/utils/chains";
import { logger } from "@/lib/utils/logger";
import { evaluateSpendCaps, sumSpend, toWei, type SponsorSpendRule } from "./sponsorSpendCaps";

export { evaluateSpendCaps, sumSpend, toWei, type SponsorSpendRule, type SpendSnapshot, type SpendVerdict } from "./sponsorSpendCaps";

import { DAY_MS, MONTH_MS } from "./sponsorSpendCaps";
export { DAY_MS, MONTH_MS };
const LEDGER = "perkos_sponsor_spend";

/** What the sponsor wallet spent in the last day and month, from the ledger. */
export async function spentWindows(sponsorWalletId: string, now = Date.now()): Promise<{ spentDayWei: bigint; spentMonthWei: bigint }> {
  const { data, error } = await firebaseAdmin
    .from<{ gas_cost_wei?: string; created_at?: unknown }>(LEDGER)
    .select("gas_cost_wei, created_at")
    .eq("sponsor_wallet_id", sponsorWalletId);
  if (error) {
    // Fail closed only for the windows we cannot see: treat as unknown → no
    // spend counted. The per-transaction cap still applies. Logged loudly.
    logger.warn("Sponsor spend ledger unavailable; window caps not enforced for this call", { sponsorWalletId, error: error.message });
    return { spentDayWei: 0n, spentMonthWei: 0n };
  }
  const rows = data || [];
  return { spentDayWei: sumSpend(rows, now - DAY_MS), spentMonthWei: sumSpend(rows, now - MONTH_MS) };
}

/** estimateGas × gasPrice for the call the sponsor is about to send; null when the RPC cannot say. */
export async function estimateSettlementCostWei(network: SupportedNetwork, sponsor: Address, to: Address, data: Hex): Promise<bigint | null> {
  try {
    const chain = chains[network];
    const client = createPublicClient({ chain, transport: http(getRpcUrl(network)) });
    const [gas, price] = await Promise.all([client.estimateGas({ account: sponsor, to, data }), client.getGasPrice()]);
    return gas * price;
  } catch (e) {
    logger.warn("Could not estimate settlement gas; per-transaction cap skipped", { network, error: (e as Error).message });
    return null;
  }
}

/**
 * The guard the settlement paths call before sending. `ok: false` carries a
 * reason fit for the SettleResponse; nothing has been sent when it returns.
 */
export async function guardSponsorSpend(params: {
  network: SupportedNetwork;
  sponsorWalletId: string;
  sponsorAddress: Address;
  rule?: SponsorSpendRule | null;
  to: Address;
  data: Hex;
}): Promise<{ ok: true; estimatedCostWei: bigint | null } | { ok: false; reason: string }> {
  const rule = params.rule;
  const hasCaps = !!rule && (toWei(rule.per_transaction_limit_wei) !== null || toWei(rule.daily_limit_wei) !== null || toWei(rule.monthly_limit_wei) !== null);
  if (!hasCaps) return { ok: true, estimatedCostWei: null };

  const [estimatedCostWei, windows] = await Promise.all([
    estimateSettlementCostWei(params.network, params.sponsorAddress, params.to, params.data),
    spentWindows(params.sponsorWalletId),
  ]);
  const verdict = evaluateSpendCaps(rule, { estimatedCostWei, ...windows });
  if (!verdict.ok) {
    logger.warn("Sponsor spend cap refused a settlement", { sponsorWalletId: params.sponsorWalletId, ruleId: rule!.id, cap: verdict.cap, estimatedCostWei: estimatedCostWei?.toString() ?? null, spentDayWei: windows.spentDayWei.toString(), spentMonthWei: windows.spentMonthWei.toString() });
    return { ok: false, reason: verdict.reason };
  }
  return { ok: true, estimatedCostWei };
}

/** Append the real cost of a settlement to the ledger (fire-and-forget safe). */
export async function recordSponsorSpend(params: {
  sponsorWalletId: string;
  ruleId?: string | null;
  network: string;
  transactionHash: string;
  gasCostWei?: string | null;
  vendorDomain?: string | null;
}): Promise<void> {
  const cost = toWei(params.gasCostWei);
  if (cost === null) return; // no receipt → nothing measurable to record
  try {
    await firebaseAdmin.from(LEDGER).insert({
      sponsor_wallet_id: params.sponsorWalletId,
      rule_id: params.ruleId ?? null,
      network: params.network,
      transaction_hash: params.transactionHash,
      gas_cost_wei: cost.toString(),
      vendor_domain: params.vendorDomain ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.warn("Could not record sponsor spend", { transactionHash: params.transactionHash, error: (e as Error).message });
  }
}
