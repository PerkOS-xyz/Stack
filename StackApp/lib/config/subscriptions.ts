/**
 * Subscription Tier Configuration
 *
 * Defines the limits and features for each subscription tier.
 * Values are read from environment variables with sensible defaults.
 */

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'scale' | 'enterprise';

export interface TierLimits {
  /** Monthly transaction limit (-1 for unlimited) */
  monthlyTxLimit: number;
  /** Requests per minute rate limit */
  rateLimit: number;
  /** Maximum number of sponsor wallets */
  maxWallets: number;
  /** Maximum number of sponsorship rules per wallet */
  maxRulesPerWallet: number;
  /** Access to advanced analytics */
  advancedAnalytics: boolean;
  /** Priority support */
  prioritySupport: boolean;
  /** Custom branding */
  customBranding: boolean;
  /** API access level */
  apiAccess: 'basic' | 'standard' | 'full';
  /** Webhook support */
  webhooks: boolean;
  /** Batch settlement support */
  batchSettlement: boolean;
  /** Custom SLA */
  customSLA: boolean;
}

export interface TierConfig {
  name: string;
  displayName: string;
  description: string;
  limits: TierLimits;
  priceMonthly: number; // in USD, 0 for free
  priceYearly: number; // in USD, 0 for free
  features: string[];
}

/**
 * Parse integer from string with default fallback
 */
function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float from string with default fallback
 */
function parseFloatOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Environment variable values - accessed directly for Next.js static analysis
 * Next.js requires direct property access (not dynamic) to inline NEXT_PUBLIC_ vars
 */
const ENV_VALUES = {
  // Prices
  STARTER_PRICE_MONTHLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_STARTER_PRICE_MONTHLY, 29),
  STARTER_PRICE_YEARLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_STARTER_PRICE_YEARLY, 290),
  PRO_PRICE_MONTHLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_PRO_PRICE_MONTHLY, 99),
  PRO_PRICE_YEARLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_PRO_PRICE_YEARLY, 990),
  SCALE_PRICE_MONTHLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_SCALE_PRICE_MONTHLY, 499),
  SCALE_PRICE_YEARLY: parseFloatOrDefault(process.env.NEXT_PUBLIC_STACK_SCALE_PRICE_YEARLY, 4990),

  // Transaction limits
  FREE_TX_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_FREE_TX_LIMIT, 1000),
  STARTER_TX_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_STARTER_TX_LIMIT, 50000),
  PRO_TX_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_PRO_TX_LIMIT, 500000),
  SCALE_TX_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_SCALE_TX_LIMIT, 5000000),

  // Rate limits
  FREE_RATE_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_FREE_RATE_LIMIT, 10),
  STARTER_RATE_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_STARTER_RATE_LIMIT, 60),
  PRO_RATE_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_PRO_RATE_LIMIT, 300),
  SCALE_RATE_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_SCALE_RATE_LIMIT, 1000),
  ENTERPRISE_RATE_LIMIT: parseIntOrDefault(process.env.NEXT_PUBLIC_STACK_ENTERPRISE_RATE_LIMIT, 5000),
};

/**
 * Subscription tier configurations
 *
 * All tiers have full multi-chain access.
 * Tiers are differentiated by transaction limits, rate limits, and features.
 */
