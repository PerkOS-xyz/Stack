/**
 * Pricing Service
 *
 * Core service for calculating dynamic prices based on vendor configurations.
 * Handles strategy selection, caching, and logging.
 *
 * Vendor-centric design: Each vendor defines their pricing strategy,
 * and PerkOS facilitates the price calculation and transaction.
 */

import { supabaseAdmin } from "@/lib/db/supabase";
import { logger } from "@/lib/utils/logger";
import { StrategyFactory } from "./strategies";
import { PriceCache, getDefaultCache } from "./price-cache";
import type {
  PricingContext,
  PriceResult,
  PricingServiceConfig,
  PricingStrategy,
  VendorPricingConfig,
  VendorContext,
  EndpointContext,
  UserContext,
  PriceCalculationLog,
  PricingAnalytics,
  FixedPricingParams,
} from "@/lib/types/pricing";
import type { Address } from "@/lib/types/x402";
import type { Database, Json } from "@/lib/db/types";

type Vendor = Database["public"]["Tables"]["perkos_vendors"]["Row"];
type VendorEndpoint = Database["public"]["Tables"]["perkos_vendor_endpoints"]["Row"];

// Default USDC addresses by network
const USDC_ADDRESSES: Record<string, Address> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "avalanche": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
};

export class PricingService {
  private config: PricingServiceConfig;
  private cache: PriceCache;
  private strategyCache: Map<string, PricingStrategy>;

  constructor(config?: Partial<PricingServiceConfig>) {
    this.config = {
      cache: {
        enabled: true,
        ttlSeconds: 300, // 5 minutes
      },
      enableLogging: true,
      usdcDecimals: 6,
      fallbackNetwork: "base-sepolia",
      ...config,
    };

    this.cache = getDefaultCache(this.config.cache);
    this.strategyCache = new Map();
  }

