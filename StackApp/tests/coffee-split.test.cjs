const assert = require("node:assert/strict");
const test = require("node:test");

const SPLIT = "0x704F85Bca00617096fa4F3d5C5499Ff373Fd5d38";
const CREATOR = "0x00000000000000000000000000000000c0ffee00";
const COFFEE_ID = "0x" + "11".repeat(32);
const env = { COFFEE_SPLIT_ADDRESS_BASE_SEPOLIA: SPLIT };

function requirements(overrides = {}) {
  return {
    scheme: "exact",
    network: "eip155:84532",
    amount: "5000000",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: SPLIT,
    resource: { url: "https://buyacoffee.perkos.xyz/juliomcruz" },
    extra: { split: { contract: SPLIT, creator: CREATOR, coffeeId: COFFEE_ID } },
    ...overrides,
  };
}

test("coffeeNonce matches the Solidity derivation", async () => {
  const { coffeeNonce } = await import("../lib/services/coffeeSplit.ts");
  const { keccak256, encodePacked } = require("viem");
  const expected = keccak256(encodePacked(["string", "address", "bytes32"], ["PerkOS.Coffee.v1", CREATOR, COFFEE_ID]));
  assert.equal(coffeeNonce(CREATOR, COFFEE_ID), expected);
  // Two creators never share a nonce for the same coffee id.
  assert.notEqual(coffeeNonce(CREATOR, COFFEE_ID), coffeeNonce("0x0000000000000000000000000000000000000bad", COFFEE_ID));
});

test("plain exact payments have no split", async () => {
  const { parseSplitExtra } = await import("../lib/services/coffeeSplit.ts");
  assert.deepEqual(parseSplitExtra(requirements({ extra: undefined }), "base-sepolia", env), { split: null });
  assert.deepEqual(parseSplitExtra(requirements({ extra: { other: 1 } }), "base-sepolia", env), { split: null });
});

test("a valid split parses and fills memoHash with zero", async () => {
  const { parseSplitExtra } = await import("../lib/services/coffeeSplit.ts");
  const r = parseSplitExtra(requirements(), "base-sepolia", env);
  assert.ok(r.split);
  assert.equal(r.split.contract, SPLIT);
  assert.equal(r.split.creator, CREATOR);
  assert.equal(r.split.coffeeId, COFFEE_ID);
  assert.equal(r.split.memoHash, "0x" + "0".repeat(64));
});

test("split is rejected when the contract is not the allowlisted one, or the network has none", async () => {
  const { parseSplitExtra } = await import("../lib/services/coffeeSplit.ts");
  const other = "0x0000000000000000000000000000000000000bad";
  let r = parseSplitExtra(requirements({ extra: { split: { contract: other, creator: CREATOR, coffeeId: COFFEE_ID } }, payTo: other }), "base-sepolia", env);
  assert.equal(r.split, null);
  assert.match(r.error, /CoffeeSplit contract/);
  r = parseSplitExtra(requirements(), "base", env); // no COFFEE_SPLIT_ADDRESS_BASE in env
  assert.equal(r.split, null);
  assert.match(r.error, /not available/);
  r = parseSplitExtra(requirements({ payTo: CREATOR }), "base-sepolia", env);
  assert.equal(r.split, null);
  assert.match(r.error, /payTo/);
});

test("split rejects a bad creator or coffeeId", async () => {
  const { parseSplitExtra } = await import("../lib/services/coffeeSplit.ts");
  let r = parseSplitExtra(requirements({ extra: { split: { contract: SPLIT, creator: SPLIT, coffeeId: COFFEE_ID } } }), "base-sepolia", env);
  assert.match(r.error, /creator/);
  r = parseSplitExtra(requirements({ extra: { split: { contract: SPLIT, creator: CREATOR, coffeeId: "0x1234" } } }), "base-sepolia", env);
  assert.match(r.error, /coffeeId/);
});

test("encodeCoffeeSettle targets settle(address,bytes32,bytes32,(address,uint256,uint256,uint256,uint8,bytes32,bytes32))", async () => {
  const { encodeCoffeeSettle, COFFEE_SPLIT_ABI } = await import("../lib/services/coffeeSplit.ts");
  const { toFunctionSelector, decodeFunctionData } = require("viem");
  const data = encodeCoffeeSettle({
    split: { contract: SPLIT, creator: CREATOR, coffeeId: COFFEE_ID, memoHash: "0x" + "0".repeat(64) },
    from: "0x00000000000000000000000000000000000000d0",
    value: 5000000n,
    validAfter: 0n,
    validBefore: 1800000000n,
    v: 27,
    r: "0x" + "aa".repeat(32),
    s: "0x" + "bb".repeat(32),
  });
  const selector = toFunctionSelector("settle(address,bytes32,bytes32,(address,uint256,uint256,uint256,uint8,bytes32,bytes32))");
  assert.equal(data.slice(0, 10), selector);
  const decoded = decodeFunctionData({ abi: COFFEE_SPLIT_ABI, data });
  assert.equal(decoded.functionName, "settle");
  assert.equal(decoded.args[0].toLowerCase(), CREATOR.toLowerCase());
  assert.equal(decoded.args[3].value, 5000000n);
});

test("CoffeeSplit addresses are allowlisted per network, including Celo and Robinhood", async () => {
  const { getCoffeeSplitAddress } = await import("../lib/services/coffeeSplit.ts");
  const env = { COFFEE_SPLIT_ADDRESS_BASE: "0x" + "aa".repeat(20), COFFEE_SPLIT_ADDRESS_CELO: "0x" + "bb".repeat(20), COFFEE_SPLIT_ADDRESS_ROBINHOOD: "0x" + "cc".repeat(20) };
  assert.equal(getCoffeeSplitAddress("celo", env), "0x" + "bb".repeat(20));
  assert.equal(getCoffeeSplitAddress("robinhood", env), "0x" + "cc".repeat(20));
  assert.equal(getCoffeeSplitAddress("base-sepolia", env), null, "unset network stays unavailable");
  assert.equal(getCoffeeSplitAddress("avalanche", env), null, "unknown network has no key");
});
