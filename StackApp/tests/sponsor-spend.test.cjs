const assert = require("node:assert/strict");
const test = require("node:test");

test("a rule without caps never refuses, and null/garbage limits mean no cap", async () => {
  const { evaluateSpendCaps, toWei } = await import("../lib/services/sponsorSpendCaps.ts");
  assert.deepEqual(evaluateSpendCaps(null, { estimatedCostWei: 10n ** 18n, spentDayWei: 10n ** 20n, spentMonthWei: 10n ** 21n }), { ok: true });
  assert.deepEqual(evaluateSpendCaps({ id: "r" }, { estimatedCostWei: 10n ** 18n, spentDayWei: 10n ** 20n, spentMonthWei: 0n }), { ok: true });
  assert.equal(toWei(null), null);
  assert.equal(toWei(""), null);
  assert.equal(toWei("abc"), null);
  assert.equal(toWei("-5"), null);
  assert.equal(toWei("500000000000000"), 500000000000000n);
  assert.equal(toWei(1e15), 1000000000000000n);
});

test("per-transaction cap compares the estimate; unknown estimate skips only that cap", async () => {
  const { evaluateSpendCaps } = await import("../lib/services/sponsorSpendCaps.ts");
  const rule = { id: "r", per_transaction_limit_wei: "1000" };
  assert.equal(evaluateSpendCaps(rule, { estimatedCostWei: 999n, spentDayWei: 0n, spentMonthWei: 0n }).ok, true);
  assert.equal(evaluateSpendCaps(rule, { estimatedCostWei: 1000n, spentDayWei: 0n, spentMonthWei: 0n }).ok, true);
  const over = evaluateSpendCaps(rule, { estimatedCostWei: 1001n, spentDayWei: 0n, spentMonthWei: 0n });
  assert.equal(over.ok, false);
  assert.equal(over.cap, "per_transaction");
  assert.equal(evaluateSpendCaps(rule, { estimatedCostWei: null, spentDayWei: 0n, spentMonthWei: 0n }).ok, true, "no estimate → per-tx cap cannot be judged");
});

test("daily and monthly caps count what was spent plus this settlement", async () => {
  const { evaluateSpendCaps } = await import("../lib/services/sponsorSpendCaps.ts");
  const rule = { id: "r", daily_limit_wei: "1000", monthly_limit_wei: "5000" };
  assert.equal(evaluateSpendCaps(rule, { estimatedCostWei: 100n, spentDayWei: 900n, spentMonthWei: 900n }).ok, true);
  const day = evaluateSpendCaps(rule, { estimatedCostWei: 101n, spentDayWei: 900n, spentMonthWei: 900n });
  assert.equal(day.ok, false);
  assert.equal(day.cap, "daily");
  const month = evaluateSpendCaps(rule, { estimatedCostWei: 100n, spentDayWei: 100n, spentMonthWei: 4950n });
  assert.equal(month.ok, false);
  assert.equal(month.cap, "monthly");
  // with no estimate, already-spent alone can still trip the window caps
  assert.equal(evaluateSpendCaps(rule, { estimatedCostWei: null, spentDayWei: 1001n, spentMonthWei: 0n }).cap, "daily");
});

test("ledger windows sum only rows inside the window, across ISO and Timestamp shapes", async () => {
  const { sumSpend, DAY_MS } = await import("../lib/services/sponsorSpendCaps.ts");
  const now = Date.parse("2026-09-09T20:00:00Z");
  const rows = [
    { gas_cost_wei: "100", created_at: "2026-09-09T19:00:00Z" },          // inside
    { gas_cost_wei: "200", created_at: { _seconds: (now - 2 * 3600 * 1000) / 1000 } }, // inside, Timestamp shape
    { gas_cost_wei: "400", created_at: "2026-09-07T19:00:00Z" },          // outside the day
    { gas_cost_wei: "garbage", created_at: "2026-09-09T19:30:00Z" },      // ignored amount
    { gas_cost_wei: "800" },                                              // no date → ignored
  ];
  assert.equal(sumSpend(rows, now - DAY_MS), 300n);
  assert.equal(sumSpend(rows, now - 30 * DAY_MS), 700n);
});
