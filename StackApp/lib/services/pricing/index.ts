/**
 * Pricing Module Index
 *
 * Main exports for the dynamic pricing system.
 */

// Core service
export { PricingService, getPricingService, resetPricingService } from "./pricing-service";

// Cache
export { PriceCache, getDefaultCache, resetDefaultCache } from "./price-cache";

// Strategies
export {
  BasePricingStrategy,
  FixedPricingStrategy,
  TieredPricingStrategy,
  UsageBasedPricingStrategy,
  StrategyFactory,
} from "./strategies";

// Re-export types for convenience
export type {
  // Strategy types
  PricingStrategy,
  PricingStrategyType,
  PricingUnit,

  // Context types
  PricingContext,
  RequestContext,
  UserContext,
  UserTier,
  UsageHistory,
  SubscriptionStatus,
  VendorContext,
  EndpointContext,
  EnvironmentContext,

  // Result types
  PriceResult,
  PriceBreakdown,
  PriceDisplay,

  // Configuration types
  VendorPricingConfig,
  EndpointPricingConfig,
  PricingServiceConfig,
  CacheConfig,
  ValidationResult,

  // Strategy parameters
  StrategyParameters,
  FixedPricingParams,
  TieredPricingParams,
  UsageBasedPricingParams,
  TimeBucketPricingParams,
  AuctionPricingParams,
  SubscriptionPricingParams,
  CustomPricingParams,
  PricingTier,
  SubscriptionPlan,

  // User/Subscription types
  VendorUserTier,
  VendorUserSubscription,

  // Analytics types
  PriceCalculationLog,
  PricingAnalytics,
  PriceDistributionBucket,

  // API types
  CalculatePriceRequest,
  CalculatePriceResponse,
  ConfigurePricingRequest,
  ConfigurePricingResponse,
} from "@/lib/types/pricing";
