/**
 * x402 Subscription Payment Configuration
 *
 * Configures x402 protocol settings for subscription payments.
 * Payments go to TREASURY_WALLET environment variable.
 */

import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "./subscriptions";
import { getUSDCAddress, getChainIdFromNetwork, type SupportedNetwork } from "@/lib/utils/chains";
import { networkToCAIP2 } from "@/lib/utils/x402-headers";

// Payment recipient (treasury wallet)
const TREASURY_ADDRESS = process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET;

// Facilitator URL (self, or external facilitator)
const FACILITATOR_URL = process.env.FACILITATOR_URL || process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://stack.perkos.xyz";

// Default network for subscription payments
const DEFAULT_NETWORK = (process.env.NEXT_PUBLIC_SUBSCRIPTION_NETWORK || "base") as SupportedNetwork;

if (!TREASURY_ADDRESS) {
  console.warn("⚠️ TREASURY_WALLET not set. Subscription payments will fail.");
}

export interface SubscriptionPaymentConfig {
  payTo: `0x${string}`;
  facilitatorUrl: string;
  network: SupportedNetwork;
}

export const subscriptionPaymentConfig: SubscriptionPaymentConfig = {
  payTo: (TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  facilitatorUrl: FACILITATOR_URL,
  network: DEFAULT_NETWORK,
};

/**
 * Get subscription tier price in USD
 */
export function getTierPriceUsd(tier: SubscriptionTier, yearly: boolean = false): number {
  const config = SUBSCRIPTION_TIERS[tier];
  if (!config) return 0;
  return yearly ? config.priceYearly : config.priceMonthly;
}

/**
 * Get subscription tier price in USDC atomic units (6 decimals)
 * $29 = 29_000_000 atomic units
 */
export function getTierPriceAtomicUnits(tier: SubscriptionTier, yearly: boolean = false): string {
  const priceUsd = getTierPriceUsd(tier, yearly);
  // USDC has 6 decimals, so multiply by 1_000_000
  const atomicUnits = Math.floor(priceUsd * 1_000_000);
  return atomicUnits.toString();
}

/**
 * Build x402 payment requirements for subscription upgrade
 */
export function buildSubscriptionPaymentRequirements(
  tier: SubscriptionTier,
  yearly: boolean = false,
  network?: SupportedNetwork
) {
  const targetNetwork = network || subscriptionPaymentConfig.network;
  const priceAtomicUnits = getTierPriceAtomicUnits(tier, yearly);
  const priceUsd = getTierPriceUsd(tier, yearly);
  const chainId = getChainIdFromNetwork(targetNetwork);
  const usdcAddress = chainId ? getUSDCAddress(chainId) : undefined;
  const tierConfig = SUBSCRIPTION_TIERS[tier];

  return {
    scheme: "exact" as const,
    network: networkToCAIP2(targetNetwork),
    maxAmountRequired: priceAtomicUnits,
    resource: `/api/subscription/pay`,
    description: `${tierConfig.displayName} subscription - ${yearly ? "Yearly" : "Monthly"} ($${priceUsd})`,
    mimeType: "application/json",
    payTo: subscriptionPaymentConfig.payTo,
    maxTimeoutSeconds: 60, // Allow more time for subscription payments
    asset: usdcAddress,
    extra: {
      name: "USD Coin",
      version: "2",
      tier,
      yearly,
    },
  };
}

/**
 * Supported networks for subscription payments
 */
export const SUBSCRIPTION_SUPPORTED_NETWORKS: SupportedNetwork[] = [
  "base",
  "base-sepolia",
  "avalanche",
  "avalanche-fuji",
];
