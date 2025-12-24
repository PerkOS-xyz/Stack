/**
 * React Hook for ENS Name Resolution
 * Fetches and caches ENS names for Ethereum addresses using database cache
 */

import { useState, useEffect } from 'react';
import type { Address } from 'viem';

// In-memory cache for session (to reduce API calls)
const sessionCache = new Map<string, { ensName: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for session cache

/**
 * Hook to fetch ENS name for an Ethereum address
 * Uses database-backed cache to avoid rate limiting
 * @param address - Ethereum address to lookup
 * @returns Object with ensName, isLoading, and error states
 */
export function useEnsName(address: Address | null | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Check session cache first
    const cached = sessionCache.get(normalizedAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setEnsName(cached.ensName);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Use API with database caching
    fetch(`/api/ens?address=${normalizedAddress}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch ENS name');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const name = data.ensName || null;
          setEnsName(name);
          setIsLoading(false);
          // Update session cache
          sessionCache.set(normalizedAddress, { ensName: name, timestamp: Date.now() });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
          // Cache null on error to prevent repeated failed requests
          sessionCache.set(normalizedAddress, { ensName: null, timestamp: Date.now() });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { ensName, isLoading, error };
}

/**
 * Hook to fetch ENS names for multiple addresses
 * Uses batch API with database caching
 * @param addresses - Array of Ethereum addresses to lookup
 * @returns Map of address -> ENS name
 */
export function useEnsNames(addresses: Address[]) {
  const [ensNames, setEnsNames] = useState<Map<Address, string | null>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setEnsNames(new Map());
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchAllNames = async () => {
      const nameMap = new Map<Address, string | null>();
      const toFetch: Address[] = [];

      // Check session cache first
      for (const address of addresses) {
        const normalizedAddress = address.toLowerCase();
        const cached = sessionCache.get(normalizedAddress);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          nameMap.set(address, cached.ensName);
        } else {
          toFetch.push(address);
        }
      }

      // Fetch remaining from API
      if (toFetch.length > 0) {
        try {
          const response = await fetch('/api/ens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: toFetch }),
          });

          if (response.ok) {
            const data = await response.json();
            for (const [addr, ensName] of Object.entries(data.results)) {
              const originalAddr = toFetch.find((a) => a.toLowerCase() === addr) || addr as Address;
              nameMap.set(originalAddr, ensName as string | null);
              sessionCache.set(addr.toLowerCase(), {
                ensName: ensName as string | null,
                timestamp: Date.now(),
              });
            }
          }
        } catch (error) {
          console.error('Error batch fetching ENS names:', error);
          // Set null for all unfetched addresses
          for (const addr of toFetch) {
            if (!nameMap.has(addr)) {
              nameMap.set(addr, null);
            }
          }
        }
      }

      if (!cancelled) {
        setEnsNames(nameMap);
        setIsLoading(false);
      }
    };

    fetchAllNames();

    return () => {
      cancelled = true;
    };
  }, [addresses.join(',')]); // Re-fetch when addresses change

  return { ensNames, isLoading };
}
