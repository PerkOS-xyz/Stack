# Dynamic Pricing Specification for PerkOS-Stack

> Technical specification for implementing dynamic pricing in the x402 protocol middleware.

**Version**: 1.0.0
**Status**: Draft
**Last Updated**: December 2025
**Authors**: PerkOS Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Research](#background--research)
3. [Architecture Overview](#architecture-overview)
4. [Type Definitions](#type-definitions)
5. [Pricing Strategies](#pricing-strategies)
6. [Service Implementation](#service-implementation)
7. [Middleware Integration](#middleware-integration)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Caching & Idempotency](#caching--idempotency)
11. [Dashboard UI](#dashboard-ui)
12. [Security Considerations](#security-considerations)
13. [Implementation Roadmap](#implementation-roadmap)
14. [References](#references)

---

## Executive Summary

### Problem Statement

The current x402 implementation in PerkOS-Stack uses **fixed pricing** defined at configuration time. This limits the ability to:

- Adjust prices based on demand, usage patterns, or market conditions
- Implement volume-based discounts or loyalty programs
- Support usage-based billing (per token, per compute, per byte)
- Create tiered pricing for different user segments
- Respond to network congestion or resource availability

### Solution

Implement a **Dynamic Pricing Service** that calculates payment requirements in real-time based on:

- Request characteristics (method, path, headers, body, query parameters)
- User context (address, tier, history, reputation)
- Resource metadata (base price, category, scarcity)
- External factors (time of day, network load, market rates)

### Key Principles

1. **Idempotency**: Same request MUST return same price (required by x402 spec)
2. **Transparency**: Price breakdown visible to clients
3. **Extensibility**: Plugin architecture for custom strategies
4. **Performance**: Sub-10ms price calculation with caching
5. **Compliance**: Full x402 V2 protocol compatibility

---

## Background & Research

### x402 Protocol Pricing Mechanism

The standard x402 `PaymentRequirements` structure includes:

```typescript
interface PaymentRequirements {
  scheme: "exact" | "deferred";
  network: string;
  maxAmountRequired: string;  // Currently static
  resource: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;
}
```

**Limitation**: `maxAmountRequired` is set at configuration time and cannot vary per request.

### x402 V2 Enhancements

x402 V2 introduces extensibility for dynamic pricing:

| Feature | Description |
|---------|-------------|
| Dynamic `payTo` routing | Per-request payment recipient selection |
| Input-based pricing | Calculate price from request parameters |
| Extensible schemes | Beyond `exact` and `deferred` |
| Plugin-driven SDK | Register custom pricing logic |

### Industry Implementations

#### Corbits/Faremeter Approach

- Evaluates request attributes (headers, query, path, body)
- Queries external resources (databases) for pricing
- **Critical requirement**: Pricing MUST be idempotent
- Supports dynamic networks, schemes, assets, and facilitators

#### Common Pricing Models

| Model | Use Case | Example |
|-------|----------|---------|
| Fixed | Simple API access | $0.001 per request |
| Tiered | Volume discounts | First 1000 free, then $0.0005 |
| Usage-based | Resource consumption | $0.00001 per token |
| Time-bucket | Peak/off-peak | 2x during peak hours |
| Auction | Scarce resources | Market-driven price |
| Subscription | Prepaid access | $10/month unlimited |

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        PerkOS-Stack                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │   API Route  │───▶│ Pricing Middleware│───▶│  X402 Service │ │
│  └──────────────┘    └────────┬─────────┘    └───────────────┘ │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────┐                         │
│                    │  PricingService  │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Strategy  │    │   Strategy  │    │   Strategy  │        │
│  │   (Fixed)   │    │  (Tiered)   │    │(Usage-based)│        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────────┐                         │
│                    │   Price Cache    │                         │
│                    │   (Idempotency)  │                         │
│                    └──────────────────┘                         │
│                             │                                    │
│                             ▼                                    │
│                    ┌──────────────────┐                         │
│                    │    Supabase      │                         │
│                    │  (Config/Logs)   │                         │
│                    └──────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request arrives** at API route
2. **Pricing Middleware** intercepts request
3. **Context Builder** extracts pricing context from request
4. **Idempotency Check** generates cache key and checks for cached price
5. **Strategy Selection** determines appropriate pricing strategy
6. **Price Calculation** executes strategy with context
7. **Cache Storage** stores result with TTL
8. **PaymentRequirements** built with dynamic price
9. **X402 Flow** continues with standard verification/settlement

---

## Type Definitions

### Core Types

```typescript
// lib/types/pricing.ts

import { Address, Hex } from './x402';

// ============ Pricing Strategy Types ============

export type PricingStrategyType =
  | 'fixed'
  | 'tiered'
  | 'usage-based'
  | 'time-bucket'
  | 'auction'
  | 'subscription'
  | 'custom';

export type PricingUnit =
  | 'per-request'
  | 'per-token'
  | 'per-byte'
  | 'per-second'
  | 'per-minute'
  | 'per-hour'
  | 'per-day'
  | 'per-month';

// ============ Pricing Context ============

export interface PricingContext {
  /** HTTP request details */
  request: RequestContext;

  /** User/payer information */
  user?: UserContext;

  /** Resource being accessed */
  resource: ResourceContext;

  /** Environmental factors */
  environment?: EnvironmentContext;

  /** Timestamp of pricing request */
  timestamp: number;
}

export interface RequestContext {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /** Request path */
  path: string;

  /** Request headers */
  headers: Record<string, string>;

  /** Query parameters */
  query: Record<string, string>;

  /** Request body (for POST/PUT) */
  body?: unknown;

  /** Content length in bytes */
  contentLength?: number;

  /** Client IP (for rate limiting) */
  clientIp?: string;
}

export interface UserContext {
  /** Wallet address */
  address: Address;

  /** User tier (free, basic, premium, enterprise) */
  tier?: UserTier;

  /** Historical usage data */
  usage?: UsageHistory;

  /** Reputation score */
  reputation?: number;

  /** Subscription status */
  subscription?: SubscriptionStatus;
}

export type UserTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface UsageHistory {
  /** Total requests in current period */
  requestCount: number;

  /** Total volume in current period */
  totalVolume: string;

  /** Period start timestamp */
  periodStart: number;

  /** Period end timestamp */
  periodEnd: number;
}

export interface SubscriptionStatus {
  /** Is subscription active */
  active: boolean;

  /** Subscription tier */
  tier: string;

  /** Remaining credits */
  remainingCredits?: string;

  /** Expiry timestamp */
  expiresAt?: number;
}

export interface ResourceContext {
  /** Resource identifier */
  id: string;

  /** Resource type/category */
  type: string;

  /** Base price in atomic units */
  basePrice: string;

  /** Resource metadata */
  metadata?: Record<string, unknown>;

  /** Scarcity factor (1.0 = normal) */
  scarcityFactor?: number;
}

export interface EnvironmentContext {
  /** Current network load (0-1) */
  networkLoad?: number;

  /** Time bucket (peak/off-peak) */
  timeBucket?: 'peak' | 'off-peak' | 'normal';

  /** Gas price in gwei */
  gasPrice?: string;

  /** Market rate multiplier */
  marketRate?: number;
}

// ============ Price Result ============

export interface PriceResult {
  /** Final price in atomic units */
  amount: string;

  /** Asset address */
  asset: Address;

  /** Network identifier */
  network: string;

  /** Price breakdown for transparency */
  breakdown?: PriceBreakdown[];

  /** Price valid until (timestamp) */
  validUntil?: number;

  /** Minimum acceptable price (for negotiations) */
  minAmount?: string;

  /** Currency display info */
  display?: PriceDisplay;
}

export interface PriceBreakdown {
  /** Component name */
  component: string;

  /** Component amount */
  amount: string;

  /** Description */
  description?: string;

  /** Percentage of total */
  percentage?: number;
}

export interface PriceDisplay {
  /** Formatted amount (e.g., "0.001") */
  formatted: string;

  /** Currency symbol (e.g., "USDC") */
  symbol: string;

  /** Decimals used */
  decimals: number;
}

// ============ Strategy Configuration ============

export interface PricingStrategyConfig {
  /** Strategy type */
  type: PricingStrategyType;

  /** Strategy name */
  name: string;

  /** Is strategy enabled */
  enabled: boolean;

  /** Strategy-specific parameters */
  parameters: StrategyParameters;

  /** Cache configuration */
  cache?: CacheConfig;

  /** Conditions for strategy activation */
  conditions?: StrategyCondition[];
}

export type StrategyParameters =
  | FixedPricingParams
  | TieredPricingParams
  | UsageBasedPricingParams
  | TimeBucketPricingParams
  | AuctionPricingParams
  | SubscriptionPricingParams
  | CustomPricingParams;

export interface FixedPricingParams {
  type: 'fixed';
  /** Fixed price in atomic units */
  price: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface TieredPricingParams {
  type: 'tiered';
  /** Pricing tiers */
  tiers: PricingTier[];
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
  /** Reset period in seconds */
  resetPeriod: number;
}

export interface PricingTier {
  /** Tier name */
  name: string;
  /** Requests up to this count */
  upTo: number | 'unlimited';
  /** Price per request in atomic units */
  pricePerRequest: string;
  /** Discount percentage (0-100) */
  discount?: number;
}

export interface UsageBasedPricingParams {
  type: 'usage-based';
  /** Base price per unit */
  pricePerUnit: string;
  /** Unit type */
  unit: PricingUnit;
  /** Minimum charge */
  minimumCharge?: string;
  /** Maximum charge */
  maximumCharge?: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
  /** Unit extraction function name */
  unitExtractor?: string;
}

export interface TimeBucketPricingParams {
  type: 'time-bucket';
  /** Base price */
  basePrice: string;
  /** Peak hours multiplier */
  peakMultiplier: number;
  /** Off-peak hours multiplier */
  offPeakMultiplier: number;
  /** Peak hours (24h format) */
  peakHours: { start: number; end: number }[];
  /** Timezone */
  timezone: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface AuctionPricingParams {
  type: 'auction';
  /** Minimum price */
  floorPrice: string;
  /** Maximum price */
  ceilingPrice: string;
  /** Price adjustment speed */
  adjustmentRate: number;
  /** Current demand factor */
  demandFactor?: number;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface SubscriptionPricingParams {
  type: 'subscription';
  /** Available plans */
  plans: SubscriptionPlan[];
  /** Overage pricing */
  overagePrice?: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface SubscriptionPlan {
  /** Plan ID */
  id: string;
  /** Plan name */
  name: string;
  /** Monthly price */
  monthlyPrice: string;
  /** Included requests */
  includedRequests: number | 'unlimited';
  /** Features */
  features: string[];
}

export interface CustomPricingParams {
  type: 'custom';
  /** Custom calculator endpoint */
  calculatorEndpoint?: string;
  /** Custom calculator function */
  calculatorFunction?: string;
  /** Custom parameters */
  customParams: Record<string, unknown>;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** TTL in seconds */
  ttlSeconds: number;
  /** Cache key generator */
  keyGenerator?: 'default' | 'custom';
  /** Custom key template */
  customKeyTemplate?: string;
}

export interface StrategyCondition {
  /** Field to check */
  field: string;
  /** Operator */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';
  /** Value to compare */
  value: unknown;
}

// ============ Strategy Interface ============

export interface PricingStrategy {
  /** Strategy name */
  readonly name: string;

  /** Strategy type */
  readonly type: PricingStrategyType;

  /**
   * Calculate price based on context
   * @param context - Pricing context
   * @returns Price result
   */
  calculatePrice(context: PricingContext): Promise<PriceResult>;

  /**
   * Generate idempotency cache key
   * @param context - Pricing context
   * @returns Cache key string
   */
  generateCacheKey(context: PricingContext): string;

  /**
   * Validate strategy configuration
   * @returns Validation result
   */
  validate(): { valid: boolean; errors?: string[] };
}

// ============ Service Types ============

export interface PricingServiceConfig {
  /** Default strategy */
  defaultStrategy: PricingStrategyType;

  /** Available strategies */
  strategies: PricingStrategyConfig[];

  /** Route-specific strategy mappings */
  routeMappings?: RouteStrategyMapping[];

  /** Global cache config */
  cache: CacheConfig;

  /** Enable price logging */
  enableLogging: boolean;

  /** Fallback price if calculation fails */
  fallbackPrice?: string;
}

export interface RouteStrategyMapping {
  /** Route pattern (glob or regex) */
  pattern: string;

  /** Strategy to use */
  strategy: PricingStrategyType;

  /** Override parameters */
  overrides?: Partial<StrategyParameters>;
}

// ============ Extended PaymentRequirements ============

export interface DynamicPaymentRequirements {
  /** Standard x402 fields */
  scheme: 'exact' | 'deferred';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;
  extra?: Record<string, unknown>;

  /** Dynamic pricing metadata */
  pricing?: {
    /** Pricing strategy used */
    strategy: PricingStrategyType;

    /** Price breakdown */
    breakdown?: PriceBreakdown[];

    /** Price valid until */
    validUntil?: number;

    /** Minimum acceptable (for negotiation) */
    minAmount?: string;

    /** Cache key for verification */
    cacheKey?: string;
  };
}

// ============ Analytics Types ============

export interface PricingAnalytics {
  /** Total price calculations */
  totalCalculations: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Average calculation time (ms) */
  avgCalculationTime: number;

  /** Revenue by strategy */
  revenueByStrategy: Record<PricingStrategyType, string>;

  /** Price distribution */
  priceDistribution: PriceDistributionBucket[];
}

export interface PriceDistributionBucket {
  /** Range start */
  rangeStart: string;

  /** Range end */
  rangeEnd: string;

  /** Count in range */
  count: number;

  /** Percentage */
  percentage: number;
}
```

---

## Pricing Strategies

### Strategy Interface Implementation

```typescript
// lib/services/pricing/strategies/base-strategy.ts

import {
  PricingStrategy,
  PricingStrategyType,
  PricingContext,
  PriceResult,
  PricingStrategyConfig
} from '@/lib/types/pricing';
import { createHash } from 'crypto';

export abstract class BasePricingStrategy implements PricingStrategy {
  abstract readonly name: string;
  abstract readonly type: PricingStrategyType;

  protected config: PricingStrategyConfig;

  constructor(config: PricingStrategyConfig) {
    this.config = config;
  }

  abstract calculatePrice(context: PricingContext): Promise<PriceResult>;

  /**
   * Default cache key generator ensuring idempotency
   * Same request characteristics = same cache key = same price
   */
  generateCacheKey(context: PricingContext): string {
    const keyComponents = {
      strategy: this.type,
      method: context.request.method,
      path: context.request.path,
      query: this.sortObject(context.request.query),
      bodyHash: context.request.body
        ? this.hashObject(context.request.body)
        : null,
      user: context.user?.address || 'anonymous',
      resource: context.resource.id,
    };

    const keyString = JSON.stringify(keyComponents);
    return createHash('sha256').update(keyString).digest('hex').slice(0, 32);
  }

  validate(): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!this.config.parameters) {
      errors.push('Strategy parameters are required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  protected sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as Record<string, unknown>);
  }

  protected hashObject(obj: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(obj))
      .digest('hex')
      .slice(0, 16);
  }

  protected formatPrice(
    amount: bigint,
    asset: string,
    decimals: number = 6
  ): PriceResult['display'] {
    const formatted = (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
    return {
      formatted,
      symbol: 'USDC', // Could be dynamic based on asset
      decimals,
    };
  }
}
```

### Fixed Pricing Strategy

```typescript
// lib/services/pricing/strategies/fixed-strategy.ts

import { BasePricingStrategy } from './base-strategy';
import {
  PricingContext,
  PriceResult,
  FixedPricingParams
} from '@/lib/types/pricing';

export class FixedPricingStrategy extends BasePricingStrategy {
  readonly name = 'Fixed Pricing';
  readonly type = 'fixed' as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.config.parameters as FixedPricingParams;

    return {
      amount: params.price,
      asset: params.asset,
      network: params.network,
      breakdown: [
        {
          component: 'Base Price',
          amount: params.price,
          description: 'Fixed rate per request',
          percentage: 100,
        },
      ],
      display: this.formatPrice(BigInt(params.price), params.asset),
    };
  }

  validate(): { valid: boolean; errors?: string[] } {
    const baseValidation = super.validate();
    const errors = [...(baseValidation.errors || [])];

    const params = this.config.parameters as FixedPricingParams;

    if (!params.price || BigInt(params.price) <= 0n) {
      errors.push('Fixed price must be a positive value');
    }

    if (!params.asset) {
      errors.push('Asset address is required');
    }

    if (!params.network) {
      errors.push('Network is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
```

### Tiered Pricing Strategy

```typescript
// lib/services/pricing/strategies/tiered-strategy.ts

import { BasePricingStrategy } from './base-strategy';
import {
  PricingContext,
  PriceResult,
  TieredPricingParams,
  PriceBreakdown
} from '@/lib/types/pricing';

export class TieredPricingStrategy extends BasePricingStrategy {
  readonly name = 'Tiered Pricing';
  readonly type = 'tiered' as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.config.parameters as TieredPricingParams;
    const usage = context.user?.usage;

    // Determine current request count
    const currentCount = usage?.requestCount || 0;

    // Find applicable tier
    const applicableTier = this.findApplicableTier(currentCount, params.tiers);

    // Calculate price
    let amount = BigInt(applicableTier.pricePerRequest);

    // Apply discount if available
    if (applicableTier.discount && applicableTier.discount > 0) {
      const discountMultiplier = (100 - applicableTier.discount) / 100;
      amount = BigInt(Math.floor(Number(amount) * discountMultiplier));
    }

    const breakdown: PriceBreakdown[] = [
      {
        component: `${applicableTier.name} Tier`,
        amount: applicableTier.pricePerRequest,
        description: `Request #${currentCount + 1}`,
        percentage: applicableTier.discount ? 100 - applicableTier.discount : 100,
      },
    ];

    if (applicableTier.discount) {
      breakdown.push({
        component: 'Volume Discount',
        amount: `-${BigInt(applicableTier.pricePerRequest) - amount}`,
        description: `${applicableTier.discount}% discount`,
        percentage: applicableTier.discount,
      });
    }

    return {
      amount: amount.toString(),
      asset: params.asset,
      network: params.network,
      breakdown,
      display: this.formatPrice(amount, params.asset),
    };
  }

  private findApplicableTier(
    requestCount: number,
    tiers: TieredPricingParams['tiers']
  ) {
    // Sort tiers by upTo value
    const sortedTiers = [...tiers].sort((a, b) => {
      if (a.upTo === 'unlimited') return 1;
      if (b.upTo === 'unlimited') return -1;
      return (a.upTo as number) - (b.upTo as number);
    });

    for (const tier of sortedTiers) {
      if (tier.upTo === 'unlimited' || requestCount < tier.upTo) {
        return tier;
      }
    }

    // Default to last tier
    return sortedTiers[sortedTiers.length - 1];
  }

  /**
   * Override cache key to include usage period
   * This ensures price recalculates when user enters new tier
   */
  generateCacheKey(context: PricingContext): string {
    const params = this.config.parameters as TieredPricingParams;
    const usage = context.user?.usage;
    const currentCount = usage?.requestCount || 0;
    const tier = this.findApplicableTier(currentCount, params.tiers);

    // Include tier name in cache key
    const baseKey = super.generateCacheKey(context);
    return `${baseKey}:tier:${tier.name}`;
  }
}
```

### Usage-Based Pricing Strategy

```typescript
// lib/services/pricing/strategies/usage-based-strategy.ts

import { BasePricingStrategy } from './base-strategy';
import {
  PricingContext,
  PriceResult,
  UsageBasedPricingParams
} from '@/lib/types/pricing';

export class UsageBasedPricingStrategy extends BasePricingStrategy {
  readonly name = 'Usage-Based Pricing';
  readonly type = 'usage-based' as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.config.parameters as UsageBasedPricingParams;

    // Extract usage units from request
    const units = this.extractUnits(context, params);

    // Calculate base price
    let amount = BigInt(params.pricePerUnit) * BigInt(units);

    // Apply minimum charge
    if (params.minimumCharge) {
      const min = BigInt(params.minimumCharge);
      if (amount < min) {
        amount = min;
      }
    }

    // Apply maximum charge
    if (params.maximumCharge) {
      const max = BigInt(params.maximumCharge);
      if (amount > max) {
        amount = max;
      }
    }

    return {
      amount: amount.toString(),
      asset: params.asset,
      network: params.network,
      breakdown: [
        {
          component: 'Usage Charge',
          amount: amount.toString(),
          description: `${units} ${params.unit}s @ ${params.pricePerUnit} each`,
          percentage: 100,
        },
      ],
      display: this.formatPrice(amount, params.asset),
    };
  }

  private extractUnits(
    context: PricingContext,
    params: UsageBasedPricingParams
  ): number {
    switch (params.unit) {
      case 'per-request':
        return 1;

      case 'per-byte':
        return context.request.contentLength || 0;

      case 'per-token':
        // Extract token count from body (for AI/LLM requests)
        return this.estimateTokens(context.request.body);

      case 'per-second':
      case 'per-minute':
      case 'per-hour':
        // For time-based, return 1 unit (actual time tracked elsewhere)
        return 1;

      default:
        return 1;
    }
  }

  private estimateTokens(body: unknown): number {
    if (!body) return 0;

    // Simple token estimation (4 chars ≈ 1 token)
    const text = typeof body === 'string'
      ? body
      : JSON.stringify(body);

    return Math.ceil(text.length / 4);
  }

  /**
   * Override cache key to include usage units
   * Ensures different payload sizes get different prices
   */
  generateCacheKey(context: PricingContext): string {
    const params = this.config.parameters as UsageBasedPricingParams;
    const units = this.extractUnits(context, params);

    const baseKey = super.generateCacheKey(context);
    return `${baseKey}:units:${units}`;
  }
}
```

### Time-Bucket Pricing Strategy

```typescript
// lib/services/pricing/strategies/time-bucket-strategy.ts

import { BasePricingStrategy } from './base-strategy';
import {
  PricingContext,
  PriceResult,
  TimeBucketPricingParams
} from '@/lib/types/pricing';

export class TimeBucketPricingStrategy extends BasePricingStrategy {
  readonly name = 'Time-Bucket Pricing';
  readonly type = 'time-bucket' as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.config.parameters as TimeBucketPricingParams;

    // Determine current time bucket
    const bucket = this.getCurrentBucket(params);
    const multiplier = this.getMultiplier(bucket, params);

    // Calculate price
    const baseAmount = BigInt(params.basePrice);
    const amount = BigInt(Math.floor(Number(baseAmount) * multiplier));

    return {
      amount: amount.toString(),
      asset: params.asset,
      network: params.network,
      breakdown: [
        {
          component: 'Base Price',
          amount: params.basePrice,
          percentage: 100 / multiplier,
        },
        {
          component: `${bucket} Hours Adjustment`,
          amount: (amount - baseAmount).toString(),
          description: `${multiplier}x multiplier`,
          percentage: ((multiplier - 1) / multiplier) * 100,
        },
      ],
      display: this.formatPrice(amount, params.asset),
    };
  }

  private getCurrentBucket(
    params: TimeBucketPricingParams
  ): 'peak' | 'off-peak' | 'normal' {
    const now = new Date();

    // Convert to specified timezone
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      hour12: false,
      timeZone: params.timezone,
    };
    const hour = parseInt(now.toLocaleString('en-US', options));

    // Check if in peak hours
    for (const peak of params.peakHours) {
      if (hour >= peak.start && hour < peak.end) {
        return 'peak';
      }
    }

    // Check if in off-peak (late night / early morning)
    if (hour >= 0 && hour < 6) {
      return 'off-peak';
    }

    return 'normal';
  }

  private getMultiplier(
    bucket: 'peak' | 'off-peak' | 'normal',
    params: TimeBucketPricingParams
  ): number {
    switch (bucket) {
      case 'peak':
        return params.peakMultiplier;
      case 'off-peak':
        return params.offPeakMultiplier;
      default:
        return 1.0;
    }
  }

  /**
   * Override cache key to include time bucket
   * Price changes when bucket changes
   */
  generateCacheKey(context: PricingContext): string {
    const params = this.config.parameters as TimeBucketPricingParams;
    const bucket = this.getCurrentBucket(params);

    const baseKey = super.generateCacheKey(context);
    return `${baseKey}:bucket:${bucket}`;
  }
}
```

### Strategy Factory

```typescript
// lib/services/pricing/strategy-factory.ts

import {
  PricingStrategy,
  PricingStrategyConfig,
  PricingStrategyType
} from '@/lib/types/pricing';
import { FixedPricingStrategy } from './strategies/fixed-strategy';
import { TieredPricingStrategy } from './strategies/tiered-strategy';
import { UsageBasedPricingStrategy } from './strategies/usage-based-strategy';
import { TimeBucketPricingStrategy } from './strategies/time-bucket-strategy';

export class StrategyFactory {
  private static strategies: Map<PricingStrategyType, new (config: PricingStrategyConfig) => PricingStrategy> = new Map([
    ['fixed', FixedPricingStrategy],
    ['tiered', TieredPricingStrategy],
    ['usage-based', UsageBasedPricingStrategy],
    ['time-bucket', TimeBucketPricingStrategy],
  ]);

  static create(config: PricingStrategyConfig): PricingStrategy {
    const StrategyClass = this.strategies.get(config.type);

    if (!StrategyClass) {
      throw new Error(`Unknown pricing strategy type: ${config.type}`);
    }

    const strategy = new StrategyClass(config);

    // Validate configuration
    const validation = strategy.validate();
    if (!validation.valid) {
      throw new Error(
        `Invalid strategy configuration: ${validation.errors?.join(', ')}`
      );
    }

    return strategy;
  }

  static register(
    type: PricingStrategyType,
    strategyClass: new (config: PricingStrategyConfig) => PricingStrategy
  ): void {
    this.strategies.set(type, strategyClass);
  }

  static getAvailableStrategies(): PricingStrategyType[] {
    return Array.from(this.strategies.keys());
  }
}
```

---

## Service Implementation

### PricingService

```typescript
// lib/services/pricing/pricing-service.ts

import {
  PricingContext,
  PriceResult,
  PricingServiceConfig,
  PricingStrategy,
  PricingStrategyType,
  DynamicPaymentRequirements,
} from '@/lib/types/pricing';
import { PaymentRequirements, Address } from '@/lib/types/x402';
import { StrategyFactory } from './strategy-factory';
import { PriceCache } from './price-cache';
import { supabase } from '@/lib/supabase';

export class PricingService {
  private config: PricingServiceConfig;
  private strategies: Map<PricingStrategyType, PricingStrategy>;
  private cache: PriceCache;
  private defaultStrategy: PricingStrategy;

  constructor(config: PricingServiceConfig) {
    this.config = config;
    this.strategies = new Map();
    this.cache = new PriceCache(config.cache);

    // Initialize strategies
    for (const strategyConfig of config.strategies) {
      if (strategyConfig.enabled) {
        const strategy = StrategyFactory.create(strategyConfig);
        this.strategies.set(strategyConfig.type, strategy);
      }
    }

    // Set default strategy
    const defaultStrategyInstance = this.strategies.get(config.defaultStrategy);
    if (!defaultStrategyInstance) {
      throw new Error(`Default strategy ${config.defaultStrategy} not found or not enabled`);
    }
    this.defaultStrategy = defaultStrategyInstance;
  }

  /**
   * Calculate price for a request
   */
  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const startTime = Date.now();

    try {
      // Select strategy based on route mapping or default
      const strategy = this.selectStrategy(context);

      // Generate cache key for idempotency
      const cacheKey = strategy.generateCacheKey(context);

      // Check cache
      const cachedPrice = await this.cache.get(cacheKey);
      if (cachedPrice) {
        await this.logPriceCalculation(context, cachedPrice, strategy.type, true, Date.now() - startTime);
        return cachedPrice;
      }

      // Calculate price
      const price = await strategy.calculatePrice(context);

      // Set validity period
      const cacheTtl = this.config.cache.ttlSeconds;
      price.validUntil = Math.floor(Date.now() / 1000) + cacheTtl;

      // Store in cache
      await this.cache.set(cacheKey, price, cacheTtl);

      // Log calculation
      await this.logPriceCalculation(context, price, strategy.type, false, Date.now() - startTime);

      return price;

    } catch (error) {
      console.error('Price calculation error:', error);

      // Return fallback price if configured
      if (this.config.fallbackPrice) {
        return {
          amount: this.config.fallbackPrice,
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
          network: 'base-sepolia',
          breakdown: [{ component: 'Fallback Price', amount: this.config.fallbackPrice }],
        };
      }

      throw error;
    }
  }

  /**
   * Build PaymentRequirements with dynamic pricing
   */
  async buildPaymentRequirements(
    context: PricingContext,
    baseRequirements: Partial<PaymentRequirements>
  ): Promise<DynamicPaymentRequirements> {
    const price = await this.calculatePrice(context);
    const strategy = this.selectStrategy(context);
    const cacheKey = strategy.generateCacheKey(context);

    return {
      scheme: baseRequirements.scheme || 'exact',
      network: price.network,
      maxAmountRequired: price.amount,
      resource: baseRequirements.resource || context.request.path,
      description: baseRequirements.description,
      mimeType: baseRequirements.mimeType,
      payTo: baseRequirements.payTo!,
      maxTimeoutSeconds: baseRequirements.maxTimeoutSeconds || 60,
      asset: price.asset,
      extra: baseRequirements.extra,
      pricing: {
        strategy: strategy.type,
        breakdown: price.breakdown,
        validUntil: price.validUntil,
        minAmount: price.minAmount,
        cacheKey,
      },
    };
  }

  /**
   * Verify a price hasn't changed (for settlement)
   */
  async verifyPrice(cacheKey: string, amount: string): Promise<boolean> {
    const cachedPrice = await this.cache.get(cacheKey);

    if (!cachedPrice) {
      // Price expired, recalculation needed
      return false;
    }

    // Allow exact match or if paid amount >= required
    return BigInt(amount) >= BigInt(cachedPrice.amount);
  }

  /**
   * Select strategy based on route mappings
   */
  private selectStrategy(context: PricingContext): PricingStrategy {
    if (this.config.routeMappings) {
      for (const mapping of this.config.routeMappings) {
        if (this.matchRoute(context.request.path, mapping.pattern)) {
          const strategy = this.strategies.get(mapping.strategy);
          if (strategy) {
            return strategy;
          }
        }
      }
    }

    return this.defaultStrategy;
  }

  /**
   * Match route against pattern (glob-style)
   */
  private matchRoute(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Log price calculation for analytics
   */
  private async logPriceCalculation(
    context: PricingContext,
    price: PriceResult,
    strategy: PricingStrategyType,
    cacheHit: boolean,
    durationMs: number
  ): Promise<void> {
    if (!this.config.enableLogging) return;

    try {
      await supabase.from('perkos_price_calculations').insert({
        strategy,
        path: context.request.path,
        method: context.request.method,
        user_address: context.user?.address,
        amount: price.amount,
        asset: price.asset,
        network: price.network,
        cache_hit: cacheHit,
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log price calculation:', error);
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalculations: number;
    cacheHitRate: number;
    avgDurationMs: number;
    byStrategy: Record<string, number>;
  }> {
    const { data, error } = await supabase
      .from('perkos_price_calculations')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error || !data) {
      return {
        totalCalculations: 0,
        cacheHitRate: 0,
        avgDurationMs: 0,
        byStrategy: {},
      };
    }

    const total = data.length;
    const cacheHits = data.filter(d => d.cache_hit).length;
    const avgDuration = data.reduce((sum, d) => sum + d.duration_ms, 0) / total;

    const byStrategy = data.reduce((acc, d) => {
      acc[d.strategy] = (acc[d.strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCalculations: total,
      cacheHitRate: total > 0 ? cacheHits / total : 0,
      avgDurationMs: avgDuration || 0,
      byStrategy,
    };
  }
}
```

### Price Cache

```typescript
// lib/services/pricing/price-cache.ts

import { PriceResult, CacheConfig } from '@/lib/types/pricing';

interface CacheEntry {
  price: PriceResult;
  expiresAt: number;
}

export class PriceCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<PriceResult | null> {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.price;
  }

  async set(key: string, price: PriceResult, ttlSeconds?: number): Promise<void> {
    if (!this.config.enabled) return;

    const ttl = ttlSeconds || this.config.ttlSeconds;

    this.cache.set(key, {
      price,
      expiresAt: Date.now() + (ttl * 1000),
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for real implementation
    };
  }
}
```

---

## Middleware Integration

### Dynamic Pricing Middleware

```typescript
// lib/middleware/dynamic-pricing-middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { PricingService } from '@/lib/services/pricing/pricing-service';
import { PricingContext, UserContext } from '@/lib/types/pricing';
import { Address } from '@/lib/types/x402';

// Singleton pricing service instance
let pricingService: PricingService | null = null;

export function getPricingService(): PricingService {
  if (!pricingService) {
    pricingService = new PricingService({
      defaultStrategy: 'fixed',
      strategies: [
        {
          type: 'fixed',
          name: 'Default Fixed',
          enabled: true,
          parameters: {
            type: 'fixed',
            price: '1000', // 0.001 USDC (6 decimals)
            asset: process.env.NEXT_PUBLIC_USDC_ADDRESS as Address,
            network: process.env.NEXT_PUBLIC_DEFAULT_NETWORK || 'base-sepolia',
          },
        },
        // Add more strategies as configured
      ],
      cache: {
        enabled: true,
        ttlSeconds: 300, // 5 minutes
      },
      enableLogging: true,
    });
  }

  return pricingService;
}

/**
 * Build pricing context from Next.js request
 */
export async function buildPricingContext(
  request: NextRequest,
  resourceId: string,
  basePrice: string
): Promise<PricingContext> {
  // Extract user context from headers or auth
  const userAddress = request.headers.get('x-user-address') as Address | null;
  let userContext: UserContext | undefined;

  if (userAddress) {
    userContext = await fetchUserContext(userAddress);
  }

  // Parse request body if present
  let body: unknown;
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      body = await request.clone().json();
    } catch {
      body = undefined;
    }
  }

  // Build query params object
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Build headers object
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    request: {
      method: request.method as PricingContext['request']['method'],
      path: request.nextUrl.pathname,
      headers,
      query,
      body,
      contentLength: parseInt(request.headers.get('content-length') || '0'),
      clientIp: request.headers.get('x-forwarded-for') || undefined,
    },
    user: userContext,
    resource: {
      id: resourceId,
      type: 'api',
      basePrice,
    },
    timestamp: Date.now(),
  };
}

/**
 * Fetch user context from database
 */
async function fetchUserContext(address: Address): Promise<UserContext> {
  // Implementation would fetch from Supabase
  // For now, return basic context
  return {
    address,
    tier: 'basic',
  };
}

/**
 * Higher-order function to wrap API routes with dynamic pricing
 */
export function withDynamicPricing(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    resourceId: string;
    basePrice: string;
    payTo: Address;
    scheme?: 'exact' | 'deferred';
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const service = getPricingService();

    // Build context
    const context = await buildPricingContext(
      request,
      options.resourceId,
      options.basePrice
    );

    // Check for payment header
    const paymentSignature = request.headers.get('PAYMENT-SIGNATURE');

    if (!paymentSignature) {
      // No payment - return 402 with dynamic requirements
      const requirements = await service.buildPaymentRequirements(context, {
        scheme: options.scheme || 'exact',
        payTo: options.payTo,
        resource: request.nextUrl.pathname,
        description: `Access to ${options.resourceId}`,
        mimeType: 'application/json',
        maxTimeoutSeconds: 60,
      });

      // Encode requirements as base64
      const requirementsB64 = Buffer.from(
        JSON.stringify(requirements)
      ).toString('base64');

      return new NextResponse(
        JSON.stringify({
          error: 'Payment Required',
          requirements,
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'PAYMENT-REQUIRED': requirementsB64,
          },
        }
      );
    }

    // Payment present - verify and continue
    // (verification logic would go here)

    return handler(request);
  };
}
```

### Usage Example

```typescript
// app/api/premium/data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withDynamicPricing } from '@/lib/middleware/dynamic-pricing-middleware';
import { Address } from '@/lib/types/x402';

async function handler(request: NextRequest): Promise<NextResponse> {
  // Your API logic here
  return NextResponse.json({
    data: 'Premium content',
    timestamp: Date.now(),
  });
}

export const GET = withDynamicPricing(handler, {
  resourceId: 'premium-data-api',
  basePrice: '10000', // 0.01 USDC
  payTo: process.env.NEXT_PUBLIC_PAYMENT_RECEIVER as Address,
  scheme: 'exact',
});
```

---

## Database Schema

### Price Calculations Table

```sql
-- Supabase migration for dynamic pricing

-- Price calculations log
CREATE TABLE IF NOT EXISTS perkos_price_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  user_address TEXT,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  duration_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_strategy CHECK (strategy IN ('fixed', 'tiered', 'usage-based', 'time-bucket', 'auction', 'subscription', 'custom'))
);

CREATE INDEX idx_price_calc_timestamp ON perkos_price_calculations(timestamp);
CREATE INDEX idx_price_calc_strategy ON perkos_price_calculations(strategy);
CREATE INDEX idx_price_calc_user ON perkos_price_calculations(user_address);

-- Pricing configurations
CREATE TABLE IF NOT EXISTS perkos_pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  strategy_type TEXT NOT NULL,
  parameters JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  route_patterns TEXT[], -- Array of route patterns this config applies to
  priority INTEGER DEFAULT 0, -- Higher priority configs are checked first
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_strategy_type CHECK (strategy_type IN ('fixed', 'tiered', 'usage-based', 'time-bucket', 'auction', 'subscription', 'custom'))
);

CREATE INDEX idx_pricing_config_enabled ON perkos_pricing_configs(enabled);
CREATE INDEX idx_pricing_config_priority ON perkos_pricing_configs(priority DESC);

-- User tiers for tiered pricing
CREATE TABLE IF NOT EXISTS perkos_user_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  request_count INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',
  period_start TIMESTAMPTZ DEFAULT NOW(),
  period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_tier CHECK (tier IN ('free', 'basic', 'premium', 'enterprise'))
);

CREATE INDEX idx_user_tier_address ON perkos_user_tiers(user_address);
CREATE INDEX idx_user_tier_period ON perkos_user_tiers(period_end);

-- Subscription plans
CREATE TABLE IF NOT EXISTS perkos_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  monthly_price TEXT NOT NULL,
  included_requests INTEGER,
  features TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS perkos_user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  plan_id UUID REFERENCES perkos_subscription_plans(id),
  status TEXT DEFAULT 'active',
  remaining_credits INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_tx_hash TEXT,

  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled', 'pending'))
);

