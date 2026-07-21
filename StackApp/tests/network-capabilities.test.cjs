const assert = require("node:assert/strict");
const test = require("node:test");
const {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  stringToHex,
} = require("viem");
const capabilities = require("../lib/utils/network-capabilities.json");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function domainSeparator({ tokenName, tokenVersion, chainId, asset }) {
  const typeHash = keccak256(
    stringToHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
  );
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, bytes32, bytes32, uint256, address"),
      [
        typeHash,
        keccak256(stringToHex(tokenName)),
        keccak256(stringToHex(tokenVersion)),
        BigInt(chainId),
        asset,
      ]
    )
  );
}

test("x402 catalog has unique, non-zero payment rails", () => {
  assert.equal(capabilities.length, 18);
  assert.equal(new Set(capabilities.map((entry) => entry.network)).size, capabilities.length);
  assert.equal(new Set(capabilities.map((entry) => entry.chainId)).size, capabilities.length);
  assert.equal(capabilities.filter((entry) => entry.erc8004Identity).length, 15);
  for (const entry of capabilities) {
    assert.match(entry.asset, /^0x[a-fA-F0-9]{40}$/);
    assert.notEqual(entry.asset.toLowerCase(), ZERO_ADDRESS);
  }
});

test("Unichain domains match the contracts verified on-chain", () => {
  const expected = new Map([
    [130, "0x565b4c4095d739dada6adeb9a89bc6dc4d102500ebd4a88bef1ec1d0f69d83b8"],
    [1301, "0x2a1fda83efdd0b06cf1a15e7ee9aa85aa7a1612ae5af0c599ecc6609e6afafa1"],
  ]);
  for (const chainId of expected.keys()) {
    const entry = capabilities.find((candidate) => candidate.chainId === chainId);
    assert.ok(entry);
    assert.equal(entry.tokenName, "USDC");
    assert.equal(entry.tokenVersion, "2");
    assert.equal(domainSeparator(entry), expected.get(chainId));
  }
});

test("Robinhood retains its USDG signing domain", () => {
  const robinhood = capabilities.find((entry) => entry.network === "robinhood");
  assert.ok(robinhood);
  assert.equal(robinhood.symbol, "USDG");
  assert.equal(robinhood.tokenName, "Global Dollar");
  assert.equal(robinhood.tokenVersion, "1");
  assert.equal(robinhood.erc8004Identity, false);
});
