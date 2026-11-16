const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

// The route imports through the "@/" alias. Resolve it to the real files, and
// swap the modules that need a database for stand-ins, so the admin list comes
// from ADMIN_WALLETS and plan writes are only recorded.
const ROOT = path.join(__dirname, "..");
const granted = [];
globalThis.__subscriptionRouteTest = { granted };
const asModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const STAND_INS = {
  "@/lib/services/SubscriptionService": asModule(`
    export const getSubscriptionService = () => ({
      async createOrUpdateSubscription(wallet, tier) {
        globalThis.__subscriptionRouteTest.granted.push({ wallet, tier });
        return { id: "sub-1", tier, status: "active", started_at: "now", expires_at: null, trial_ends_at: null };
      },
    });`),
  "@/lib/db/firebase": asModule(`
    export const firebaseAdmin = { get firestore() { throw new Error("no database in tests"); } };`),
  "@/lib/middleware/rateLimiter": asModule(`export const enforceRateLimit = async () => ({ allowed: true });`),
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STAND_INS[specifier]) return { url: STAND_INS[specifier], shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(path.join(ROOT, `${specifier.slice(2)}.ts`)).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const ADMIN_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const OTHER_KEY = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";
const TARGET = "0x00000000000000000000000000000000000000aa";

async function signedHeaders(privateKey) {
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(privateKey);
  const timestamp = Date.now().toString();
  return {
    "X-Admin-Address": account.address,
    "X-Admin-Timestamp": timestamp,
    "X-Admin-Signature": await account.signMessage({ message: `PerkOS Admin ${timestamp}` }),
  };
}

async function postPlan(headers = {}) {
  const { POST } = await import("../app/api/subscription/route.ts");
  return POST(new Request("http://localhost/api/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ userWalletAddress: TARGET, tier: "enterprise" }),
  }));
}

test("POST /api/subscription grants a plan only to a signed admin request", async () => {
  const { privateKeyToAccount } = await import("viem/accounts");
  process.env.ADMIN_WALLETS = privateKeyToAccount(ADMIN_KEY).address;

  const anonymous = await postPlan();
  assert.equal(anonymous.status, 401);

  const notAdmin = await postPlan(await signedHeaders(OTHER_KEY));
  assert.equal(notAdmin.status, 401);

  const forged = await postPlan({ ...(await signedHeaders(OTHER_KEY)), "X-Admin-Address": privateKeyToAccount(ADMIN_KEY).address });
  assert.equal(forged.status, 401);

  assert.deepEqual(granted, [], "no plan is written for a refused request");

  const admin = await postPlan(await signedHeaders(ADMIN_KEY));
  assert.equal(admin.status, 200);
  assert.deepEqual(granted, [{ wallet: TARGET, tier: "enterprise" }]);
});
