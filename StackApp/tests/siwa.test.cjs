const assert = require("node:assert/strict");
const test = require("node:test");

const PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const CHAIN_ID = 84532;

test("SIWA authenticates an ERC-8004 owner and ERC-8128 rejects replay", async () => {
  const { privateKeyToAccount } = await import("viem/accounts");
  const { verifyMessage } = await import("viem");
  const {
    createSIWANonce,
    signSIWAMessage,
    verifySIWA,
  } = await import("@buildersgarden/siwa/siwa");
  const { createMemorySIWANonceStore } = await import("@buildersgarden/siwa/nonce-store");
  const { createReceipt } = await import("@buildersgarden/siwa/receipt");
  const {
    signAuthenticatedRequest,
    verifyAuthenticatedRequest,
  } = await import("@buildersgarden/siwa/erc8128");

  const account = privateKeyToAccount(PRIVATE_KEY);
  const signer = {
    getAddress: async () => account.address,
    signMessage: async (message) => account.signMessage({ message }),
    signRawMessage: async (rawHex) => account.signMessage({ message: { raw: rawHex } }),
  };
  const publicClient = {
    readContract: async () => account.address,
    verifyMessage: async (args) => verifyMessage(args),
    getCode: async () => "0x",
  };
  const nonceStore = createMemorySIWANonceStore();
  const agentRegistry = `eip155:${CHAIN_ID}:${REGISTRY}`;
  const nonceResult = await createSIWANonce({
    address: account.address,
    agentId: 42,
    agentRegistry,
  }, publicClient, { nonceStore, expirationTTL: 60_000 });
  assert.equal(nonceResult.status, "nonce_issued");

  const signed = await signSIWAMessage({
    domain: "stack.perkos.xyz",
    uri: "https://stack.perkos.xyz/api/v2/agents/siwa/verify",
    agentId: 42,
    agentRegistry,
    chainId: CHAIN_ID,
    nonce: nonceResult.nonce,
    issuedAt: nonceResult.issuedAt,
    expirationTime: nonceResult.expirationTime,
  }, signer);
  const result = await verifySIWA(
    signed.message,
    signed.signature,
    "stack.perkos.xyz",
    { nonceStore },
    publicClient,
  );
  assert.equal(result.valid, true);

  const secret = "test-only-secret-that-is-longer-than-thirty-two-characters";
  const { receipt } = createReceipt({
    address: result.address,
    agentId: result.agentId,
    agentRegistry: result.agentRegistry,
    chainId: result.chainId,
    verified: result.verified,
    signerType: result.signerType,
  }, { secret, ttl: 60_000 });

  const request = await signAuthenticatedRequest(
    new Request("https://stack.perkos.xyz/api/v2/agents/siwa/session"),
    receipt,
    signer,
    CHAIN_ID,
  );
  const seen = new Set();
  const replayStore = {
    consume: async (key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
  const verified = await verifyAuthenticatedRequest(request.clone(), {
    receiptSecret: secret,
    verifyOnchain: true,
    publicClient,
    nonceStore: replayStore,
  });
  assert.equal(verified.valid, true, verified.error);
  if (verified.valid) assert.equal(verified.agent.agentId, 42);

  const replayed = await verifyAuthenticatedRequest(request.clone(), {
    receiptSecret: secret,
    verifyOnchain: true,
    publicClient,
    nonceStore: replayStore,
  });
  assert.equal(replayed.valid, false);
});
