"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useWalletContext } from "@/lib/wallet/client";
import type { SubscriptionTier, TierConfig } from "@/lib/config/subscriptions";
import { SUBSCRIPTION_TIERS } from "@/lib/config/subscriptions";

export interface SubscriptionDetails {
  status: "active" | "trial" | "expired" | "cancelled" | null;
  startedAt: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
}

interface SubscriptionContextType {
  tier: SubscriptionTier;
  tierConfig: TierConfig | null;
  subscription: SubscriptionDetails | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  tier: "free",
  tierConfig: SUBSCRIPTION_TIERS.free,
  subscription: null,
  isLoading: false,
  error: null,
  refetch: async () => {},
});

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { isConnected, address } = useWalletContext();

  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [tierConfig, setTierConfig] = useState<TierConfig | null>(SUBSCRIPTION_TIERS.free);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last fetched address to prevent duplicate calls
  const lastFetchedAddressRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSubscription = useCallback(async (forceRefetch = false) => {
    // Reset state when disconnected
    if (!isConnected || !address) {
      setTier("free");
      setTierConfig(SUBSCRIPTION_TIERS.free);
      setSubscription(null);
      setError(null);
      lastFetchedAddressRef.current = null;
      return;
    }

    const normalizedAddress = address.toLowerCase();

    // Skip if we've already fetched for this address and not forcing refetch
    if (
      !forceRefetch &&
      lastFetchedAddressRef.current === normalizedAddress
    ) {
      return;
    }

    // Skip if already fetching
    if (isFetchingRef.current) {
      return;
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/subscription?address=${address}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - use cached value or default
          console.warn("[Subscription] Rate limited, using cached value");
          return;
        }
        throw new Error(`Failed to fetch subscription: ${response.status}`);
      }

      const data = await response.json();

      // Initialize subscription if none exists
      if (!data.subscription && !data.data) {
        // Initialize a free subscription for the user
        const initResponse = await fetch("/api/subscription/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
          signal: abortControllerRef.current.signal,
        });

        if (initResponse.ok) {
          const initData = await initResponse.json();
          if (initData.subscription?.created) {
            console.log("[Subscription] Initialized free subscription for new user");
          }
        }
        setTier("free");
        setTierConfig(SUBSCRIPTION_TIERS.free);
        setSubscription(null);
      } else {
        const tierValue = (data.data?.tier || data.tier || "free") as SubscriptionTier;
        setTier(tierValue);
        setTierConfig(SUBSCRIPTION_TIERS[tierValue] || SUBSCRIPTION_TIERS.free);

        // Extract subscription details from API response
        const subData = data.data?.subscription || data.subscription;
        if (subData) {
          setSubscription({
            status: subData.status || null,
            startedAt: subData.startedAt || null,
            expiresAt: subData.expiresAt || null,
            trialEndsAt: subData.trialEndsAt || null,
          });
        } else {
          setSubscription(null);
        }
      }

      // Mark as successfully fetched
      lastFetchedAddressRef.current = normalizedAddress;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }
      console.error("[Subscription] Error fetching subscription:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch subscription");
      // Default to free on error
      setTier("free");
      setTierConfig(SUBSCRIPTION_TIERS.free);
      setSubscription(null);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [isConnected, address]);

  // Fetch subscription when address changes
  useEffect(() => {
    fetchSubscription();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchSubscription]);

  const refetch = useCallback(async () => {
    await fetchSubscription(true);
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={{ tier, tierConfig, subscription, isLoading, error, refetch }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
