const assert = require("node:assert/strict");
const test = require("node:test");

test("ERC-8183 uint256 validation rejects overflow and oversized decimal strings", async () => {
  const { MAX_UINT256, uint256 } = await import("../lib/erc8183/validation.ts");
  assert.equal(uint256.safeParse(MAX_UINT256.toString()).success, true);
  assert.equal(uint256.safeParse((MAX_UINT256 + 1n).toString()).success, false);
  assert.equal(uint256.safeParse("9".repeat(10_000)).success, false);
  assert.equal(uint256.safeParse(Number.MAX_SAFE_INTEGER).success, true);
  assert.equal(uint256.safeParse(Number.MAX_SAFE_INTEGER + 1).success, false);
});

test("ERC-8183 optParams validation enforces the 32 KiB boundary", async () => {
  const { boundedBytes, MAX_OPT_PARAMS_BYTES } = await import("../lib/erc8183/validation.ts");
  assert.equal(boundedBytes.safeParse(`0x${"aa".repeat(MAX_OPT_PARAMS_BYTES)}`).success, true);
  assert.equal(boundedBytes.safeParse(`0x${"aa".repeat(MAX_OPT_PARAMS_BYTES + 1)}`).success, false);
  assert.equal(boundedBytes.safeParse("0x0").success, false);
});

test("ERC-8183 ABI exposes every non-administrative role action", async () => {
  const { ERC8183_ABI } = await import("../lib/contracts/erc8183/abi.ts");
  const names = new Set(ERC8183_ABI.filter((entry) => entry.type === "function").map((entry) => entry.name));
  for (const name of [
    "createJob", "setProvider", "setPayoutReceiver", "setBudget", "fund",
    "submit", "complete", "reject", "claimRefund", "submitClaim",
    "settleClaim", "approveClaim", "rejectClaim", "getJob",
  ]) assert.equal(names.has(name), true, `missing ${name}`);
});
