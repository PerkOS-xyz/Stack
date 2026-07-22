const assert = require("node:assert/strict");
const test = require("node:test");

test("sponsor rules match lowercase and historical checksum addresses deterministically", async () => {
  const { selectSponsorRule } = await import("../lib/services/sponsorRuleSelection.ts");
  const address = "0xc7293aad237044082038e657d6f30dc82bae2604";
  const rules = [
    { id: "later", sponsor_wallet_id: "wallet-b", agent_address: address, priority: 10, created_at: "2026-01-02" },
    { id: "older", sponsor_wallet_id: "wallet-a", agent_address: "0xc7293AaD237044082038E657d6F30dC82BAe2604", priority: 10, created_at: "2026-01-01" },
    { id: "lower", sponsor_wallet_id: "wallet-c", agent_address: address, priority: 5, created_at: "2025-01-01" },
    { id: "other", sponsor_wallet_id: "wallet-d", agent_address: "0x0000000000000000000000000000000000000001", priority: 99 },
  ];

  assert.equal(selectSponsorRule(rules, address)?.sponsor_wallet_id, "wallet-a");
  assert.equal(selectSponsorRule(rules, address.toUpperCase())?.sponsor_wallet_id, "wallet-a");
});

test("duplicate sponsor priorities use stable ids when timestamps are absent", async () => {
  const { selectSponsorRule } = await import("../lib/services/sponsorRuleSelection.ts");
  const address = "0x1111111111111111111111111111111111111111";
  const rules = [
    { id: "z", sponsor_wallet_id: "wallet-z", agent_address: address, priority: 1 },
    { id: "a", sponsor_wallet_id: "wallet-a", agent_address: address, priority: 1 },
  ];
  assert.equal(selectSponsorRule(rules, address)?.sponsor_wallet_id, "wallet-a");
});
