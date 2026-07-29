const assert = require("node:assert/strict");
const test = require("node:test");

async function loadSchemes() {
  return import("../lib/utils/x402-schemes.ts");
}

test("canonical identifiers are the advertised ones", async () => {
  const { SCHEME_EXACT, SCHEME_DEFERRED, SCHEME_DEFERRED_LEGACY } = await loadSchemes();

  assert.equal(SCHEME_EXACT, "exact");
  // Vendor-prefixed: the bare `deferred` name belongs to the x402 TSC namespace.
  assert.equal(SCHEME_DEFERRED, "perkos-deferred");
  assert.equal(SCHEME_DEFERRED_LEGACY, "deferred");
});

test("canonicalizeScheme accepts the legacy deferred name", async () => {
  const { canonicalizeScheme } = await loadSchemes();

  assert.equal(canonicalizeScheme("exact"), "exact");
  assert.equal(canonicalizeScheme("perkos-deferred"), "perkos-deferred");
  // The whole point of the alias: old clients keep working.
  assert.equal(canonicalizeScheme("deferred"), "perkos-deferred");
});

test("canonicalizeScheme fails closed on unknown schemes", async () => {
  const { canonicalizeScheme } = await loadSchemes();

  for (const value of ["upto", "batch", "", "EXACT", null, undefined, 42, {}]) {
    assert.equal(
      canonicalizeScheme(value),
      null,
      `expected ${JSON.stringify(value)} to be rejected`
    );
  }
});

test("isLegacyDeferred only flags the deprecated spelling", async () => {
  const { isLegacyDeferred } = await loadSchemes();

  assert.equal(isLegacyDeferred("deferred"), true);
  assert.equal(isLegacyDeferred("perkos-deferred"), false);
  assert.equal(isLegacyDeferred("exact"), false);
});

test("schemeFilterValues matches the whole deferred family", async () => {
  const { schemeFilterValues } = await loadSchemes();

  // Rows written before the rename are stored as `deferred`; a filter that
  // matched only one spelling would silently hide history.
  const fromCanonical = schemeFilterValues("perkos-deferred");
  const fromLegacy = schemeFilterValues("deferred");

  for (const values of [fromCanonical, fromLegacy]) {
    assert.deepEqual([...values].sort(), ["deferred", "perkos-deferred"]);
  }

  assert.deepEqual(schemeFilterValues("exact"), ["exact"]);
});
