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

// x402 version: accept protocol-native numbers and stringified numbers from clients
export const x402Version = z
  .coerce.number()
  .int("x402Version must be an integer")
  .refine((value) => value === 1 || value === 2, "x402Version must be 1 or 2");

// Payment payload base structure
export const paymentPayload = z.object({
  x402Version: x402Version,
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

// Coupon validation request schema (POST /api/coupons/validate)
export const couponValidateSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  address: z.string().min(1, "Wallet address is required"),
  tier: z.string().min(1, "Subscription tier is required"),
  amount: z.coerce.number().nonnegative("Valid amount is required"),
});

// Subscription x402 payment schema (POST /api/subscription/pay/x402)
// Lenient on the nested x402 payload (passthrough) — the route + X402Service
// verify it cryptographically; this only enforces the request shape/types so
// malformed bodies are rejected before any payment logic runs.
export const subscriptionPayX402Schema = z.object({
  userWalletAddress: z.string().min(1, "userWalletAddress is required"),
  tier: z.string().min(1, "tier is required"),
  // @ts-expect-error zod enum typing
  billingCycle: z.enum(["monthly", "yearly"], {
    errorMap: () => ({ message: "billingCycle must be 'monthly' or 'yearly'" }),
  }),
  network: z.string().min(1, "network is required"),
  paymentPayload: z
    .object({
      payload: z
        .object({
          authorization: z
            .object({
              from: z.string().min(1, "authorization.from is required"),
              to: z.string().min(1, "authorization.to is required"),
              value: z.union([z.string(), z.number()]),
            })
            .passthrough(),
        })
        .passthrough(),
    })
    .passthrough(),
  coupon: z.object({}).passthrough().nullable().optional(),
});

// Deferred batch settlement request (POST /api/deferred/settle-batch)
export const deferredSettleBatchSchema = z.object({
  buyer: z.string().min(1, "buyer is required"),
  seller: z.string().min(1, "seller is required"),
  network: z.string().optional(),
});

// Deferred voucher storage (POST /api/deferred/vouchers)
// Lenient — the deferred scheme verifies the voucher signature cryptographically;
// this only enforces the request shape so malformed payloads are rejected early.
export const deferredVoucherSchema = z
  .object({
    voucher: z
      .object({
        id: z.string().min(1, "voucher.id is required"),
        buyer: z.string().min(1, "voucher.buyer is required"),
        seller: z.string().min(1, "voucher.seller is required"),
        asset: z.string().min(1, "voucher.asset is required"),
        nonce: z.union([z.string(), z.number()]),
        valueAggregate: z.union([z.string(), z.number()]),
      })
      .passthrough(),
    signature: z.string().min(1, "signature is required"),
  })
  .passthrough();

// Admin coupon fields shared by create/update. zod strips unknown keys by
// default, so using these schemas (instead of spreading the raw body) prevents
// mass-assignment of arbitrary fields into the coupon record.
const couponFields = {
  code: z.string().min(1, "code is required"),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.coerce.number().nonnegative("discount_value must be >= 0"),
  starts_at: z.string().min(1, "starts_at is required"),
  expires_at: z.string().min(1, "expires_at is required"),
  description: z.string().optional(),
  assigned_wallet: z.string().nullable().optional(),
  max_redemptions: z.coerce.number().optional(),
  applicable_tiers: z.array(z.string()).nullable().optional(),
  min_amount: z.coerce.number().optional(),
  enabled: z.boolean().optional(),
};

// POST /api/admin/coupons
export const couponCreateSchema = z.object(couponFields);

// PUT /api/admin/coupons/[id] — every field optional (partial update)
export const couponUpdateSchema = z.object({
  ...couponFields,
  code: couponFields.code.optional(),
  discount_type: couponFields.discount_type.optional(),
  discount_value: couponFields.discount_value.optional(),
  starts_at: couponFields.starts_at.optional(),
  expires_at: couponFields.expires_at.optional(),
});

// User profile upsert (POST /api/profile). Validates types/enum so malformed
// input is rejected with a clean 400 instead of a 500 from `.trim()` on a
// non-string. The route maps fields explicitly (no mass-assignment) and keeps
// its own website-URL + handle sanitization.
const profileHandle = z.string().max(120).nullable().optional();
export const profileUpsertSchema = z.object({
  walletAddress: z.string().min(1, "walletAddress is required"),
  accountType: z
    .enum(["personal", "community", "organization", "vendor"])
    .optional(),
  displayName: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  twitterHandle: profileHandle,
  githubHandle: profileHandle,
  discordHandle: profileHandle,
  farcasterHandle: profileHandle,
  telegramHandle: profileHandle,
  instagramHandle: profileHandle,
  tiktokHandle: profileHandle,
  twitchHandle: profileHandle,
  kickHandle: profileHandle,
  companyName: z.string().max(200).nullable().optional(),
  companyRegistrationNumber: z.string().max(120).nullable().optional(),
  isPublic: z.boolean().optional(),
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
