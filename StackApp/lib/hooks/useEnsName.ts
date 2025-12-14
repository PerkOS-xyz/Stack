/**
 * React Hook for ENS Name Resolution
 * Fetches and caches ENS names for Ethereum addresses
 */

import { useState, useEffect } from 'react';
import type { Address } from 'viem';
import { getEnsName } from '@/lib/utils/ens';

/**
 * Hook to fetch ENS name for an Ethereum address
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

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getEnsName(address)
      .then((name) => {
        if (!cancelled) {
          setEnsName(name);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
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

      // Fetch all ENS names in parallel
      await Promise.all(
        addresses.map(async (address) => {
          try {
            const name = await getEnsName(address);
            nameMap.set(address, name);
          } catch (error) {
            console.error(`Error fetching ENS for ${address}:`, error);
            nameMap.set(address, null);
          }
        })
      );

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
