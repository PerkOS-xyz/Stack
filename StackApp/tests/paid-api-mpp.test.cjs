const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("MPP is advertised only when it can charge", async () => {
  const { mppConfigured, resetMppGates, mppGate } = await import("../lib/agents/mpp.ts");
  const { PRODUCTS } = await import("../lib/agents/paidApi.ts");
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.MPP_SECRET_KEY;
  resetMppGates();
  assert.equal(mppConfigured(), false);
  assert.equal(await mppGate(PRODUCTS["agent-report"]), null, "no gate without a Stripe key");
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.MPP_SECRET_KEY = "short";
  assert.equal(mppConfigured(), false, "challenge secret must be long enough to sign");
  process.env.MPP_SECRET_KEY = "s".repeat(32);
  assert.equal(mppConfigured(), true);
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.MPP_SECRET_KEY;
  resetMppGates();
});

test("MPP offer prices in minor units and names the product", async () => {
  const { mppOffer, minorUnits } = await import("../lib/agents/mpp.ts");
  const { PRODUCTS } = await import("../lib/agents/paidApi.ts");
  assert.equal(minorUnits(0.01), "1");
  assert.equal(minorUnits(1.5), "150");
  const o = mppOffer(PRODUCTS["payer-trust"]);
  assert.deepEqual({ intent: o.intent, method: o.method, amount: o.amount, currency: o.currency }, { intent: "charge", method: "stripe", amount: "1", currency: "usd" });
  assert.match(o.description, /trust profile/);
});

test("card credential detection", async () => {
  const { offeringCard } = await import("../lib/agents/mpp.ts");
  assert.equal(offeringCard(new Request("https://x/", { headers: { authorization: "Payment abc" } })), true);
  assert.equal(offeringCard(new Request("https://x/", { headers: { authorization: "Bearer abc" } })), false);
  assert.equal(offeringCard(new Request("https://x/")), false);
});

test("openapi.json carries MPP discovery: x-payment-info on every paid operation and x-service-info", async () => {
  const { PRODUCTS } = await import("../lib/agents/paidApi.ts");
  const { mppOffer } = await import("../lib/agents/mpp.ts");
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "openapi.json"), "utf8"));
  assert.ok(spec["x-service-info"]?.categories?.length >= 1);
  for (const p of Object.values(PRODUCTS)) {
    const op = spec.paths[p.path]?.get;
    assert.ok(op, `missing operation for ${p.path}`);
    const info = op["x-payment-info"];
    assert.ok(info, `missing x-payment-info on ${p.path}`);
    const expected = mppOffer(p);
    assert.equal(info.intent, "charge");
    assert.equal(info.method, "stripe");
    assert.equal(info.amount, expected.amount);
    assert.equal(info.currency, "usd");
    assert.ok(info.offers.some((o) => o.method === "stripe" && o.amount === expected.amount));
    assert.ok(info.offers.some((o) => o.method === "x402" && o.amount === "10000"), "x402 offer alongside the card offer");
  }
});
