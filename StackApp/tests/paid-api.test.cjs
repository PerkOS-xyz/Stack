const assert = require("node:assert/strict");
const test = require("node:test");

const NETWORKS = [
  { key: "base", caip2: "eip155:8453", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", tokenName: "USD Coin", tokenVersion: "2", decimals: 6, testnet: false },
  { key: "base-sepolia", caip2: "eip155:84532", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", tokenName: "USDC", tokenVersion: "2", decimals: 6, testnet: true },
];
const PAY_TO = "0x3f0D7b9916212fA0A9Ac0EF8f72a25EB56F7046C";
const URL = "https://stack.perkos.xyz/api/v1?chainId=8453&agentId=42";

test("catalog: every product has a price, a path and named inputs", async () => {
  const { PRODUCTS, catalog, priceUnits } = await import("../lib/agents/paidApi.ts");
  assert.ok(PRODUCTS["agent-report"] && PRODUCTS["payer-trust"]);
  for (const p of catalog()) {
    assert.match(p.price, /^\$\d/);
    assert.ok(p.path.startsWith("/api/v1"));
    assert.ok(p.inputs.length >= 1);
  }
  assert.equal(priceUnits(0.01), "10000");
  assert.equal(priceUnits(1.5), "1500000");
});

test("402 offers: v2 header and v1 body describe the same product on every network", async () => {
  const { PRODUCTS, offersV1, offersV2, encodePaymentRequired, paymentRequiredBody } = await import("../lib/agents/paidApi.ts");
  const p = PRODUCTS["agent-report"];
  const v2 = offersV2(p, URL, PAY_TO, NETWORKS);
  const v1 = offersV1(p, URL, PAY_TO, NETWORKS);
  assert.equal(v2.length, 2);
  assert.deepEqual(v2.map((o) => o.network), ["eip155:8453", "eip155:84532"]);
  assert.deepEqual(v1.map((o) => o.network), ["base", "base-sepolia"]);
  for (const o of v2) {
    assert.equal(o.scheme, "exact");
    assert.equal(o.amount, "10000");
    assert.equal(o.payTo, PAY_TO);
    assert.equal(o.resource.url, URL);
    assert.ok(o.extra.name && o.extra.version);
  }
  assert.equal(v1[0].maxAmountRequired, "10000");
  assert.equal(v1[0].resource, URL);
  const header = encodePaymentRequired(p, URL, v2);
  const doc = JSON.parse(Buffer.from(header, "base64").toString());
  assert.equal(doc.x402Version, 2);
  assert.equal(doc.accepts.length, 2);
  assert.equal(doc.resource.url, URL);
  const body = paymentRequiredBody(p, v1);
  assert.equal(body.x402Version, 1);
  assert.equal(body.accepts.length, 2);
  assert.ok(body.catalog.length >= 2);
});

test("payment headers: either version is read and decoded from base64 or raw JSON", async () => {
  const { readPaymentHeader, decodePaymentHeader } = await import("../lib/agents/paidApi.ts");
  const h = { "x-payment": "e30=" };
  assert.equal(readPaymentHeader((n) => h[n.toLowerCase()] ?? null), "e30=");
  const h2 = { "payment-signature": '{"x402Version":2}' };
  assert.equal(readPaymentHeader((n) => h2[n.toLowerCase()] ?? null), '{"x402Version":2}');
  assert.equal(readPaymentHeader(() => null), null);
  assert.deepEqual(decodePaymentHeader("e30="), {});
  assert.deepEqual(decodePaymentHeader('{"a":1}'), { a: 1 });
  assert.equal(decodePaymentHeader("not json"), null);
  assert.equal(decodePaymentHeader(""), null);
});

test("matching: a v2 payment must name an offered network and amount; v1 matches by network key or CAIP-2", async () => {
  const { PRODUCTS, offersV1, offersV2, matchPayment } = await import("../lib/agents/paidApi.ts");
  const p = PRODUCTS["agent-report"];
  const v2 = offersV2(p, URL, PAY_TO, NETWORKS);
  const v1 = offersV1(p, URL, PAY_TO, NETWORKS);
  const good = matchPayment({ x402Version: 2, accepted: { network: "eip155:8453", amount: "10000" }, payload: {} }, v2, v1, NETWORKS);
  assert.equal(good.x402Version, 2);
  assert.equal(good.paymentRequirements.network, "eip155:8453");
  const wrongAmount = matchPayment({ x402Version: 2, accepted: { network: "eip155:8453", amount: "1" } }, v2, v1, NETWORKS);
  assert.match(wrongAmount.error, /amount/);
  const wrongNet = matchPayment({ x402Version: 2, accepted: { network: "eip155:1" } }, v2, v1, NETWORKS);
  assert.match(wrongNet.error, /network/);
  const v1ok = matchPayment({ x402Version: 1, network: "base-sepolia", scheme: "exact", payload: {} }, v2, v1, NETWORKS);
  assert.equal(v1ok.x402Version, 1);
  assert.equal(v1ok.paymentRequirements.network, "base-sepolia");
  const v1caip = matchPayment({ x402Version: 1, network: "eip155:8453" }, v2, v1, NETWORKS);
  assert.equal(v1caip.paymentRequirements.network, "base");
  assert.match(matchPayment({ x402Version: 3 }, v2, v1, NETWORKS).error, /x402Version/);
});

test("PAYMENT-RESPONSE encodes the settlement outcome", async () => {
  const { encodePaymentResponse } = await import("../lib/agents/paidApi.ts");
  const doc = JSON.parse(Buffer.from(encodePaymentResponse({ success: true, transaction: "0xabc", network: "eip155:8453", payer: "0x1" }), "base64").toString());
  assert.deepEqual(doc, { success: true, payer: "0x1", transaction: "0xabc", network: "eip155:8453" });
  const bad = JSON.parse(Buffer.from(encodePaymentResponse({ success: false, network: "eip155:8453", errorReason: "nope" }), "base64").toString());
  assert.equal(bad.success, false);
  assert.equal(bad.errorReason, "nope");
});

test("toIso normalizes ISO strings and Firestore Timestamps, and drops garbage", async () => {
  const { toIso } = await import("../lib/agents/paidApi.ts");
  assert.equal(toIso("2026-01-17T01:50:23.672Z"), "2026-01-17T01:50:23.672Z");
  assert.equal(toIso({ _seconds: 1768589232, _nanoseconds: 705000000 }), "2026-01-16T18:47:12.000Z");
  assert.equal(toIso({ toDate: () => new Date(0) }), "1970-01-01T00:00:00.000Z");
  assert.equal(toIso("not a date"), null);
  assert.equal(toIso(null), null);
  const mixed = ["2026-01-17T01:50:23.672Z", { _seconds: 1768589232 }, undefined].map(toIso).filter(Boolean).sort();
  assert.deepEqual(mixed, ["2026-01-16T18:47:12.000Z", "2026-01-17T01:50:23.672Z"]);
});
