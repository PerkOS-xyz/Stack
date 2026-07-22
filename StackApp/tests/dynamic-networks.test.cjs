const assert = require("node:assert/strict");
const test = require("node:test");

test("Dynamic additional networks never duplicate manually configured chain IDs", async () => {
  const {
    MANUALLY_CONFIGURED_DYNAMIC_CHAIN_IDS,
    selectAdditionalDynamicNetworkOptions,
  } = await import(
    "../lib/wallet/providers/dynamic/networkSelection.ts"
  );
  const manual = MANUALLY_CONFIGURED_DYNAMIC_CHAIN_IDS;
  const catalog = [
    { value: "robinhood", chainId: 4663 },
    { value: "robinhood-testnet", chainId: 46630 },
    { value: "unichain", chainId: 130 },
    { value: "duplicate-unichain", chainId: 130 },
  ];
  const additional = selectAdditionalDynamicNetworkOptions(catalog, manual);
  assert.deepEqual(additional.map((entry) => entry.chainId), [130]);
  const combined = [...manual, ...additional.map((entry) => entry.chainId)];
  assert.equal(new Set(combined).size, combined.length);
  assert.equal(combined.filter((chainId) => chainId === 46630).length, 1);
});
