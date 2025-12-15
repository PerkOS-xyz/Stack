/**
 * Fixed Pricing Strategy
 *
 * Simple fixed-price strategy where every request costs the same amount.
 * Most vendors will start with this strategy.
 */

import { BasePricingStrategy } from "./base-strategy";
import type {
  PricingContext,
  PriceResult,
  FixedPricingParams,
  ValidationResult,
} from "@/lib/types/pricing";

export class FixedPricingStrategy extends BasePricingStrategy {
  readonly name = "Fixed Pricing";
  readonly type = "fixed" as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.getParams<FixedPricingParams>();

    const amount = BigInt(params.price);

    return this.buildPriceResult(amount, params.asset, params.network, [
      {
        component: "Base Price",
        amount: params.price,
        description: "Fixed rate per request",
        percentage: 100,
      },
    ]);
  }

  validate(): ValidationResult {
    const baseValidation = super.validate();
    const errors = [...(baseValidation.errors || [])];

    const params = this.config.parameters as FixedPricingParams;

    if (!params || params.type !== "fixed") {
      errors.push("Invalid parameters for fixed pricing strategy");
      return { valid: false, errors };
    }

    if (!params.price) {
      errors.push("Price is required for fixed pricing");
    } else {
      try {
        const price = BigInt(params.price);
        if (price < 0n) {
          errors.push("Price must be non-negative");
        }
      } catch {
        errors.push("Price must be a valid numeric string");
      }
    }

    if (!params.asset) {
      errors.push("Asset address is required");
    }

    if (!params.network) {
      errors.push("Network is required");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
