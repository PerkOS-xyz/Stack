const assert = require("node:assert/strict");
const test = require("node:test");

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

test("rotation message is wallet- and time-bound", async () => {
  const { buildRotationMessage, ROTATION_WINDOW_MS } = await import("../lib/agents/rotationMessage.ts");
  const ts = 1788960000000;
  const m = buildRotationMessage("0xABCDEF0000000000000000000000000000000001", ts);
  assert.equal(m, "Rotate PerkOS Stack Agent API key\nWallet: 0xabcdef0000000000000000000000000000000001\nTimestamp: 1788960000000");
  assert.notEqual(m, buildRotationMessage("0xABCDEF0000000000000000000000000000000002", ts));
  assert.notEqual(m, buildRotationMessage("0xABCDEF0000000000000000000000000000000001", ts + 1));
  assert.equal(ROTATION_WINDOW_MS, 5 * 60 * 1000);
});

test("a wallet signature over the rotation message verifies only for that wallet and timestamp", async () => {
  const { buildRotationMessage } = await import("../lib/agents/rotationMessage.ts");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { verifyMessage } = await import("viem");
  const account = privateKeyToAccount(PRIVATE_KEY);
  const ts = Date.now();
  const signature = await account.signMessage({ message: buildRotationMessage(account.address, ts) });

  assert.equal(await verifyMessage({ address: account.address, message: buildRotationMessage(account.address, ts), signature }), true);
  // A different timestamp (replay outside the window) or a different wallet does not verify.
  assert.equal(await verifyMessage({ address: account.address, message: buildRotationMessage(account.address, ts + 1), signature }), false);
  const other = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
  assert.equal(await verifyMessage({ address: other.address, message: buildRotationMessage(other.address, ts), signature }), false);
});
