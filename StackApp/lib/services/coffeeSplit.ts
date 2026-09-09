/**
 * CoffeeSplit support for the exact scheme (PerkOS Buy A Coffee).
 *
 * A coffee is an `exact` payment whose `payTo` is the CoffeeSplit contract and
 * whose requirements carry `extra.split`. The donor signs an EIP-3009
 * `ReceiveWithAuthorization` (not `TransferWithAuthorization`) with
 * `to = CoffeeSplit` and `nonce = coffeeNonce(creator, coffeeId)`; the
 * facilitator's sponsor wallet then calls `CoffeeSplit.settle(...)`, which
 * pulls the USDC and pays creator + treasury in one transaction.
 *
 * Everything here is pure (no DB, no network) so it can be unit-tested and so
 * the sponsor wallet only ever calls a contract address from the allowlist
 * below, never one supplied by the caller.
 */
import { encodeFunctionData, encodePacked, keccak256, isAddress, isHex, type Address, type Hex } from "viem";
import type { PaymentRequirements } from "../types/x402";

export const COFFEE_SPLIT_ABI = [
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "creator", type: "address" },
      { name: "coffeeId", type: "bytes32" },
      { name: "memoHash", type: "bytes32" },
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "v", type: "uint8" },
          { name: "r", type: "bytes32" },
          { name: "s", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "fee", type: "uint256" }],
  },
] as const;

export const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Networks where CoffeeSplit is deployed. Address comes from env; never from the request. */
const ENV_KEYS: Record<string, string> = {
  "base-sepolia": "COFFEE_SPLIT_ADDRESS_BASE_SEPOLIA",
  base: "COFFEE_SPLIT_ADDRESS_BASE",
};

export function getCoffeeSplitAddress(network: string, env: NodeJS.ProcessEnv = process.env): Address | null {
  const key = ENV_KEYS[network];
  if (!key) return null;
  const value = env[key];
  return value && isAddress(value, { strict: false }) ? (value as Address) : null;
}

/** Mirrors `CoffeeSplit.coffeeNonce`: keccak256(abi.encodePacked("PerkOS.Coffee.v1", creator, coffeeId)). */
export function coffeeNonce(creator: Address, coffeeId: Hex): Hex {
  return keccak256(
    encodePacked(["string", "address", "bytes32"], ["PerkOS.Coffee.v1", creator.toLowerCase() as Address, coffeeId]),
  );
}

export interface SplitExtra {
  contract: Address;
  creator: Address;
  coffeeId: Hex;
  memoHash: Hex;
}

export type SplitParse = { split: SplitExtra } | { split: null; error?: string };

const ZERO32 = `0x${"0".repeat(64)}` as Hex;

/**
 * Read and validate `requirements.extra.split`. Returns `{ split: null }` when
 * the requirements are a plain exact payment (no split), and an error when a
 * split is requested but malformed or not allowed on this network.
 */
export function parseSplitExtra(
  requirements: PaymentRequirements,
  network: string,
  env: NodeJS.ProcessEnv = process.env,
): SplitParse {
  const extra = (requirements as { extra?: Record<string, unknown> | null }).extra;
  const raw = extra && typeof extra === "object" ? (extra as Record<string, unknown>).split : undefined;
  if (raw === undefined || raw === null) return { split: null };
  if (typeof raw !== "object") return { split: null, error: "extra.split must be an object" };

  const s = raw as Record<string, unknown>;
  const allowed = getCoffeeSplitAddress(network, env);
  if (!allowed) return { split: null, error: `CoffeeSplit is not available on ${network}` };

  const contract = typeof s.contract === "string" ? s.contract : "";
  if (!isAddress(contract, { strict: false }) || contract.toLowerCase() !== allowed.toLowerCase()) {
    return { split: null, error: "extra.split.contract is not the CoffeeSplit contract for this network" };
  }
  if (requirements.payTo.toLowerCase() !== allowed.toLowerCase()) {
    return { split: null, error: "payTo must be the CoffeeSplit contract for a split payment" };
  }
  const creator = typeof s.creator === "string" ? s.creator : "";
  if (!isAddress(creator, { strict: false }) || creator.toLowerCase() === allowed.toLowerCase()) {
    return { split: null, error: "extra.split.creator must be a valid address" };
  }
  const coffeeId = typeof s.coffeeId === "string" ? s.coffeeId : "";
  if (!isHex(coffeeId) || coffeeId.length !== 66) return { split: null, error: "extra.split.coffeeId must be bytes32" };
  const memoHashRaw = typeof s.memoHash === "string" && s.memoHash ? s.memoHash : ZERO32;
  if (!isHex(memoHashRaw) || memoHashRaw.length !== 66) return { split: null, error: "extra.split.memoHash must be bytes32" };

  return {
    split: {
      contract: allowed,
      creator: creator as Address,
      coffeeId: coffeeId as Hex,
      memoHash: memoHashRaw as Hex,
    },
  };
}

/** Calldata for `CoffeeSplit.settle(creator, coffeeId, memoHash, auth)`. */
export function encodeCoffeeSettle(params: {
  split: SplitExtra;
  from: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  v: number;
  r: Hex;
  s: Hex;
}): Hex {
  return encodeFunctionData({
    abi: COFFEE_SPLIT_ABI,
    functionName: "settle",
    args: [
      params.split.creator,
      params.split.coffeeId,
      params.split.memoHash,
      {
        from: params.from,
        value: params.value,
        validAfter: params.validAfter,
        validBefore: params.validBefore,
        v: params.v,
        r: params.r,
        s: params.s,
      },
    ],
  });
}
