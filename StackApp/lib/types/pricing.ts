/**
 * Dynamic Pricing Types for PerkOS-Stack
 *
 * Vendor-centric pricing system where each vendor defines their own
 * pricing strategy, and PerkOS facilitates the transaction.
 */

import type { Address, Hex } from "./x402";

// ============ Pricing Strategy Types ============

export type PricingStrategyType =
  | "fixed"
  | "tiered"
  | "usage-based"
  | "time-bucket"
  | "auction"
  | "subscription"
  | "custom";

export type PricingUnit =
  | "per-request"
  | "per-token"
  | "per-byte"
  | "per-second"
  | "per-minute"
  | "per-hour"
  | "per-day"
  | "per-month";

// ============ Pricing Context ============

/**
 * Context provided to pricing strategies for price calculation.
 * Built from the incoming request and vendor/user data.
 */
export interface PricingContext {
  /** HTTP request details */
  request: RequestContext;

  /** User/payer information */
  user?: UserContext;

  /** Vendor providing the service */
  vendor: VendorContext;

  /** Specific endpoint being accessed */
  endpoint: EndpointContext;

  /** Environmental factors */
  environment?: EnvironmentContext;

  /** Timestamp of pricing request */
  timestamp: number;
}

export interface RequestContext {
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

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

  /** User tier with this vendor */
  tier?: UserTier;

  /** Historical usage data with this vendor */
  usage?: UsageHistory;

  /** Reputation score */
  reputation?: number;

  /** Subscription status with this vendor */
  subscription?: SubscriptionStatus;
}

export type UserTier = "free" | "basic" | "premium" | "enterprise";

export interface UsageHistory {
  /** Total requests in current period */
  requestCount: number;

  /** Total volume in current period (atomic units) */
  totalVolume: string;

  /** Period start timestamp */
  periodStart: number;

  /** Period end timestamp */
  periodEnd: number;
}

export interface SubscriptionStatus {
  /** Is subscription active */
  active: boolean;

  /** Subscription plan ID */
  planId: string;

  /** Subscription tier name */
  tierName: string;

  /** Remaining credits (if applicable) */
  remainingCredits?: number;

  /** Expiry timestamp */
  expiresAt?: number;
}

/**
 * Vendor context - the service provider
 */
export interface VendorContext {
  /** Vendor ID */
  id: string;

  /** Vendor name */
  name: string;

  /** Vendor's wallet address (payTo) */
  walletAddress: Address;

  /** Primary network */
  network: string;

  /** Chain ID */
  chainId: number | null;

  /** Default asset (e.g., USDC address) */
  asset: string;

  /** Base price in USD (fallback) */
  basePriceUsd: string | null;

  /** Vendor's pricing configuration */
  pricingConfig: VendorPricingConfig | null;
}

/**
 * Endpoint context - specific API endpoint being accessed
 */
export interface EndpointContext {
  /** Endpoint ID */
  id: string;

  /** Endpoint path */
  path: string;

  /** HTTP method */
  method: string;

  /** Base price for this endpoint in USD */
  priceUsd: string;

  /** Endpoint-specific pricing config (overrides vendor config) */
  pricingConfig?: EndpointPricingConfig | null;
}

export interface EnvironmentContext {
  /** Current network load (0-1) */
  networkLoad?: number;

  /** Time bucket (peak/off-peak) */
  timeBucket?: "peak" | "off-peak" | "normal";

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

  /** Cache key used for idempotency */
  cacheKey?: string;
}

export interface PriceBreakdown {
  /** Component name */
  component: string;

  /** Component amount in atomic units */
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

// ============ Vendor Pricing Configuration ============

/**
 * Vendor-level pricing configuration.
 * Stored in perkos_vendor_pricing_configs table.
 */
export interface VendorPricingConfig {
  /** Config ID */
  id: string;

  /** Vendor ID */
  vendorId: string;

  /** Strategy type */
  strategyType: PricingStrategyType;

  /** Strategy name (for display) */
  name: string;

  /** Is this the default config for the vendor */
  isDefault: boolean;

  /** Strategy-specific parameters */
  parameters: StrategyParameters;

  /** Cache configuration */
  cache?: CacheConfig;

  /** Route patterns this config applies to (glob patterns) */
  routePatterns?: string[];

  /** Priority (higher = checked first) */
  priority: number;

  /** Is config enabled */
  enabled: boolean;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Endpoint-level pricing configuration override.
 * Stored in perkos_vendor_endpoints.pricing_config column.
 */
export interface EndpointPricingConfig {
  /** Strategy type (overrides vendor default) */
  strategyType?: PricingStrategyType;

