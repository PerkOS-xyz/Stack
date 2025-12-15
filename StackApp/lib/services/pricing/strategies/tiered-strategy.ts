/**
 * Tiered Pricing Strategy
 *
 * Volume-based pricing where the price per request decreases
 * as the user makes more requests within a billing period.
 *
 * Example tiers:
 * - First 100 requests: $0.01 each
 * - 101-1000 requests: $0.005 each (50% discount)
 * - 1001+ requests: $0.002 each (80% discount)
 */

import { BasePricingStrategy } from "./base-strategy";
import type {
  PricingContext,
  PriceResult,
  PriceBreakdown,
  TieredPricingParams,
  PricingTier,
  ValidationResult,
} from "@/lib/types/pricing";

export class TieredPricingStrategy extends BasePricingStrategy {
  readonly name = "Tiered Pricing";
  readonly type = "tiered" as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.getParams<TieredPricingParams>();

    // Get current usage from user context
    const currentCount = context.user?.usage?.requestCount ?? 0;

    // Find applicable tier based on current request count
    const tier = this.findApplicableTier(currentCount, params.tiers);

    // Calculate price
    let amount = BigInt(tier.pricePerRequest);

    // Apply discount if configured
    if (tier.discount && tier.discount > 0) {
      amount = this.applyDiscount(amount, tier.discount);
    }

    // Build breakdown
    const breakdown: PriceBreakdown[] = [
      {
        component: `${tier.name} Tier`,
        amount: tier.pricePerRequest,
        description: `Request #${currentCount + 1}`,
        percentage: tier.discount ? 100 - tier.discount : 100,
      },
    ];

    // Add discount line if applicable
    if (tier.discount && tier.discount > 0) {
      const originalAmount = BigInt(tier.pricePerRequest);
      const discountAmount = originalAmount - amount;

      breakdown.push({
        component: "Volume Discount",
        amount: `-${discountAmount.toString()}`,
        description: `${tier.discount}% tier discount`,
        percentage: tier.discount,
      });
    }

    return this.buildPriceResult(amount, params.asset, params.network, breakdown);
  }

  /**
   * Override cache key to include current tier.
   * Price changes when user enters new tier.
   */
  override generateCacheKey(context: PricingContext): string {
    const params = this.getParams<TieredPricingParams>();
    const currentCount = context.user?.usage?.requestCount ?? 0;
    const tier = this.findApplicableTier(currentCount, params.tiers);

    // Add tier to base cache key
    const baseKey = super.generateCacheKey(context);
    return `${baseKey}:tier:${tier.name}`;
  }

  validate(): ValidationResult {
    const baseValidation = super.validate();
    const errors = [...(baseValidation.errors || [])];

    const params = this.config.parameters as TieredPricingParams;

    if (!params || params.type !== "tiered") {
      errors.push("Invalid parameters for tiered pricing strategy");
      return { valid: false, errors };
    }

    if (!params.tiers || !Array.isArray(params.tiers)) {
      errors.push("Tiers array is required");
    } else if (params.tiers.length === 0) {
      errors.push("At least one pricing tier is required");
    } else {
      // Validate each tier
      for (let i = 0; i < params.tiers.length; i++) {
        const tier = params.tiers[i];

        if (!tier.name) {
          errors.push(`Tier ${i + 1}: name is required`);
        }

        if (tier.upTo === undefined || tier.upTo === null) {
          errors.push(`Tier ${i + 1}: upTo value is required (-1 for unlimited)`);
        }

        if (!tier.pricePerRequest) {
          errors.push(`Tier ${i + 1}: pricePerRequest is required`);
        } else {
          try {
            const price = BigInt(tier.pricePerRequest);
            if (price < 0n) {
              errors.push(`Tier ${i + 1}: pricePerRequest must be non-negative`);
            }
          } catch {
            errors.push(`Tier ${i + 1}: pricePerRequest must be a valid numeric string`);
          }
        }

        if (tier.discount !== undefined) {
          if (tier.discount < 0 || tier.discount > 100) {
            errors.push(`Tier ${i + 1}: discount must be between 0 and 100`);
          }
        }
      }

      // Check tier ordering
      const sortedTiers = this.sortTiers(params.tiers);
      for (let i = 1; i < sortedTiers.length; i++) {
        const prev = sortedTiers[i - 1];
        const curr = sortedTiers[i];

        if (prev.upTo !== -1 && curr.upTo !== -1 && prev.upTo >= curr.upTo) {
          errors.push("Tier upTo values must be in ascending order");
          break;
        }
      }
    }

    if (!params.asset) {
      errors.push("Asset address is required");
    }

    if (!params.network) {
      errors.push("Network is required");
    }

    if (!params.resetPeriod || params.resetPeriod <= 0) {
      errors.push("resetPeriod must be a positive number (seconds)");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Find the applicable tier based on request count
   */
  private findApplicableTier(
    requestCount: number,
    tiers: PricingTier[]
  ): PricingTier {
    // Sort tiers by upTo value
    const sortedTiers = this.sortTiers(tiers);

    // Find the first tier where requestCount < upTo
    for (const tier of sortedTiers) {
      // -1 means unlimited
      if (tier.upTo === -1 || requestCount < tier.upTo) {
        return tier;
      }
    }

    // Fallback to last tier (should be unlimited)
    return sortedTiers[sortedTiers.length - 1];
  }

  /**
   * Sort tiers by upTo value (unlimited/-1 comes last)
   */
  private sortTiers(tiers: PricingTier[]): PricingTier[] {
    return [...tiers].sort((a, b) => {
      if (a.upTo === -1) return 1;
      if (b.upTo === -1) return -1;
      return a.upTo - b.upTo;
    });
  }
}
