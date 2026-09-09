const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const PUBLIC = path.join(__dirname, "..", "public");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PUBLIC, p), "utf8"));

test("markdown rendition lists every network and the agent entry points", async () => {
  const { stackMarkdown, estimateTokens, networkName } = await import("../lib/agents/readiness.ts");
  const kinds = [
    { x402Version: 2, scheme: "exact", network: "eip155:8453" },
    { x402Version: 2, scheme: "exact", network: "eip155:84532" },
    { x402Version: 2, scheme: "exact", network: "eip155:99999" },
  ];
  const md = stackMarkdown(kinds);
  assert.match(md, /^# PerkOS Stack/);
  assert.match(md, /Supported networks \(3\)/);
  assert.match(md, /Base \(`eip155:8453`\)/);
  assert.match(md, /eip155:99999/); // unknown ids still listed
  for (const p of ["/llms.txt", "/auth.md", "/openapi.json", "/mcp", "/api/a2a", "/.well-known/agent-skills/index.json", "/.well-known/ai-catalog.json"]) {
    assert.ok(md.includes(`https://stack.perkos.xyz${p}`), `missing ${p}`);
  }
  assert.equal(networkName("eip155:8453"), "Base");
  assert.ok(estimateTokens(md) > 200);
});

test("API catalog follows RFC 9727 and the Link header covers the same entry points", async () => {
  const { apiCatalog, homepageLinkHeader } = await import("../lib/agents/readiness.ts");
  const c = apiCatalog();
  assert.equal(c.linkset.length, 1);
  const e = c.linkset[0];
  assert.equal(e.anchor, "https://stack.perkos.xyz");
  assert.equal(e["service-desc"][0].href, "https://stack.perkos.xyz/openapi.json");
  assert.ok(e["service-doc"].some((d) => d.href.endsWith("/llms.txt")));
  assert.ok(e.status[0].href.endsWith("/api/v2/x402/health"));
  const link = homepageLinkHeader();
  for (const rel of ["api-catalog", "service-desc", "service-doc", "llms-txt", "agent-card", "mcp-server-card", "agent-skills", "ai-catalog"]) {
    assert.ok(link.includes(`rel="${rel}"`), `Link header lacks rel=${rel}`);
  }
});

test("agent-skills index digests match the published SKILL.md files", () => {
  const index = readJson(".well-known/agent-skills/index.json");
  assert.equal(index.$schema, "https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  assert.ok(index.skills.length >= 3);
  for (const s of index.skills) {
    assert.match(s.name, /^[a-z0-9-]+$/);
    assert.equal(s.type, "skill-md");
    assert.ok(s.url.startsWith("https://stack.perkos.xyz/.well-known/agent-skills/"));
    const rel = s.url.replace("https://stack.perkos.xyz/", "");
    const body = fs.readFileSync(path.join(PUBLIC, rel));
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    assert.equal(s.digest, digest, `digest drift for ${s.name}: run shasum -a 256 on the SKILL.md and update index.json`);
    assert.match(body.toString(), new RegExp(`^---\\nname: ${s.name}\\n`));
  }
});

test("ai-catalog entries are well formed (ARD)", () => {
  const cat = readJson(".well-known/ai-catalog.json");
  assert.equal(typeof cat.specVersion, "string");
  assert.equal(cat.host.identifier, "did:web:stack.perkos.xyz");
  assert.ok(cat.entries.length >= 4);
  for (const e of cat.entries) {
    assert.match(e.identifier, /^urn:air:stack\.perkos\.xyz:[a-z]+:[a-z0-9-]+$/);
    assert.ok(e.displayName && e.type);
    assert.equal(Boolean(e.url) !== Boolean(e.data), true, `${e.identifier} needs exactly one of url/data`);
    assert.ok(e.representativeQueries.length >= 2 && e.representativeQueries.length <= 5);
  }
});

test("MCP server card and tool catalog agree", async () => {
  const { MCP_TOOLS } = await import("../lib/agents/readiness.ts");
  const card = readJson(".well-known/mcp/server-card.json");
  assert.ok(card.serverInfo.name && card.serverInfo.version);
  assert.equal(card.endpoint, "https://stack.perkos.xyz/mcp");
  assert.ok(card.capabilities.tools);
  assert.deepEqual(card.tools.map((t) => t.name).sort(), MCP_TOOLS.map((t) => t.name).sort());
  for (const t of MCP_TOOLS) assert.equal(t.inputSchema.type, "object");
});

test("openapi.json is OpenAPI 3.1 and documents the facilitator and agent endpoints", () => {
  const spec = readJson("openapi.json");
  assert.equal(spec.openapi, "3.1.0");
  for (const p of ["/api/v2/x402/supported", "/api/v2/x402/verify", "/api/v2/x402/settle", "/api/v2/agents/register", "/api/v2/agents/keys/rotate", "/api/v2/agents/onboard", "/api/v2/agents/discovery", "/mcp"]) {
    assert.ok(spec.paths[p], `missing path ${p}`);
  }
});

test("robots.txt carries Content-Signal, an Agentmap and the sitemap", () => {
  const robots = fs.readFileSync(path.join(PUBLIC, "robots.txt"), "utf8");
  assert.match(robots, /^Content-Signal: search=yes, ai-input=yes, ai-train=no$/m);
  assert.match(robots, /^Agentmap: https:\/\/stack\.perkos\.xyz\/\.well-known\/ai-catalog\.json$/m);
  assert.match(robots, /^Sitemap: https:\/\/stack\.perkos\.xyz\/sitemap\.xml$/m);
  assert.match(robots, /^User-agent: GPTBot\nAllow: \/$/m);
});

test("WebMCP inline script parses and registers every advertised tool", async () => {
  const { WEBMCP_SCRIPT, WEBMCP_TOOL_NAMES } = await import("../lib/agents/webmcp.ts");
  new Function(WEBMCP_SCRIPT); // syntax check only
  const registered = [];
  const nav = { modelContext: { registerTool: (t, o) => { registered.push(t); assert.ok(o.signal); } } };
  new Function("navigator", "window", "fetch", WEBMCP_SCRIPT)(nav, { addEventListener() {}, location: { assign() {} } }, async () => new Response("ok"));
  assert.deepEqual(registered.map((t) => t.name), [...WEBMCP_TOOL_NAMES]);
  for (const t of registered) {
    assert.ok(t.description.length > 20);
    assert.equal(t.inputSchema.type, "object");
    assert.equal(typeof t.execute, "function");
  }
  const r = await registered[1].execute({});
  assert.equal(r.content[0].text, "ok");
});

test("auth.md is self-contained per the Auth.md guidance", () => {
  const md = fs.readFileSync(path.join(PUBLIC, "auth.md"), "utf8");
  assert.match(md, /^# auth\.md/);
  assert.match(md, /## Identity types supported/);
  assert.match(md, /\/api\/v2\/agents\/register/);
  assert.match(md, /\/api\/v2\/agents\/keys\/rotate/);
});
