import { isAddress } from "viem";
import { z } from "zod";

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_OPT_PARAMS_BYTES = 32 * 1024;

export const uint256 = z.union([
  z.string()
    .max(78)
    .regex(/^(0|[1-9]\d*)$/)
    .refine((value) => BigInt(value) <= MAX_UINT256, "Value exceeds uint256"),
  z.number().int().nonnegative().safe(),
]);

export const evmAddress = z.string().refine(isAddress, "Invalid address");
export const boundedBytes = z.string()
  .regex(/^0x(?:[a-fA-F0-9]{2})*$/)
  .refine(
    (value) => (value.length - 2) / 2 <= MAX_OPT_PARAMS_BYTES,
    `Bytes payload exceeds ${MAX_OPT_PARAMS_BYTES} bytes`,
  );
export const bytes32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
