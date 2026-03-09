import { z } from "zod";

/**
 * Common validation schemas for API input validation.
 */

// Ethereum address: 0x followed by 40 hex characters
export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

// Supported EVM and non-EVM network identifiers
const SUPPORTED_NETWORKS = [
  "avalanche", "avalanche-fuji",
  "celo", "celo-sepolia",
  "base", "base-sepolia",
  "ethereum", "sepolia",
  "polygon", "polygon-amoy",
  "monad", "monad-testnet",
  "arbitrum", "arbitrum-sepolia",
  "optimism", "optimism-sepolia",
  "unichain", "unichain-sepolia",
  "bsc", "bsc-testnet",
  "linea", "linea-sepolia",
  "gnosis", "gnosis-chiado",
  "mantle", "mantle-sepolia",
  "metis", "metis-sepolia",
  "megaeth", "megaeth-testnet",
  "abstract", "abstract-testnet",
  "goat", "goat-testnet",
  "solana", "solana-devnet",
] as const;

// @ts-expect-error zod enum typing
export const networkParam = z.enum(SUPPORTED_NETWORKS, {
  errorMap: () => ({ message: `Invalid network. Must be one of: ${SUPPORTED_NETWORKS.join(", ")}` }),
});

// Agent ID: positive integer string
export const agentId = z
  .string()
  .regex(/^[1-9]\d*$/, "Agent ID must be a positive integer string");

// Amount: positive number string (allows decimals)
export const amount = z
  .string()
  .refine(
    (val) => {
      if (val === "max") return true;
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Amount must be a positive number or 'max'" }
  );

// Wallet ID: non-empty string
export const walletId = z
  .string()
  .min(1, "Wallet ID must not be empty");

// x402 version string
export const x402Version = z
  .string()
  .min(1, "x402Version is required");

// Payment payload base structure
export const paymentPayload = z.object({
  network: z.string().min(1, "paymentPayload.network is required"),
  scheme: z.string().min(1, "paymentPayload.scheme is required"),
  payload: z.unknown().optional(),
});

// Payment requirements base structure
export const paymentRequirements = z.object({
  network: z.string().optional(),
  payTo: z.string().optional(),
  maxAmountRequired: z.unknown().optional(),
  asset: z.string().optional(),
  resource: z.unknown().optional(),
}).passthrough();

// Send transaction request schema
export const sendTransactionSchema = z.object({
  walletId: walletId,
  toAddress: ethereumAddress,
  amount: amount,
  network: z.string().min(1, "Network is required"),
  isSendMax: z.boolean().optional(),
});

// Solana send request schema
export const solanaSendSchema = z.object({
  walletId: walletId,
  toAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format"),
  amount: amount,
  // @ts-expect-error zod enum typing
  network: z.enum(["solana", "solana-devnet"], {
    errorMap: () => ({ message: "Network must be 'solana' or 'solana-devnet'" }),
  }),
  isSendMax: z.boolean().optional(),
});

// x402 verify/settle request schema
export const x402RequestSchema = z.object({
  x402Version: x402Version,
  paymentPayload: paymentPayload,
  paymentRequirements: paymentRequirements,
});

// Subscription payment schema
export const subscriptionPaySchema = z.object({
  userWalletAddress: z.string().min(1, "userWalletAddress is required"),
  tier: z.string().min(1, "tier is required"),
  // @ts-expect-error zod enum typing
  billingCycle: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "billingCycle must be 'monthly' or 'yearly'" }),
  }),
  network: z.string().min(1, "network is required"),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format"),
});

/**
 * Helper to validate request body against a schema.
 * Returns parsed data or a NextResponse with 400 status.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((e: any) => e.message).join("; ");
    return { success: false, error: messages };
  }
  return { success: true, data: result.data };
}