  /** Strategy parameters (merged with vendor config) */
  parameters?: Partial<StrategyParameters>;

  /** Endpoint-specific cache settings */
  cache?: Partial<CacheConfig>;
}

// ============ Strategy Parameters ============

export type StrategyParameters =
  | FixedPricingParams
  | TieredPricingParams
  | UsageBasedPricingParams
  | TimeBucketPricingParams
  | AuctionPricingParams
  | SubscriptionPricingParams
  | CustomPricingParams;

export interface FixedPricingParams {
  type: "fixed";
  /** Fixed price in atomic units */
  price: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface TieredPricingParams {
  type: "tiered";
  /** Pricing tiers */
  tiers: PricingTier[];
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
  /** Reset period in seconds (default: 30 days) */
  resetPeriod: number;
}

export interface PricingTier {
  /** Tier name */
  name: string;
  /** Requests up to this count (use -1 for unlimited) */
  upTo: number;
  /** Price per request in atomic units */
  pricePerRequest: string;
  /** Discount percentage (0-100) */
  discount?: number;
}

export interface UsageBasedPricingParams {
  type: "usage-based";
  /** Base price per unit in atomic units */
  pricePerUnit: string;
  /** Unit type */
  unit: PricingUnit;
  /** Minimum charge in atomic units */
  minimumCharge?: string;
  /** Maximum charge in atomic units */
  maximumCharge?: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
  /** Custom unit extractor function name */
  unitExtractor?: string;
}

export interface TimeBucketPricingParams {
  type: "time-bucket";
  /** Base price in atomic units */
  basePrice: string;
  /** Peak hours multiplier (e.g., 1.5 = 50% more) */
  peakMultiplier: number;
  /** Off-peak hours multiplier (e.g., 0.8 = 20% less) */
  offPeakMultiplier: number;
  /** Peak hours definition (24h format, in vendor's timezone) */
  peakHours: Array<{ start: number; end: number }>;
  /** Vendor's timezone (e.g., "America/New_York") */
  timezone: string;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface AuctionPricingParams {
  type: "auction";
  /** Minimum price (floor) in atomic units */
  floorPrice: string;
  /** Maximum price (ceiling) in atomic units */
  ceilingPrice: string;
  /** Price adjustment rate (how fast price changes) */
  adjustmentRate: number;
  /** Current demand factor (0-1, updated dynamically) */
  demandFactor?: number;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

export interface SubscriptionPricingParams {
  type: "subscription";
  /** Available subscription plans */
  plans: SubscriptionPlan[];
  /** Price per request for overage (when credits exhausted) */
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
  /** Monthly price in atomic units */
  monthlyPrice: string;
  /** Included requests per month (-1 for unlimited) */
  includedRequests: number;
  /** Features list */
  features: string[];
}

export interface CustomPricingParams {
  type: "custom";
  /** Webhook URL for custom price calculation */
  calculatorEndpoint?: string;
  /** Custom parameters passed to calculator */
  customParams: Record<string, unknown>;
  /** Asset address */
  asset: Address;
  /** Network */
  network: string;
}

// ============ Cache Configuration ============

export interface CacheConfig {
  /** Enable caching for idempotency */
  enabled: boolean;
  /** TTL in seconds */
  ttlSeconds: number;
  /** Custom cache key template (uses context variables) */
  customKeyTemplate?: string;
}

// ============ Strategy Interface ============

/**
 * Interface that all pricing strategies must implement.
 */
export interface PricingStrategy {
  /** Strategy name */
  readonly name: string;

  /** Strategy type */
  readonly type: PricingStrategyType;

  /**
   * Calculate price based on context
   * @param context - Full pricing context
   * @returns Calculated price result
   */
  calculatePrice(context: PricingContext): Promise<PriceResult>;

  /**
   * Generate idempotency cache key.
   * Same request characteristics MUST produce same cache key.
   * @param context - Pricing context
   * @returns Deterministic cache key string
   */
  generateCacheKey(context: PricingContext): string;

  /**
   * Validate strategy configuration
   * @returns Validation result with any errors
   */
  validate(): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// ============ Service Configuration ============

/**
 * PricingService configuration
 */
export interface PricingServiceConfig {
  /** Global cache config (can be overridden per vendor/endpoint) */
  cache: CacheConfig;

  /** Enable price calculation logging */
  enableLogging: boolean;

  /** Fallback price if calculation fails (atomic units) */
  fallbackPrice?: string;

  /** Fallback asset address */
  fallbackAsset?: Address;

  /** Fallback network */
  fallbackNetwork?: string;

  /** Default USDC decimals for conversions */
  usdcDecimals: number;
}

// ============ User Tier & Subscription Management ============

/**
 * User tier record for a specific vendor
 */
export interface VendorUserTier {
  /** Record ID */
  id: string;

  /** Vendor ID */
  vendorId: string;

  /** User wallet address */
  userAddress: Address;

  /** Current tier */
  tier: UserTier;

  /** Request count in current period */
  requestCount: number;

  /** Total volume in current period (atomic units) */
  totalVolume: string;

  /** Period start */
  periodStart: string;

  /** Period end */
  periodEnd: string;

  /** Active subscription ID (if any) */
  subscriptionId?: string;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;
}

/**
 * User subscription record
 */
export interface VendorUserSubscription {
  /** Subscription ID */
  id: string;

  /** Vendor ID */
  vendorId: string;

  /** User wallet address */
  userAddress: Address;

  /** Plan ID */
  planId: string;

  /** Status */
  status: "active" | "expired" | "cancelled" | "pending";

  /** Remaining credits (requests) */
  remainingCredits: number | null;

  /** Subscription start */
  startedAt: string;

  /** Subscription expiry */
  expiresAt: string | null;

  /** Payment transaction hash */
  paymentTxHash: string | null;

  /** Created timestamp */
  createdAt: string;
}

// ============ Analytics Types ============

/**
 * Price calculation log entry
 */
export interface PriceCalculationLog {
  /** Log ID */
  id: string;

  /** Vendor ID */
  vendorId: string;

  /** Endpoint ID */
  endpointId?: string;

  /** Strategy used */
  strategy: PricingStrategyType;

  /** Request path */
  path: string;

  /** HTTP method */
  method: string;

  /** User address (if known) */
  userAddress?: Address;

  /** Calculated amount (atomic units) */
  amount: string;

  /** Asset address */
  asset: Address;

  /** Network */
  network: string;

  /** Was this a cache hit */
  cacheHit: boolean;

  /** Calculation duration in ms */
  durationMs: number;

  /** Timestamp */
  timestamp: string;
}

/**
 * Pricing analytics summary
 */
export interface PricingAnalytics {
  /** Total price calculations */
  totalCalculations: number;

  /** Cache hit rate (0-1) */
  cacheHitRate: number;

  /** Average calculation time (ms) */
  avgCalculationTime: number;

  /** Total revenue by strategy */
  revenueByStrategy: Record<PricingStrategyType, string>;

  /** Calculations by strategy */
  calculationsByStrategy: Record<PricingStrategyType, number>;

  /** Price distribution buckets */
  priceDistribution: PriceDistributionBucket[];
}

export interface PriceDistributionBucket {
  /** Range start (atomic units) */
  rangeStart: string;

  /** Range end (atomic units) */
  rangeEnd: string;

  /** Count in this range */
  count: number;

  /** Percentage of total */
  percentage: number;
}

// ============ API Request/Response Types ============

/**
 * Request to calculate price for a vendor endpoint
 */
export interface CalculatePriceRequest {
  /** Vendor ID */
  vendorId: string;

  /** Endpoint path */
  endpointPath: string;

  /** HTTP method */
  method?: string;

  /** User address (optional, for tiered pricing) */
  userAddress?: Address;

  /** Request body (for usage-based pricing) */
  body?: unknown;

  /** Query parameters */
  query?: Record<string, string>;
}

/**
 * Response from price calculation
 */
export interface CalculatePriceResponse {
  /** Success flag */
  success: boolean;

  /** Calculated price */
  price?: PriceResult;

  /** Error message if failed */
  error?: string;
}

/**
 * Request to configure vendor pricing
 */
export interface ConfigurePricingRequest {
  /** Vendor ID */
  vendorId: string;

  /** Strategy type */
  strategyType: PricingStrategyType;

  /** Config name */
  name: string;

  /** Strategy parameters */
  parameters: StrategyParameters;

  /** Make this the default config */
  isDefault?: boolean;

  /** Route patterns (optional) */
  routePatterns?: string[];

  /** Cache settings */
  cache?: CacheConfig;
}

/**
 * Response from configuring pricing
 */
export interface ConfigurePricingResponse {
  /** Success flag */
  success: boolean;

  /** Created/updated config */
  config?: VendorPricingConfig;

  /** Error message if failed */
  error?: string;
}