export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for testing and small projects',
    limits: {
      monthlyTxLimit: ENV_VALUES.FREE_TX_LIMIT,
      rateLimit: ENV_VALUES.FREE_RATE_LIMIT,
      maxWallets: 1,
      maxRulesPerWallet: 3,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: 'basic',
      webhooks: false,
      batchSettlement: false,
      customSLA: false,
    },
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      `${ENV_VALUES.FREE_TX_LIMIT.toLocaleString()} transactions/month`,
      `${ENV_VALUES.FREE_RATE_LIMIT} requests/minute`,
      '1 sponsor wallet',
      'All networks included',
      'Basic analytics',
      'Community support',
    ],
  },
  starter: {
    name: 'starter',
    displayName: 'Starter',
    description: 'For growing projects and small teams',
    limits: {
      monthlyTxLimit: ENV_VALUES.STARTER_TX_LIMIT,
      rateLimit: ENV_VALUES.STARTER_RATE_LIMIT,
      maxWallets: 5,
      maxRulesPerWallet: 10,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: 'standard',
      webhooks: true,
      batchSettlement: true,
      customSLA: false,
    },
    priceMonthly: ENV_VALUES.STARTER_PRICE_MONTHLY,
    priceYearly: ENV_VALUES.STARTER_PRICE_YEARLY,
    features: [
      `${ENV_VALUES.STARTER_TX_LIMIT.toLocaleString()} transactions/month`,
      `${ENV_VALUES.STARTER_RATE_LIMIT} requests/minute`,
      '5 sponsor wallets',
      'All networks included',
      'Basic analytics',
      'Email support',
      'Webhook notifications',
      'Batch settlement',
    ],
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'For professional teams and production apps',
    limits: {
      monthlyTxLimit: ENV_VALUES.PRO_TX_LIMIT,
      rateLimit: ENV_VALUES.PRO_RATE_LIMIT,
      maxWallets: 25,
      maxRulesPerWallet: 50,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: false,
      apiAccess: 'full',
      webhooks: true,
      batchSettlement: true,
      customSLA: false,
    },
    priceMonthly: ENV_VALUES.PRO_PRICE_MONTHLY,
    priceYearly: ENV_VALUES.PRO_PRICE_YEARLY,
    features: [
      `${ENV_VALUES.PRO_TX_LIMIT.toLocaleString()} transactions/month`,
      `${ENV_VALUES.PRO_RATE_LIMIT} requests/minute`,
      '25 sponsor wallets',
      'All networks included',
      'Advanced analytics',
      'Priority support',
      'Full API access',
      'Webhook notifications',
      'Batch settlement',
    ],
  },
  scale: {
    name: 'scale',
    displayName: 'Scale',
    description: 'For high-volume applications',
    limits: {
      monthlyTxLimit: ENV_VALUES.SCALE_TX_LIMIT,
      rateLimit: ENV_VALUES.SCALE_RATE_LIMIT,
      maxWallets: 100,
      maxRulesPerWallet: 100,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: 'full',
      webhooks: true,
      batchSettlement: true,
      customSLA: false,
    },
    priceMonthly: ENV_VALUES.SCALE_PRICE_MONTHLY,
    priceYearly: ENV_VALUES.SCALE_PRICE_YEARLY,
    features: [
      `${ENV_VALUES.SCALE_TX_LIMIT.toLocaleString()} transactions/month`,
      `${ENV_VALUES.SCALE_RATE_LIMIT.toLocaleString()} requests/minute`,
      '100 sponsor wallets',
      'All networks included',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
      'Full API access',
      'Webhook notifications',
      'Batch settlement',
      'Dedicated account manager',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    limits: {
      monthlyTxLimit: -1, // Unlimited
      rateLimit: ENV_VALUES.ENTERPRISE_RATE_LIMIT,
      maxWallets: -1, // Unlimited
      maxRulesPerWallet: -1, // Unlimited
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: 'full',
      webhooks: true,
      batchSettlement: true,
      customSLA: true,
    },
    priceMonthly: -1, // Custom pricing
    priceYearly: -1, // Custom pricing
    features: [
      'Unlimited transactions',
      `${ENV_VALUES.ENTERPRISE_RATE_LIMIT.toLocaleString()}+ requests/minute`,
      'Unlimited sponsor wallets',
      'All networks included',
      'Advanced analytics',
      '24/7 priority support',
      'Custom branding',
      'Full API access',
      'Webhook notifications',
      'Batch settlement',
      'Dedicated account manager',
      'Custom SLA',
      'On-premise deployment option',
    ],
  },
};

/**
 * Get tier configuration by name
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
}

/**
 * Get tier limits by name
 */
export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return getTierConfig(tier).limits;
}

/**
 * Check if a tier has a specific feature
 */
export function tierHasFeature(tier: SubscriptionTier, feature: keyof TierLimits): boolean {
  const limits = getTierLimits(tier);
  const value = limits[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return true;
}

/**
 * Compare two tiers (returns positive if tier1 > tier2)
 */
export function compareTiers(tier1: SubscriptionTier, tier2: SubscriptionTier): number {
  const order: Record<SubscriptionTier, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    scale: 3,
    enterprise: 4,
  };
  return order[tier1] - order[tier2];
}

/**
 * Check if tier1 is at least as high as tier2
 */
export function tierAtLeast(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return compareTiers(userTier, requiredTier) >= 0;
}

/**
 * Get all available tiers
 */
export function getAllTiers(): SubscriptionTier[] {
  return ['free', 'starter', 'pro', 'scale', 'enterprise'];
}

/**
 * Default tier for new users
 */
export const DEFAULT_TIER: SubscriptionTier = 'free';
