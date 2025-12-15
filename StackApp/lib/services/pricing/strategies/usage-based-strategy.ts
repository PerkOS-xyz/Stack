/**
 * Usage-Based Pricing Strategy
 *
 * Price calculated based on actual resource consumption.
 * Common for AI/LLM APIs, data transfer, compute time, etc.
 *
 * Supports various units:
 * - per-request: Fixed per API call
 * - per-token: For LLM/AI requests (estimated from body)
 * - per-byte: For data transfer
 * - per-second/minute/hour: For compute time
 */

import { BasePricingStrategy } from "./base-strategy";
import type {
  PricingContext,
  PriceResult,
  UsageBasedPricingParams,
  PricingUnit,
  ValidationResult,
} from "@/lib/types/pricing";

export class UsageBasedPricingStrategy extends BasePricingStrategy {
  readonly name = "Usage-Based Pricing";
  readonly type = "usage-based" as const;

  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const params = this.getParams<UsageBasedPricingParams>();

    // Extract usage units from request context
    const units = this.extractUnits(context, params);

    // Calculate base price
    const pricePerUnit = BigInt(params.pricePerUnit);
    let amount = pricePerUnit * BigInt(units);

    // Apply minimum charge
    if (params.minimumCharge) {
      const min = BigInt(params.minimumCharge);
      if (amount < min) {
        amount = min;
      }
    }

    // Apply maximum charge (cap)
    if (params.maximumCharge) {
      const max = BigInt(params.maximumCharge);
      if (amount > max) {
        amount = max;
      }
    }

    // Build description based on unit type
    const unitLabel = this.getUnitLabel(params.unit, units);

    return this.buildPriceResult(amount, params.asset, params.network, [
      {
        component: "Usage Charge",
        amount: amount.toString(),
        description: `${units} ${unitLabel} @ ${this.atomicUnitsToUsd(params.pricePerUnit)} per ${this.getSingularUnit(params.unit)}`,
        percentage: 100,
      },
    ]);
  }

  /**
   * Override cache key to include usage units.
   * Different payload sizes should get different prices.
   */
  override generateCacheKey(context: PricingContext): string {
    const params = this.getParams<UsageBasedPricingParams>();
    const units = this.extractUnits(context, params);

    // Add units to base cache key
    const baseKey = super.generateCacheKey(context);
    return `${baseKey}:units:${units}`;
  }

  validate(): ValidationResult {
    const baseValidation = super.validate();
    const errors = [...(baseValidation.errors || [])];

    const params = this.config.parameters as UsageBasedPricingParams;

    if (!params || params.type !== "usage-based") {
      errors.push("Invalid parameters for usage-based pricing strategy");
      return { valid: false, errors };
    }

    if (!params.pricePerUnit) {
      errors.push("pricePerUnit is required");
    } else {
      try {
        const price = BigInt(params.pricePerUnit);
        if (price < 0n) {
          errors.push("pricePerUnit must be non-negative");
        }
      } catch {
        errors.push("pricePerUnit must be a valid numeric string");
      }
    }

    if (!params.unit) {
      errors.push("unit is required");
    } else {
      const validUnits: PricingUnit[] = [
        "per-request",
        "per-token",
        "per-byte",
        "per-second",
        "per-minute",
        "per-hour",
        "per-day",
        "per-month",
      ];
      if (!validUnits.includes(params.unit)) {
        errors.push(`Invalid unit. Must be one of: ${validUnits.join(", ")}`);
      }
    }

    // Validate minimum/maximum if provided
    if (params.minimumCharge) {
      try {
        const min = BigInt(params.minimumCharge);
        if (min < 0n) {
          errors.push("minimumCharge must be non-negative");
        }
      } catch {
        errors.push("minimumCharge must be a valid numeric string");
      }
    }

    if (params.maximumCharge) {
      try {
        const max = BigInt(params.maximumCharge);
        if (max < 0n) {
          errors.push("maximumCharge must be non-negative");
        }

        // Check that max >= min
        if (params.minimumCharge) {
          const min = BigInt(params.minimumCharge);
          if (max < min) {
            errors.push("maximumCharge must be >= minimumCharge");
          }
        }
      } catch {
        errors.push("maximumCharge must be a valid numeric string");
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

  /**
   * Extract usage units from request context based on unit type
   */
  private extractUnits(
    context: PricingContext,
    params: UsageBasedPricingParams
  ): number {
    switch (params.unit) {
      case "per-request":
        // Always 1 unit per request
        return 1;

      case "per-byte":
        // Use content length from request
        return context.request.contentLength || 0;

      case "per-token":
        // Estimate tokens from request body
        return this.estimateTokens(context.request.body);

      case "per-second":
      case "per-minute":
      case "per-hour":
      case "per-day":
      case "per-month":
        // For time-based units, return 1 (actual time tracked separately)
        // This could be enhanced to estimate based on request complexity
        return 1;

      default:
        return 1;
    }
  }

  /**
   * Estimate token count from request body.
   * Uses simple heuristic: ~4 characters per token (GPT-style tokenization).
   *
   * Vendors can override with custom tokenizer via unitExtractor config.
   */
  private estimateTokens(body: unknown): number {
    if (!body) return 0;

    // Convert to string
    const text = typeof body === "string" ? body : JSON.stringify(body);

    // Extract text content if JSON with common fields
    let contentToCount = text;

    try {
      const parsed = typeof body === "object" ? body : JSON.parse(text);

      // Common LLM request fields
      if (parsed && typeof parsed === "object") {
        const textFields: string[] = [];

        // OpenAI-style
        if ("messages" in parsed && Array.isArray(parsed.messages)) {
          for (const msg of parsed.messages) {
            if (msg.content) textFields.push(String(msg.content));
          }
        }

        // Simple prompt field
        if ("prompt" in parsed) {
          textFields.push(String(parsed.prompt));
        }

        // Input field
        if ("input" in parsed) {
          textFields.push(String(parsed.input));
        }

        // Text field
        if ("text" in parsed) {
          textFields.push(String(parsed.text));
        }

        if (textFields.length > 0) {
          contentToCount = textFields.join(" ");
        }
      }
    } catch {
      // Use raw text if parsing fails
    }

    // Estimate: ~4 characters per token (conservative estimate)
    return Math.ceil(contentToCount.length / 4);
  }

  /**
   * Get plural unit label for display
   */
  private getUnitLabel(unit: PricingUnit, count: number): string {
    const singular = this.getSingularUnit(unit);
    return count === 1 ? singular : `${singular}s`;
  }

  /**
   * Get singular unit label
   */
  private getSingularUnit(unit: PricingUnit): string {
    switch (unit) {
      case "per-request":
        return "request";
      case "per-token":
        return "token";
      case "per-byte":
        return "byte";
      case "per-second":
        return "second";
      case "per-minute":
        return "minute";
      case "per-hour":
        return "hour";
      case "per-day":
        return "day";
      case "per-month":
        return "month";
      default:
        return "unit";
    }
  }
}
