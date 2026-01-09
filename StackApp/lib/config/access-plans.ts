/**
 * Stack Access Plans Configuration
 *
 * Defines the pricing tiers for Stack users.
 * x402 Facilitator API for developers
 *
 * API Endpoints Included:
 * - Payment Verify: /v2/x402/verify
 * - Payment Settle: /v2/x402/settle
 * - Dynamic Pricing: /v2/pricing/*
 * - Agent Registry: /v2/agents/*
 *
 * Note: L2 transaction fees paid by users • ~80% gross margin
 *
 * Environment Variables for Testing:
 * - STACK_FREE_TX_LIMIT: Monthly transaction limit for free tier (default: 1000)
 * - STACK_STARTER_TX_LIMIT: Monthly transaction limit for starter tier (default: 50000)
 * - STACK_PRO_TX_LIMIT: Monthly transaction limit for pro tier (default: 500000)
 * - STACK_SCALE_TX_LIMIT: Monthly transaction limit for scale tier (default: 5000000)
 * - STACK_FREE_RATE_LIMIT: Requests per minute for free tier (default: 10)
 * - STACK_STARTER_RATE_LIMIT: Requests per minute for starter tier (default: 60)
 * - STACK_PRO_RATE_LIMIT: Requests per minute for pro tier (default: 300)
 * - STACK_SCALE_RATE_LIMIT: Requests per minute for scale tier (default: 1000)
 * - STACK_ENTERPRISE_RATE_LIMIT: Requests per minute for enterprise tier (default: 5000)
 */

import type { Address } from "@/lib/types/x402";

// ============ Environment Variable Helpers ============

/**
 * Get transaction limit from env var with fallback
 */
function getEnvTxLimit(envVar: string, defaultValue: number): number {
  const value = process.env[envVar];
  if (value) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultValue;
}

/**
 * Transaction limits (configurable via env vars for testing)
 */
const TX_LIMITS = {
  free: getEnvTxLimit("STACK_FREE_TX_LIMIT", 1000),
  starter: getEnvTxLimit("STACK_STARTER_TX_LIMIT", 50000),
  pro: getEnvTxLimit("STACK_PRO_TX_LIMIT", 500000),
  scale: getEnvTxLimit("STACK_SCALE_TX_LIMIT", 5000000),
  enterprise: -1, // Unlimited
} as const;

/**
 * Rate limits in requests per minute (configurable via env vars)
 */
const RATE_LIMITS = {
  free: getEnvTxLimit("STACK_FREE_RATE_LIMIT", 10),
  starter: getEnvTxLimit("STACK_STARTER_RATE_LIMIT", 60),
  pro: getEnvTxLimit("STACK_PRO_RATE_LIMIT", 300),
  scale: getEnvTxLimit("STACK_SCALE_RATE_LIMIT", 1000),
  enterprise: getEnvTxLimit("STACK_ENTERPRISE_RATE_LIMIT", 5000),
} as const;

/**
 * API Endpoints included in all plans
 */
export const STACK_API_ENDPOINTS = {
  paymentVerify: "/v2/x402/verify",
  paymentSettle: "/v2/x402/settle",
  dynamicPricing: "/v2/pricing/*",
  agentRegistry: "/v2/agents/*",
} as const;

/**
 * Plan identifiers
 */
export type PlanId = "free" | "starter" | "pro" | "scale" | "enterprise";

/**
 * Access Plan definition
 */
export interface AccessPlan {
  /** Unique plan identifier */
  id: PlanId;

  /** Display name */
  name: string;

  /** Plan description */
  description: string;

  /** Monthly price in USD (as string for precision) */
  priceUsd: string;

  /** Monthly price in USDC atomic units (6 decimals) */
  priceAtomicUnits: string;

  /** API calls per month (-1 for unlimited) */
  monthlyApiCalls: number;

  /** Number of networks accessible */
  networkLimit: number;

  /** Allowed networks (empty array means all) */
  allowedNetworks: string[];

  /** Priority routing enabled */
  priorityRouting: boolean;

  /** Dedicated infrastructure */
  dedicatedInfra: boolean;

  /** SLA guarantee (99.9%, 99.99%, etc.) */
  slaGuarantee: string | null;

  /** Custom support level */
  supportLevel: "community" | "email" | "priority" | "dedicated";

  /** Features list for display */
  features: string[];

  /** Is this plan currently available */
  isActive: boolean;

  /** Display order (lower = first) */
  displayOrder: number;
}

/**
 * Stack Access Plans
 *
 * Pricing tiers from PerkOS:
 * - Free: $0/mo, 1K calls, 1 network
 * - Starter: $5/mo, 50K calls, 3 networks
 * - Pro: $49/mo, 500K calls, all networks
 * - Scale: $299/mo, 5M calls, all networks + priority
 * - Enterprise: Custom, unlimited, all networks + SLA
 */
