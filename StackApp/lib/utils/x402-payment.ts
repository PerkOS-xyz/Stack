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
// Most Circle native USDC uses "USD Coin", but Celo native USDC returns "USDC"
// IMPORTANT: This must match the actual name() value returned by the contract
const USDC_TOKEN_NAMES: Record<number, string> = {
  // Mainnets
  8453: "USD Coin",      // Base
  43114: "USD Coin",     // Avalanche
  42220: "USDC",         // Celo (native USDC returns "USDC" from name())
  137: "USD Coin",       // Polygon
  42161: "USD Coin",     // Arbitrum
  10: "USD Coin",        // Optimism
  1: "USD Coin",         // Ethereum
  // Testnets
  84532: "USD Coin",     // Base Sepolia
  43113: "USD Coin",     // Avalanche Fuji
  44787: "USDC",         // Celo Alfajores (testnet)
};

// EIP-712 domain versions by chain ID
// All Circle native USDC implementations use version "2"
// Verified by querying contract.version() on-chain
const EIP712_DOMAIN_VERSIONS: Record<number, string> = {
  // Mainnets
  1: "2",      // Ethereum
  8453: "2",   // Base
  43114: "2",  // Avalanche
  42220: "2",  // Celo (verified: contract.version() returns "2")
  137: "2",    // Polygon
  42161: "2",  // Arbitrum
  10: "2",     // Optimism
  // Testnets
  84532: "2",  // Base Sepolia
  43113: "2",  // Avalanche Fuji
  44787: "2",  // Celo Alfajores (assuming same as mainnet)
};

/**
 * Get EIP-712 domain version for a chain
 * All Circle native USDC uses version "2" (verified on-chain)
 */
export function getEIP712Version(chainId: number): string {
  return EIP712_DOMAIN_VERSIONS[chainId] || "2";
}

/**
 * Get USDC token name for EIP-712 domain by chain ID
 * Celo native USDC returns "USDC" from name(), others return "USD Coin"
 */
export function getTokenName(chainId: number): string {
  return USDC_TOKEN_NAMES[chainId] || "USD Coin";
}

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
    version: getEIP712Version(chainId),
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
