/**
 * Pricing Strategies Index
 *
 * Re-exports all pricing strategies and the strategy factory.
 */

export { BasePricingStrategy } from "./base-strategy";
export { FixedPricingStrategy } from "./fixed-strategy";
export { TieredPricingStrategy } from "./tiered-strategy";
export { UsageBasedPricingStrategy } from "./usage-based-strategy";

// Strategy Factory
import type {
  PricingStrategy,
  PricingStrategyType,
  VendorPricingConfig,
} from "@/lib/types/pricing";
import { FixedPricingStrategy } from "./fixed-strategy";
import { TieredPricingStrategy } from "./tiered-strategy";
import { UsageBasedPricingStrategy } from "./usage-based-strategy";

type StrategyConstructor = new (
  config: VendorPricingConfig,
  decimals?: number
) => PricingStrategy;

/**
 * Factory for creating pricing strategy instances.
 * Supports registration of custom strategies.
 */
export class StrategyFactory {
  private static strategies: Map<PricingStrategyType, StrategyConstructor> =
    new Map<PricingStrategyType, StrategyConstructor>([
      ["fixed", FixedPricingStrategy as StrategyConstructor],
      ["tiered", TieredPricingStrategy as StrategyConstructor],
      ["usage-based", UsageBasedPricingStrategy as StrategyConstructor],
      // TODO: Add more strategies
      // ["time-bucket", TimeBucketPricingStrategy],
      // ["auction", AuctionPricingStrategy],
      // ["subscription", SubscriptionPricingStrategy],
    ]);

  /**
   * Create a strategy instance from configuration
   */
  static create(
    config: VendorPricingConfig,
    decimals: number = 6
  ): PricingStrategy {
    const StrategyClass = this.strategies.get(config.strategyType);

    if (!StrategyClass) {
      throw new Error(
        `Unknown pricing strategy type: ${config.strategyType}. ` +
          `Available: ${this.getAvailableStrategies().join(", ")}`
      );
    }

    const strategy = new StrategyClass(config, decimals);

    // Validate configuration
    const validation = strategy.validate();
    if (!validation.valid) {
      throw new Error(
        `Invalid strategy configuration for ${config.strategyType}: ` +
          `${validation.errors?.join(", ")}`
      );
    }

    return strategy;
  }

  /**
   * Register a custom strategy type
   */
  static register(
    type: PricingStrategyType,
    strategyClass: StrategyConstructor
  ): void {
    this.strategies.set(type, strategyClass);
  }

  /**
   * Get list of available strategy types
   */
  static getAvailableStrategies(): PricingStrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy type is supported
   */
  static isSupported(type: PricingStrategyType): boolean {
    return this.strategies.has(type);
  }
}