  /**
   * Calculate price for a vendor endpoint.
   * Main entry point for price calculations.
   */
  async calculatePrice(context: PricingContext): Promise<PriceResult> {
    const startTime = Date.now();
    let cacheHit = false;

    try {
      // Get or create strategy for this vendor/endpoint
      const strategy = await this.getStrategy(context);

      // Generate cache key
      const cacheKey = strategy.generateCacheKey(context);

      // Check cache first (idempotency)
      const cachedPrice = await this.cache.get(cacheKey);
      if (cachedPrice) {
        cacheHit = true;
        cachedPrice.cacheKey = cacheKey;

        await this.logCalculation(
          context,
          cachedPrice,
          strategy.type,
          cacheHit,
          Date.now() - startTime
        );

        return cachedPrice;
      }

      // Calculate price using strategy
      const price = await strategy.calculatePrice(context);
      price.cacheKey = cacheKey;

      // Store in cache
      const ttl = context.vendor.pricingConfig?.cache?.ttlSeconds ??
        this.config.cache.ttlSeconds;
      await this.cache.set(cacheKey, price, ttl);

      // Log calculation
      await this.logCalculation(
        context,
        price,
        strategy.type,
        cacheHit,
        Date.now() - startTime
      );

      return price;

    } catch (error) {
      logger.error("Price calculation failed", {
        vendorId: context.vendor.id,
        endpointPath: context.endpoint.path,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Return fallback price if configured
      if (this.config.fallbackPrice) {
        return this.buildFallbackPrice(context);
      }

      throw error;
    }
  }

  /**
   * Calculate price from vendor ID and endpoint path.
   * Convenience method that builds context internally.
   */
  async calculatePriceForEndpoint(
    vendorId: string,
    endpointPath: string,
    options?: {
      method?: string;
      userAddress?: Address;
      body?: unknown;
      query?: Record<string, string>;
      headers?: Record<string, string>;
    }
  ): Promise<PriceResult> {
    // Fetch vendor and endpoint
    const { vendor, endpoint } = await this.fetchVendorAndEndpoint(
      vendorId,
      endpointPath,
      options?.method
    );

    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointPath} for vendor ${vendorId}`);
    }

    // Build context
    const context = await this.buildContext(vendor, endpoint, options);

    return this.calculatePrice(context);
  }

  /**
   * Verify that a price is still valid.
   * Used during payment verification to ensure price hasn't changed.
   */
  async verifyPrice(
    cacheKey: string,
    paidAmount: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const cachedPrice = await this.cache.get(cacheKey);

    if (!cachedPrice) {
      return {
        valid: false,
        reason: "Price expired or not found. Please request a new quote.",
      };
    }

    const paid = BigInt(paidAmount);
    const required = BigInt(cachedPrice.amount);

    if (paid < required) {
      return {
        valid: false,
        reason: `Insufficient payment. Required: ${cachedPrice.amount}, Paid: ${paidAmount}`,
      };
    }

    return { valid: true };
  }

  /**
   * Invalidate cached prices for a vendor.
   * Call when vendor pricing config changes.
   */
  async invalidateVendorPrices(vendorId: string): Promise<void> {
    // Clear strategy cache
    for (const key of this.strategyCache.keys()) {
      if (key.startsWith(vendorId)) {
        this.strategyCache.delete(key);
      }
    }

    // Clear price cache
    await this.cache.clearVendor(vendorId);

    logger.info("Invalidated prices for vendor", { vendorId });
  }

  /**
   * Get pricing analytics for a vendor
   */
  async getAnalytics(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PricingAnalytics> {
    const { data, error } = await supabaseAdmin
      .from("perkos_price_calculations")
      .select("*")
      .eq("vendor_id", vendorId)
      .gte("timestamp", startDate.toISOString())
      .lte("timestamp", endDate.toISOString());

    if (error || !data || data.length === 0) {
      return {
        totalCalculations: 0,
        cacheHitRate: 0,
        avgCalculationTime: 0,
        revenueByStrategy: {},
        calculationsByStrategy: {},
        priceDistribution: [],
      };
    }

    const total = data.length;
    const cacheHits = data.filter((d) => d.cache_hit).length;
    const avgTime =
      data.reduce((sum, d) => sum + (d.duration_ms || 0), 0) / total;

    // Group by strategy
    const byStrategy = data.reduce(
      (acc, d) => {
        const strategy = d.strategy || "fixed";
        acc.calculations[strategy] = (acc.calculations[strategy] || 0) + 1;
        acc.revenue[strategy] = (
          BigInt(acc.revenue[strategy] || "0") + BigInt(d.amount || "0")
        ).toString();
        return acc;
      },
      {
        calculations: {} as Record<string, number>,
        revenue: {} as Record<string, string>,
      }
    );

    return {
      totalCalculations: total,
      cacheHitRate: cacheHits / total,
      avgCalculationTime: avgTime,
      revenueByStrategy: byStrategy.revenue,
      calculationsByStrategy: byStrategy.calculations,
      priceDistribution: this.calculatePriceDistribution(data),
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // ============ Private Methods ============

  /**
   * Get or create pricing strategy for context
   */
  private async getStrategy(context: PricingContext): Promise<PricingStrategy> {
    // Check endpoint-level override first
    const endpointConfig = context.endpoint.pricingConfig;
    const vendorConfig = context.vendor.pricingConfig;

    // Build effective config (endpoint overrides vendor)
    let effectiveConfig: VendorPricingConfig;

    if (vendorConfig) {
      effectiveConfig = {
        ...vendorConfig,
        // Apply endpoint overrides if present
        ...(endpointConfig?.strategyType && {
          strategyType: endpointConfig.strategyType,
        }),
        parameters: {
          ...vendorConfig.parameters,
          ...(endpointConfig?.parameters || {}),
        } as VendorPricingConfig["parameters"],
      };
    } else {
      // No vendor config - build default fixed pricing from endpoint price
      effectiveConfig = this.buildDefaultConfig(context);
    }

    // Check strategy cache
    const cacheKey = `${context.vendor.id}:${context.endpoint.id}:${effectiveConfig.strategyType}`;
    let strategy = this.strategyCache.get(cacheKey);

    if (!strategy) {
      strategy = StrategyFactory.create(effectiveConfig, this.config.usdcDecimals);
      this.strategyCache.set(cacheKey, strategy);
    }

    return strategy;
  }

  /**
   * Build default fixed pricing config from endpoint data
   */
  private buildDefaultConfig(context: PricingContext): VendorPricingConfig {
    const network = context.vendor.network || this.config.fallbackNetwork || "base-sepolia";
    const asset = (context.vendor.asset as Address) ||
      USDC_ADDRESSES[network] ||
      this.config.fallbackAsset ||
      USDC_ADDRESSES["base-sepolia"];

    // Convert USD price to atomic units
    const priceUsd = context.endpoint.priceUsd || "0.01";
    const priceAtomicUnits = this.usdToAtomicUnits(priceUsd);

    const params: FixedPricingParams = {
      type: "fixed",
      price: priceAtomicUnits,
      asset,
      network,
    };

    return {
      id: `default-${context.vendor.id}-${context.endpoint.id}`,
      vendorId: context.vendor.id,
      strategyType: "fixed",
      name: "Default Fixed Pricing",
      isDefault: true,
      parameters: params,
      cache: this.config.cache,
      priority: 0,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build fallback price result
   */
  private buildFallbackPrice(context: PricingContext): PriceResult {
    const network = context.vendor.network || this.config.fallbackNetwork || "base-sepolia";
    const asset = this.config.fallbackAsset || USDC_ADDRESSES[network];
    const amount = this.config.fallbackPrice || "10000"; // 0.01 USDC

    return {
      amount,
      asset,
      network,
      breakdown: [
        {
          component: "Fallback Price",
          amount,
          description: "Default pricing (actual calculation failed)",
          percentage: 100,
        },
      ],
      validUntil: Math.floor(Date.now() / 1000) + 300,
    };
  }

  /**
   * Fetch vendor and endpoint from database
   */
  private async fetchVendorAndEndpoint(
    vendorId: string,
    endpointPath: string,
    method?: string
  ): Promise<{ vendor: Vendor | null; endpoint: VendorEndpoint | null }> {
    // Fetch vendor
    const { data: vendorData } = await supabaseAdmin
      .from("perkos_vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (!vendorData) {
      return { vendor: null, endpoint: null };
    }

    // Fetch endpoint
    let endpointQuery = supabaseAdmin
      .from("perkos_vendor_endpoints")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("path", endpointPath)
      .eq("is_active", true);

    if (method) {
      endpointQuery = endpointQuery.eq("method", method);
    }

    const { data: endpointData } = await endpointQuery.single();

    return {
      vendor: vendorData as Vendor,
      endpoint: endpointData as VendorEndpoint | null,
    };
  }

  /**
   * Build pricing context from vendor/endpoint data
   */
  private async buildContext(
    vendor: Vendor,
    endpoint: VendorEndpoint,
    options?: {
      method?: string;
      userAddress?: Address;
      body?: unknown;
      query?: Record<string, string>;
      headers?: Record<string, string>;
    }
  ): Promise<PricingContext> {
    // Build vendor context
    const vendorContext: VendorContext = {
      id: vendor.id,
      name: vendor.name,
      walletAddress: vendor.wallet_address as Address,
      network: vendor.network,
      chainId: vendor.chain_id,
      asset: vendor.asset,
      basePriceUsd: vendor.price_usd,
      pricingConfig: await this.fetchVendorPricingConfig(vendor.id),
    };

    // Build endpoint context
    const endpointContext: EndpointContext = {
      id: endpoint.id,
      path: endpoint.path,
      method: endpoint.method,
      priceUsd: endpoint.price_usd,
      pricingConfig: null, // TODO: Add pricing_config to endpoint table
    };

    // Build user context if address provided
    let userContext: UserContext | undefined;
    if (options?.userAddress) {
      userContext = await this.fetchUserContext(
        vendor.id,
        options.userAddress
      );
    }

    return {
      request: {
        method: (options?.method || endpoint.method || "GET") as PricingContext["request"]["method"],
        path: endpoint.path,
        headers: options?.headers || {},
        query: options?.query || {},
        body: options?.body,
        contentLength: options?.body
          ? JSON.stringify(options.body).length
          : undefined,
      },
      vendor: vendorContext,
      endpoint: endpointContext,
      user: userContext,
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch vendor's pricing configuration
   */
  private async fetchVendorPricingConfig(
    vendorId: string
  ): Promise<VendorPricingConfig | null> {
    const { data } = await supabaseAdmin
      .from("perkos_vendor_pricing_configs")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("enabled", true)
      .eq("is_default", true)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      vendorId: data.vendor_id,
      strategyType: data.strategy_type as VendorPricingConfig["strategyType"],
      name: data.name,
      isDefault: data.is_default,
      parameters: data.parameters as VendorPricingConfig["parameters"],
      cache: data.cache_config as VendorPricingConfig["cache"],
      routePatterns: data.route_patterns,
      priority: data.priority,
      enabled: data.enabled,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Fetch user context (tier, usage, subscription)
   */
  private async fetchUserContext(
    vendorId: string,
    userAddress: Address
  ): Promise<UserContext> {
    // Fetch user tier for this vendor
    const { data: tierData } = await supabaseAdmin
      .from("perkos_vendor_user_tiers")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("user_address", userAddress)
      .single();

    const context: UserContext = {
      address: userAddress,
      tier: "free",
    };

    if (tierData) {
      context.tier = tierData.tier as UserContext["tier"];
      context.usage = {
        requestCount: tierData.request_count,
        totalVolume: tierData.total_volume,
        periodStart: new Date(tierData.period_start).getTime(),
        periodEnd: new Date(tierData.period_end).getTime(),
      };

      // Fetch subscription if present
      if (tierData.subscription_id) {
        const { data: subData } = await supabaseAdmin
          .from("perkos_vendor_user_subscriptions")
          .select("*")
          .eq("id", tierData.subscription_id)
          .eq("status", "active")
          .single();

        if (subData) {
          context.subscription = {
            active: true,
            planId: subData.plan_id,
            tierName: subData.plan_id, // TODO: Fetch plan name
            remainingCredits: subData.remaining_credits ?? undefined,
            expiresAt: subData.expires_at
              ? new Date(subData.expires_at).getTime()
              : undefined,
          };
        }
      }
    }

    return context;
  }

  /**
   * Log price calculation to database
   */
  private async logCalculation(
    context: PricingContext,
    price: PriceResult,
    strategy: string,
    cacheHit: boolean,
    durationMs: number
  ): Promise<void> {
    if (!this.config.enableLogging) return;

    try {
      await supabaseAdmin.from("perkos_price_calculations").insert({
        vendor_id: context.vendor.id,
        endpoint_id: context.endpoint.id,
        strategy,
        path: context.request.path,
        method: context.request.method,
        user_address: context.user?.address || null,
        amount: price.amount,
        asset: price.asset,
        network: price.network,
        cache_hit: cacheHit,
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
      } as never);
    } catch (error) {
      // Don't fail the request if logging fails
      logger.warn("Failed to log price calculation", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Convert USD string to atomic units
   */
  private usdToAtomicUnits(usdAmount: string): string {
    const parts = usdAmount.split(".");
    const integerPart = parts[0] || "0";
    const fractionalPart = (parts[1] || "")
      .padEnd(this.config.usdcDecimals, "0")
      .slice(0, this.config.usdcDecimals);

    return BigInt(integerPart + fractionalPart).toString();
  }

  /**
   * Calculate price distribution for analytics
   */
  private calculatePriceDistribution(
    data: { amount: string }[]
  ): PricingAnalytics["priceDistribution"] {
    if (data.length === 0) return [];

    // Define buckets (in atomic units)
    const buckets = [
      { start: "0", end: "1000" }, // 0 - 0.001 USDC
      { start: "1000", end: "10000" }, // 0.001 - 0.01 USDC
      { start: "10000", end: "100000" }, // 0.01 - 0.1 USDC
      { start: "100000", end: "1000000" }, // 0.1 - 1 USDC
      { start: "1000000", end: "10000000" }, // 1 - 10 USDC
    ];

    const counts = buckets.map((bucket) => {
      const start = BigInt(bucket.start);
      const end = BigInt(bucket.end);
      return data.filter((d) => {
        const amount = BigInt(d.amount || "0");
        return amount >= start && amount < end;
      }).length;
    });

    return buckets.map((bucket, i) => ({
      rangeStart: bucket.start,
      rangeEnd: bucket.end,
      count: counts[i],
      percentage: (counts[i] / data.length) * 100,
    }));
  }
}

// Singleton instance
let pricingServiceInstance: PricingService | null = null;

/**
 * Get the singleton pricing service instance
 */
export function getPricingService(
  config?: Partial<PricingServiceConfig>
): PricingService {
  if (!pricingServiceInstance) {
    pricingServiceInstance = new PricingService(config);
  }
  return pricingServiceInstance;
}

/**
 * Reset the pricing service (for testing)
 */
export function resetPricingService(): void {
  pricingServiceInstance = null;
}
