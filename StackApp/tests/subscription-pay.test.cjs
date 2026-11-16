const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

// Runs the real POST /api/subscription/pay handler and SubscriptionService.
// Only the edges are replaced: the database is an in-memory Firestore and the
// chain is a JSON-RPC answer served through fetch.
const ROOT = path.join(__dirname, "..");
const ROOT_URL = pathToFileURL(ROOT).href;
const FIREBASE_URL = pathToFileURL(path.join(ROOT, "lib/db/firebase.ts")).href;
const FIREBASE_STAND_IN = `data:text/javascript,${encodeURIComponent(`
  export const getAdminFirestoreDb = () => globalThis.__subscriptionPayTest.db;
  export const firebaseAdmin = { get firestore() { return globalThis.__subscriptionPayTest.db; } };`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    const parent = context.parentURL || "";
    const ours = parent.startsWith(ROOT_URL) && !parent.includes("/node_modules/");
    let target = specifier;
    if (specifier.startsWith("@/")) {
      target = pathToFileURL(path.join(ROOT, specifier.slice(2))).href;
    } else if (!(ours && specifier.startsWith("."))) {
      return nextResolve(specifier, context);
    }
    if (!path.extname(target)) target += ".ts";
    const resolved = nextResolve(target, context);
    if (resolved.url === FIREBASE_URL) return { url: FIREBASE_STAND_IN, shortCircuit: true };
    return target.endsWith(".json") ? { ...resolved, importAttributes: { type: "json" } } : resolved;
  },
});

/** The few Firestore calls the plan grant makes, with writes applied on commit. */
function memoryFirestore() {
  const docs = new Map();
  let auto = 0;
  const ref = (collection, id) => ({ id, path: `${collection}/${id}` });
  const snapshot = (r) => ({ exists: docs.has(r.path), id: r.id, ref: r, data: () => docs.get(r.path) });
  return {
    docs,
    collection: (name) => ({
      doc: (id = `auto-${++auto}`) => ref(name, id),
      where: (field, _op, value) => ({ limit: () => ({ name, field, value }) }),
    }),
    async runTransaction(run) {
      const writes = [];
      const result = await run({
        async get(target) {
          if (target.path) return snapshot(target);
          const hits = [...docs.keys()]
            .filter((key) => key.startsWith(`${target.name}/`) && docs.get(key)[target.field] === target.value)
            .map((key) => snapshot(ref(target.name, key.slice(target.name.length + 1))));
          return { docs: hits.slice(0, 1) };
        },
        set: (r, data) => writes.push(() => docs.set(r.path, data)),
        update: (r, data) => writes.push(() => docs.set(r.path, { ...docs.get(r.path), ...data })),
        create: (r, data) => writes.push(() => {
          if (docs.has(r.path)) throw new Error(`already exists: ${r.path}`);
          docs.set(r.path, data);
        }),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
}

const NETWORK = "base-sepolia";
const CHAIN_ID = 84532;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PAYER = "0x00000000000000000000000000000000000000a1";
const hash = (n) => `0x${"ab".repeat(28)}${String(n).padStart(8, "0")}`;
const topic = (address) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;

/** Puts one confirmed token transfer on the fake chain and returns its hash. */
function confirmTransfer(chain, { n, token, from, to, amount }) {
  const base = { blockHash: hash(9000 + n), blockNumber: "0x10", transactionIndex: "0x0" };
  chain.set(hash(n), {
    transaction: { ...base, hash: hash(n), from, to: token, value: "0x0", gas: "0x5208", gasPrice: "0x1", nonce: "0x0", input: "0x", type: "0x0", v: "0x1b", r: "0x1", s: "0x1" },
    receipt: {
      ...base, transactionHash: hash(n), from, to: token, status: "0x1", type: "0x0", contractAddress: null,
      gasUsed: "0x5208", cumulativeGasUsed: "0x5208", effectiveGasPrice: "0x1", logsBloom: `0x${"0".repeat(512)}`,
      logs: [{
        ...base, address: token, transactionHash: hash(n), logIndex: "0x0", removed: false,
        topics: [TRANSFER_TOPIC, topic(from), topic(to)],
        data: `0x${amount.toString(16).padStart(64, "0")}`,
      }],
    },
  });
  return hash(n);
}

async function setup(t) {
  const chain = new Map();
  const db = memoryFirestore();
  globalThis.__subscriptionPayTest = { db };
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const call = JSON.parse(init.body);
    const entry = chain.get(String(call.params[0]).toLowerCase());
    const result = call.method === "eth_getTransactionReceipt" ? entry?.receipt
      : call.method === "eth_getTransactionByHash" ? entry?.transaction
      : undefined;
    return Response.json({ jsonrpc: "2.0", id: call.id, result: result ?? null });
  });
  t.mock.method(console, "log", () => {});

  const { POST } = await import("../app/api/subscription/pay/route.ts");
  const { SUBSCRIPTION_TIERS } = await import("../lib/config/subscriptions.ts");
  const { getUSDCAddress } = await import("../lib/utils/chains.ts");
  const { config } = await import("../lib/utils/config.ts");
  const { parseUnits } = await import("viem");

  const price = (tier) => parseUnits(String(SUBSCRIPTION_TIERS[tier].priceMonthly), 6);
  const pay = (n, tier, from = PAYER) =>
    confirmTransfer(chain, { n, token: getUSDCAddress(CHAIN_ID), from, to: config.paymentReceiver, amount: price(tier) });
  const claim = (transactionHash, userWalletAddress, tier) =>
    POST(new Request("http://localhost/api/subscription/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userWalletAddress, tier, billingCycle: "monthly", network: NETWORK, transactionHash }),
    }));
  const planOf = (wallet) => [...db.docs.entries()]
    .filter(([key, doc]) => key.startsWith("perkos_subscriptions/") && doc.user_wallet_address === wallet)
    .map(([, doc]) => doc.tier);
  return { db, pay, claim, planOf };
}

test("a transfer pays for a plan once: a second claim of the same hash grants nothing", async (t) => {
  const { db, pay, claim, planOf } = await setup(t);
  const paid = pay(1, "starter");

  const first = await claim(paid, PAYER, "starter");
  assert.equal(first.status, 200);
  assert.deepEqual(planOf(PAYER), ["starter"]);
  assert.equal(db.docs.get(`perkos_subscription_payments/${CHAIN_ID}_${paid}`).user_wallet_address, PAYER);

  // Reusing the hash, in any letter case, is refused and leaves the plan as it was.
  for (const reused of [paid, paid.toUpperCase().replace("0X", "0x")]) {
    const again = await claim(reused, PAYER, "starter");
    assert.equal(again.status, 409);
  }
  assert.deepEqual(planOf(PAYER), ["starter"]);
  assert.equal([...db.docs.keys()].filter((key) => key.startsWith("perkos_subscription_payments/")).length, 1);

  // A new transfer still renews or upgrades the same subscription record.
  const upgrade = await claim(pay(2, "pro"), PAYER, "pro");
  assert.equal(upgrade.status, 200);
  assert.deepEqual(planOf(PAYER), ["pro"]);
});
