/**
 * Price Cache
 *
 * In-memory cache for price calculations to ensure idempotency.
 * Same request characteristics MUST return same price within TTL.
 *
 * Critical for x402 compliance:
 * "The generated payment requirements MUST be idempotent
 * (i.e., the same requirements must be sent if the request is the same)."
 */

import type { PriceResult, CacheConfig } from "@/lib/types/pricing";

interface CacheEntry {
  price: PriceResult;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class PriceCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: { hits: number; misses: number };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };

    // Start periodic cleanup if caching is enabled
    if (config.enabled) {
      this.startCleanupInterval();
    }
  }

  /**
   * Get cached price by key
   * @returns Price result if found and not expired, null otherwise
   */
  async get(key: string): Promise<PriceResult | null> {
    if (!this.config.enabled) {
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.price;
  }

  /**
   * Store price in cache
   * @param key - Cache key (from strategy.generateCacheKey)
   * @param price - Price result to cache
   * @param ttlSeconds - Optional TTL override
   */
  async set(
    key: string,
    price: PriceResult,
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.config.enabled) return;

    const ttl = ttlSeconds ?? this.config.ttlSeconds;
    const now = Date.now();

    this.cache.set(key, {
      price,
      expiresAt: now + ttl * 1000,
      createdAt: now,
    });
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Clear cache entries for a specific vendor
   */
  async clearVendor(vendorId: string): Promise<number> {
    let cleared = 0;

    for (const key of this.cache.keys()) {
      // Cache keys include vendorId in the hash, but we can't easily
      // extract it. For now, clear all entries that might be affected.
      // In production, consider adding vendorId prefix to keys.
      if (key.includes(vendorId)) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Check if a key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get remaining TTL for a key in seconds
   */
  async getTtl(key: string): Promise<number | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const remainingMs = entry.expiresAt - Date.now();
    if (remainingMs <= 0) {
      this.cache.delete(key);
      return null;
    }

    return Math.ceil(remainingMs / 1000);
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    // Don't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[PriceCache] Cleaned ${cleaned} expired entries`);
    }
  }
}

// Singleton instance with default config
let defaultCacheInstance: PriceCache | null = null;

/**
 * Get or create the default cache instance
 */
export function getDefaultCache(config?: CacheConfig): PriceCache {
  if (!defaultCacheInstance) {
    defaultCacheInstance = new PriceCache(
      config ?? {
        enabled: true,
        ttlSeconds: 300, // 5 minutes default
      }
    );
  }
  return defaultCacheInstance;
}

/**
 * Reset the default cache instance (for testing)
 */
export function resetDefaultCache(): void {
  if (defaultCacheInstance) {
    defaultCacheInstance.destroy();
    defaultCacheInstance = null;
  }
}