export const ACCESS_PLANS: Record<PlanId, AccessPlan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Perfect for testing and small projects",
    priceUsd: "0",
    priceAtomicUnits: "0",
    monthlyApiCalls: TX_LIMITS.free,
    networkLimit: 1,
    allowedNetworks: ["base-sepolia"], // Testnet only for free tier
    priorityRouting: false,
    dedicatedInfra: false,
    slaGuarantee: null,
    supportLevel: "community",
    features: [
      "1,000 API calls/month",
      "1 testnet network",
      "Community support",
      "Standard rate limits",
      "Basic analytics",
    ],
    isActive: true,
    displayOrder: 0,
  },

  starter: {
    id: "starter",
    name: "Starter",
    description: "For growing projects and startups",
    priceUsd: "5",
    priceAtomicUnits: "5000000", // 5 USDC
    monthlyApiCalls: TX_LIMITS.starter,
    networkLimit: 3,
    allowedNetworks: ["base-sepolia", "base", "avalanche-fuji"],
    priorityRouting: false,
    dedicatedInfra: false,
    slaGuarantee: null,
    supportLevel: "email",
    features: [
      "50,000 API calls/month",
      "3 networks (1 mainnet + 2 testnets)",
      "Email support",
      "Enhanced rate limits",
      "Full analytics dashboard",
      "Webhook notifications",
    ],
    isActive: true,
    displayOrder: 1,
  },

  pro: {
    id: "pro",
    name: "Pro",
    description: "For production applications",
    priceUsd: "49",
    priceAtomicUnits: "49000000", // 49 USDC
    monthlyApiCalls: TX_LIMITS.pro,
    networkLimit: -1, // Unlimited
    allowedNetworks: [], // All networks
    priorityRouting: false,
    dedicatedInfra: false,
    slaGuarantee: "99.9%",
    supportLevel: "priority",
    features: [
      "500,000 API calls/month",
      "All supported networks",
      "Priority support",
      "99.9% SLA guarantee",
      "Advanced analytics & reporting",
      "Custom webhook configurations",
      "API key management",
    ],
    isActive: true,
    displayOrder: 2,
  },

  scale: {
    id: "scale",
    name: "Scale",
    description: "For high-volume applications",
    priceUsd: "299",
    priceAtomicUnits: "299000000", // 299 USDC
    monthlyApiCalls: TX_LIMITS.scale,
    networkLimit: -1,
    allowedNetworks: [],
    priorityRouting: true,
    dedicatedInfra: false,
    slaGuarantee: "99.95%",
    supportLevel: "priority",
    features: [
      "5,000,000 API calls/month",
      "All supported networks",
      "Priority routing",
      "99.95% SLA guarantee",
      "Dedicated support channel",
      "Custom integrations",
      "Volume discounts available",
      "Multi-team management",
    ],
    isActive: true,
    displayOrder: 3,
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for enterprise needs",
    priceUsd: "custom",
    priceAtomicUnits: "0", // Custom pricing
    monthlyApiCalls: TX_LIMITS.enterprise, // Unlimited
    networkLimit: -1,
    allowedNetworks: [],
    priorityRouting: true,
    dedicatedInfra: true,
    slaGuarantee: "99.99%",
    supportLevel: "dedicated",
    features: [
      "Unlimited API calls",
      "All supported networks",
      "Dedicated infrastructure",
      "99.99% SLA guarantee",
      "Dedicated account manager",
      "Custom contract terms",
      "On-premise deployment option",
      "24/7 phone support",
      "Custom feature development",
    ],
    isActive: true,
    displayOrder: 4,
  },
};

/**
 * Get plan by ID
 */
export function getPlan(planId: PlanId): AccessPlan {
  return ACCESS_PLANS[planId];
}

/**
 * Get all active plans
 */
export function getActivePlans(): AccessPlan[] {
  return Object.values(ACCESS_PLANS)
    .filter((plan) => plan.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get plan price in display format
 */
export function getPlanPriceDisplay(planId: PlanId): string {
  const plan = ACCESS_PLANS[planId];
  if (plan.priceUsd === "custom") return "Contact Us";
  if (plan.priceUsd === "0") return "Free";
  return `$${plan.priceUsd}/mo`;
}

/**
 * Check if a network is allowed for a plan
 */
export function isNetworkAllowed(planId: PlanId, network: string): boolean {
  const plan = ACCESS_PLANS[planId];

  // Unlimited networks
  if (plan.networkLimit === -1 || plan.allowedNetworks.length === 0) {
    return true;
  }

  return plan.allowedNetworks.includes(network);
}

/**
 * Get next upgrade plan
 */
export function getUpgradePlan(currentPlanId: PlanId): PlanId | null {
  const upgradeOrder: PlanId[] = ["free", "starter", "pro", "scale", "enterprise"];
  const currentIndex = upgradeOrder.indexOf(currentPlanId);

  if (currentIndex === -1 || currentIndex >= upgradeOrder.length - 1) {
    return null;
  }

  return upgradeOrder[currentIndex + 1];
}

/**
 * Calculate rate limit for a plan (requests per minute)
 * Uses RATE_LIMITS constant which supports env var overrides
 */
export function getPlanRateLimit(planId: PlanId): number {
  return RATE_LIMITS[planId];
}

/**
 * Calculate daily API limit from monthly
 */
export function getDailyApiLimit(planId: PlanId): number {
  const plan = ACCESS_PLANS[planId];
  if (plan.monthlyApiCalls === -1) return -1;
  return Math.floor(plan.monthlyApiCalls / 30);
}

/**
 * Default plan for new users
 */
export const DEFAULT_PLAN: PlanId = "free";

/**
 * Networks supported by Stack
 */
export const STACK_NETWORKS = [
  "base",
  "base-sepolia",
  "avalanche",
  "avalanche-fuji",
  "ethereum",
  "ethereum-sepolia",
  "polygon",
  "polygon-mumbai",
  "arbitrum",
  "arbitrum-sepolia",
  "optimism",
  "optimism-sepolia",
] as const;

export type StackNetwork = (typeof STACK_NETWORKS)[number];
