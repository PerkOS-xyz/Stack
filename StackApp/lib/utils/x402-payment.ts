/**
 * x402 Payment Utilities for EIP-712 signing
 *
 * Implements EIP-3009 TransferWithAuthorization for USDC payments
 */

import { type Address, parseUnits, keccak256, toHex, concat, pad } from "viem";
import { getChainIdFromNetwork, getUSDCAddress, type SupportedNetwork } from "./chains";

// EIP-712 types for TransferWithAuthorization (EIP-3009)
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// USDC token names by chain ID (for EIP-712 domain)
const USDC_TOKEN_NAMES: Record<number, string> = {
  // Mainnets
  8453: "USD Coin",      // Base
  43114: "USD Coin",     // Avalanche
  42220: "Celo Dollar",  // Celo
  137: "USD Coin",       // Polygon
  42161: "USD Coin",     // Arbitrum
  10: "USD Coin",        // Optimism
  1: "USD Coin",         // Ethereum
  // Testnets
  84532: "USD Coin",     // Base Sepolia
  43113: "USD Coin",     // Avalanche Fuji
};

// EIP-3009 version (most USDC implementations use "2")
const EIP3009_VERSION = "2";

/**
 * Payment requirements from x402 protocol
 */
export interface PaymentRequirements {
  scheme: "exact" | "deferred";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset: string;
  extra?: {
    name?: string;
    version?: string;
  };
}

/**
 * Payment envelope containing signed authorization
 */
export interface PaymentEnvelope {
  network: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    nonce: string;
    validAfter: string;
    validBefore: string;
  };
  signature: string;
}

/**
 * Generate a random nonce for EIP-3009
 * Returns a bytes32 hex string
 */
export function generateNonce(): `0x${string}` {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return toHex(randomBytes) as `0x${string}`;
}

/**
 * Create EIP-712 domain for USDC TransferWithAuthorization
 */
export function createEIP712Domain(
  network: SupportedNetwork,
  usdcAddress?: Address,
  tokenName?: string
): {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
} {
  const chainId = getChainIdFromNetwork(network);
  if (!chainId) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const address = usdcAddress || (getUSDCAddress(chainId) as Address);
  if (!address) {
    throw new Error(`USDC address not found for network: ${network}`);
  }

  // Use provided token name, or look up from chain ID, or default
  const name = tokenName || USDC_TOKEN_NAMES[chainId] || "USD Coin";

  return {
    name,
    version: EIP3009_VERSION,
    chainId,
    verifyingContract: address,
  };
}

/**
 * Parse price string to USDC atomic units (6 decimals)
 * "$29.00" -> BigInt(29000000)
 */
export function parsePriceToUSDC(price: string | number): bigint {
  // Handle numeric input
  if (typeof price === "number") {
    return parseUnits(price.toString(), 6);
  }

  // Remove currency symbol and parse
  const numericPrice = price.replace(/[$,]/g, "").trim();
  return parseUnits(numericPrice, 6);
}

/**
 * Get valid before timestamp (1 hour from now)
 */
export function getValidBefore(): bigint {
  const now = Math.floor(Date.now() / 1000);
  return BigInt(now + 3600); // 1 hour validity
}

/**
 * Get valid after timestamp (0 = immediately valid)
 */
export function getValidAfter(): bigint {
  return BigInt(0);
}

/**
 * Format payment envelope for x402 v2 protocol
 */
export function formatPaymentPayload(envelope: PaymentEnvelope) {
  return {
    x402Version: 2,
    scheme: "exact",
    network: envelope.network,
    payload: envelope,
  };
}

/**
 * Encode payment payload to base64 for header
 */
export function encodePaymentHeader(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decode payment header from base64
 */
export function decodePaymentHeader(header: string): object {
  return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
}