CREATE INDEX idx_subscription_user ON perkos_user_subscriptions(user_address);
CREATE INDEX idx_subscription_status ON perkos_user_subscriptions(status);

-- RLS Policies
ALTER TABLE perkos_price_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_pricing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE perkos_user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin can read/write all
CREATE POLICY "Admin full access on price_calculations" ON perkos_price_calculations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin full access on pricing_configs" ON perkos_pricing_configs
  FOR ALL USING (auth.role() = 'service_role');

-- Public can read enabled pricing configs
CREATE POLICY "Public read enabled configs" ON perkos_pricing_configs
  FOR SELECT USING (enabled = TRUE);

-- Public can read subscription plans
CREATE POLICY "Public read subscription plans" ON perkos_subscription_plans
  FOR SELECT USING (enabled = TRUE);

-- Function to increment user request count
CREATE OR REPLACE FUNCTION increment_user_request_count(p_user_address TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO perkos_user_tiers (user_address, request_count, period_start, period_end)
  VALUES (p_user_address, 1, NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT (user_address)
  DO UPDATE SET
    request_count = perkos_user_tiers.request_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to reset period counters
CREATE OR REPLACE FUNCTION reset_expired_periods()
RETURNS void AS $$
BEGIN
  UPDATE perkos_user_tiers
  SET
    request_count = 0,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '30 days',
    updated_at = NOW()
  WHERE period_end < NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## API Endpoints

### Pricing Configuration API

```typescript
// app/api/v2/pricing/config/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - List all pricing configurations
export async function GET(request: NextRequest) {
  const { data, error } = await supabase
    .from('perkos_pricing_configs')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configs: data });
}

// POST - Create new pricing configuration
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('perkos_pricing_configs')
    .insert({
      name: body.name,
      strategy_type: body.strategyType,
      parameters: body.parameters,
      enabled: body.enabled ?? true,
      route_patterns: body.routePatterns,
      priority: body.priority ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data }, { status: 201 });
}
```

```typescript
// app/api/v2/pricing/calculate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPricingService, buildPricingContext } from '@/lib/middleware/dynamic-pricing-middleware';

// POST - Calculate price for a request
export async function POST(request: NextRequest) {
  const body = await request.json();

  const service = getPricingService();

  const context = await buildPricingContext(
    request,
    body.resourceId,
    body.basePrice || '1000'
  );

  try {
    const price = await service.calculatePrice(context);

    return NextResponse.json({
      price: {
        amount: price.amount,
        asset: price.asset,
        network: price.network,
        breakdown: price.breakdown,
        validUntil: price.validUntil,
        display: price.display,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to calculate price' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/v2/pricing/analytics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPricingService } from '@/lib/middleware/dynamic-pricing-middleware';

// GET - Get pricing analytics
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const startDate = new Date(searchParams.get('start') || Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(searchParams.get('end') || Date.now());

  const service = getPricingService();
  const analytics = await service.getAnalytics(startDate, endDate);

  return NextResponse.json({ analytics });
}
```

---

## Caching & Idempotency

### Idempotency Requirements

The x402 protocol requires that **pricing MUST be idempotent**:

> "The generated payment requirements MUST be idempotent (i.e., the same requirements must be sent if the request is the same)."

### Implementation Strategy

1. **Cache Key Generation**: Deterministic hash of request characteristics
2. **TTL-Based Expiration**: Prices valid for configurable period (default: 5 minutes)
3. **Strategy-Aware Keys**: Different strategies may add context to keys

### Cache Key Components

```typescript
// Default cache key includes:
{
  strategy: 'fixed',           // Strategy type
  method: 'POST',              // HTTP method
  path: '/api/data',           // Request path
  query: { sort: 'asc' },      // Sorted query params
  bodyHash: 'abc123...',       // Hash of request body
  user: '0x123...',            // User address
  resource: 'data-api',        // Resource ID
}
```

### Strategy-Specific Extensions

| Strategy | Additional Cache Key Components |
|----------|--------------------------------|
| Fixed | None (base key sufficient) |
| Tiered | Current tier name |
| Usage-based | Calculated units |
| Time-bucket | Current time bucket |
| Auction | None (recalculates each time within TTL) |

---

## Dashboard UI

### Pricing Configuration Page

Features needed:

1. **Strategy List**: View all configured strategies
2. **Strategy Editor**: Create/edit strategy configurations
3. **Route Mapping**: Assign strategies to routes
4. **Live Preview**: Test price calculation with sample requests
5. **Analytics Dashboard**: View pricing metrics and trends

### Component Structure

```
/dashboard/pricing/
├── page.tsx              # Main pricing dashboard
├── strategies/
│   ├── page.tsx          # Strategy list
│   ├── [id]/
│   │   └── page.tsx      # Edit strategy
│   └── new/
│       └── page.tsx      # Create strategy
├── routes/
│   └── page.tsx          # Route mappings
├── analytics/
│   └── page.tsx          # Pricing analytics
└── simulator/
    └── page.tsx          # Price simulation tool
```

---

## Security Considerations

### Input Validation

- Validate all pricing parameters before storage
- Sanitize user inputs in pricing context
- Limit body size for token estimation

### Access Control

- Admin-only access to pricing configuration
- Rate limiting on calculation endpoints
- Audit logging for configuration changes

### Price Manipulation Prevention

- Minimum price floors
- Maximum price ceilings
- Anomaly detection for unusual pricing patterns

### Cache Security

- Cache keys include user context (prevents cross-user price leakage)
- TTL prevents stale prices
- Cache invalidation on configuration changes

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Define type definitions (`lib/types/pricing.ts`)
- [ ] Implement base strategy class
- [ ] Implement Fixed pricing strategy
- [ ] Create PricingService core
- [ ] Add price cache with idempotency

### Phase 2: Strategies (Week 3-4)

- [ ] Implement Tiered pricing strategy
- [ ] Implement Usage-based pricing strategy
- [ ] Implement Time-bucket pricing strategy
- [ ] Create Strategy Factory
- [ ] Add strategy validation

### Phase 3: Integration (Week 5-6)

- [ ] Create middleware wrapper
- [ ] Integrate with existing X402Service
- [ ] Add database schema and migrations
- [ ] Implement configuration API endpoints

### Phase 4: Dashboard (Week 7-8)

- [ ] Build pricing dashboard UI
- [ ] Add strategy configuration forms
- [ ] Create route mapping interface
- [ ] Implement price simulator

### Phase 5: Analytics & Polish (Week 9-10)

- [ ] Add analytics dashboard
- [ ] Implement price logging
- [ ] Add monitoring and alerts
- [ ] Documentation and testing

---

## References

### External Resources

- [x402 V2 Specification](https://www.x402.org/writing/x402-v2-launch)
- [Corbits Dynamic Pricing](https://docs.corbits.dev/examples/dynamic-pricing)
- [Faremeter GitHub](https://github.com/faremeter/faremeter)
- [Coinbase x402 GitHub](https://github.com/coinbase/x402)

### Internal Documentation

- [X402_DEFERRED_SCHEME.md](./X402_DEFERRED_SCHEME.md) - Deferred payments
- [MULTI_CHAIN_GUIDE.md](./MULTI_CHAIN_GUIDE.md) - Network configuration
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Database setup

---

## Appendix A: Example Configurations

### Fixed Pricing Config

```json
{
  "name": "default-fixed",
  "strategyType": "fixed",
  "enabled": true,
  "parameters": {
    "type": "fixed",
    "price": "1000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "network": "base-sepolia"
  },
  "routePatterns": ["/api/*"],
  "priority": 0
}
```

### Tiered Pricing Config

```json
{
  "name": "api-tiered",
  "strategyType": "tiered",
  "enabled": true,
  "parameters": {
    "type": "tiered",
    "tiers": [
      { "name": "Free", "upTo": 100, "pricePerRequest": "0", "discount": 100 },
      { "name": "Basic", "upTo": 1000, "pricePerRequest": "500", "discount": 50 },
      { "name": "Standard", "upTo": 10000, "pricePerRequest": "1000", "discount": 0 },
      { "name": "Volume", "upTo": "unlimited", "pricePerRequest": "800", "discount": 20 }
    ],
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "network": "base-sepolia",
    "resetPeriod": 2592000
  },
  "routePatterns": ["/api/premium/*"],
  "priority": 10
}
```

### Usage-Based Config (AI/LLM)

```json
{
  "name": "llm-usage",
  "strategyType": "usage-based",
  "enabled": true,
  "parameters": {
    "type": "usage-based",
    "pricePerUnit": "10",
    "unit": "per-token",
    "minimumCharge": "100",
    "maximumCharge": "1000000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "network": "base-sepolia"
  },
  "routePatterns": ["/api/ai/*", "/api/llm/*"],
  "priority": 20
}
```

---

*Document generated for PerkOS-Stack Dynamic Pricing Implementation*
