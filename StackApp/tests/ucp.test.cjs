const assert = require("node:assert/strict");
const test = require("node:test");

const SITE = "https://stack.perkos.xyz";

test("UCP profile declares a payment handler and no shopping service", async () => {
  const { ucpProfile, UCP_VERSION } = await import("../lib/agents/ucp.ts");
  const p = ucpProfile(SITE, ["base", "base-sepolia"]);
  assert.equal(p.ucp.version, UCP_VERSION);
  assert.equal(p.ucp.services, undefined, "declaring a service would promise a cart that does not exist");
  const handlers = p.ucp.payment_handlers["xyz.perkos.x402"];
  assert.equal(handlers.length, 1);
  const h = handlers[0];
  assert.equal(h.config.type, "X402");
  assert.equal(h.config.payment_requirements_url, `${SITE}/api/v1`);
  assert.equal(h.config.x402_version, 2);
  assert.deepEqual(h.available_instruments[0].constraints.networks, ["base", "base-sepolia"]);
  assert.equal(h.schema, `${SITE}/.well-known/ucp/x402-handler.schema.json`);
  assert.equal(h.config.facilitator.settle, `${SITE}/api/v2/x402/settle`);
});

test("the handler schema validates the config the profile publishes", async () => {
  const { ucpProfile, ucpHandlerSchema } = await import("../lib/agents/ucp.ts");
  const schema = ucpHandlerSchema(SITE);
  const config = ucpProfile(SITE, ["base"]).ucp.payment_handlers["xyz.perkos.x402"][0].config;
  assert.equal(schema.$id, `${SITE}/.well-known/ucp/x402-handler.schema.json`);
  for (const key of schema.required) assert.ok(key in config, `config lacks required ${key}`);
  for (const key of Object.keys(config)) assert.ok(key in schema.properties, `schema does not allow ${key} but the profile publishes it`);
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties.x402_version.enum.includes(config.x402_version));
});
