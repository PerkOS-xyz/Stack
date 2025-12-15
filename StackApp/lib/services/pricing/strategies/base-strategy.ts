/**
 * Base Pricing Strategy
 *
 * Abstract base class that all pricing strategies extend.
 * Provides common functionality for cache key generation,
 * price formatting, and validation.
 */

import { createHash } from "crypto";
import type {
  PricingStrategy,
  PricingStrategyType,
  PricingContext,
  PriceResult,
  PriceDisplay,
  ValidationResult,
  VendorPricingConfig,
  StrategyParameters,
} from "@/lib/types/pricing";
import type { Address } from "@/lib/types/x402";

// Common asset symbols mapping
const ASSET_SYMBOLS: Record<string, string> = {
  // USDC addresses across networks
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e": "USDC", // Base Sepolia
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC", // Base Mainnet
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC", // Ethereum Mainnet
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": "USDC", // Polygon
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC", // Arbitrum
  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85": "USDC", // Optimism
  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E": "USDC", // Avalanche
};

export abstract class BasePricingStrategy implements PricingStrategy {
  abstract readonly name: string;
  abstract readonly type: PricingStrategyType;

  protected config: VendorPricingConfig;
  protected decimals: number;

  constructor(config: VendorPricingConfig, decimals: number = 6) {
    this.config = config;
    this.decimals = decimals;
  }

  /**
   * Calculate price - must be implemented by subclasses
   */
  abstract calculatePrice(context: PricingContext): Promise<PriceResult>;

  /**
   * Generate deterministic cache key for idempotency.
   * Same request characteristics MUST produce same cache key.
   */
  generateCacheKey(context: PricingContext): string {
    const keyComponents = {
      // Strategy identification
      strategy: this.type,
      configId: this.config.id,

      // Request identification
      method: context.request.method,
      path: context.request.path,
      query: this.sortObject(context.request.query),
      bodyHash: context.request.body
        ? this.hashObject(context.request.body)
        : null,

      // Vendor/endpoint identification
      vendorId: context.vendor.id,
      endpointId: context.endpoint.id,

      // User identification (for tiered pricing)
      user: context.user?.address || "anonymous",
    };

    const keyString = JSON.stringify(keyComponents);
    return createHash("sha256").update(keyString).digest("hex").slice(0, 32);
  }

  /**
   * Validate strategy configuration - base validation.
   * Subclasses should call super.validate() and add their own checks.
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.config.parameters) {
      errors.push("Strategy parameters are required");
    }

    if (!this.config.vendorId) {
      errors.push("Vendor ID is required");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============ Protected Helper Methods ============

  /**
   * Get strategy parameters with type safety
   */
  protected getParams<T extends StrategyParameters>(): T {
    return this.config.parameters as T;
  }

  /**
   * Sort object keys deterministically for cache key generation
   */
  protected sortObject(
    obj: Record<string, unknown>
  ): Record<string, unknown> {
    if (!obj || typeof obj !== "object") return {};

    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as Record<string, unknown>);
  }

  /**
   * Hash an object for cache key generation
   */
  protected hashObject(obj: unknown): string {
    return createHash("sha256")
      .update(JSON.stringify(obj))
      .digest("hex")
      .slice(0, 16);
  }

  /**
   * Format price for display
   */
  protected formatPrice(
    amount: bigint,
    asset: Address,
    decimals?: number
  ): PriceDisplay {
    const dec = decimals ?? this.decimals;
    const divisor = BigInt(10 ** dec);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;

    // Format with proper decimal places
    const fractionalStr = fractionalPart.toString().padStart(dec, "0");
    const formatted = `${integerPart}.${fractionalStr}`;

    // Get symbol from asset address
    const symbol =
      ASSET_SYMBOLS[asset] || ASSET_SYMBOLS[asset.toLowerCase()] || "USDC";

    return {
      formatted,
      symbol,
      decimals: dec,
    };
  }

  /**
   * Convert USD string to atomic units
   * @param usdAmount - Amount in USD (e.g., "0.01" for 1 cent)
   * @param decimals - Token decimals (default: 6 for USDC)
   * @returns Amount in atomic units as string
   */
  protected usdToAtomicUnits(usdAmount: string, decimals?: number): string {
    const dec = decimals ?? this.decimals;
    const parts = usdAmount.split(".");
    const integerPart = parts[0] || "0";
    const fractionalPart = (parts[1] || "").padEnd(dec, "0").slice(0, dec);

    // Combine and remove leading zeros
    const atomicUnits = BigInt(integerPart + fractionalPart);
    return atomicUnits.toString();
  }

  /**
   * Convert atomic units to USD string
   */
  protected atomicUnitsToUsd(atomicUnits: string, decimals?: number): string {
    const dec = decimals ?? this.decimals;
    const amount = BigInt(atomicUnits);
    const divisor = BigInt(10 ** dec);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;

    const fractionalStr = fractionalPart.toString().padStart(dec, "0");
    return `${integerPart}.${fractionalStr}`;
  }

  /**
   * Apply percentage discount to amount
   */
  protected applyDiscount(amount: bigint, discountPercent: number): bigint {
    if (discountPercent <= 0 || discountPercent > 100) return amount;

    const multiplier = BigInt(Math.floor((100 - discountPercent) * 100));
    return (amount * multiplier) / 10000n;
  }

  /**
   * Apply multiplier to amount
   */
  protected applyMultiplier(amount: bigint, multiplier: number): bigint {
    // Use fixed-point math to avoid floating point issues
    const multiplierInt = BigInt(Math.floor(multiplier * 10000));
    return (amount * multiplierInt) / 10000n;
  }

  /**
   * Get cache TTL from config or default
   */
  protected getCacheTtl(): number {
    return this.config.cache?.ttlSeconds ?? 300; // Default 5 minutes
  }

  /**
   * Build base price result structure
   */
  protected buildPriceResult(
    amount: bigint,
    asset: Address,
    network: string,
    breakdown?: PriceResult["breakdown"]
  ): PriceResult {
    const ttl = this.getCacheTtl();

    return {
      amount: amount.toString(),
      asset,
      network,
      breakdown,
      validUntil: Math.floor(Date.now() / 1000) + ttl,
      display: this.formatPrice(amount, asset),
    };
  }
}
