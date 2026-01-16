"use client";

import { useEffect, useRef } from "react";
import { useWalletContext } from "@/lib/wallet/client";

/**
 * Hook to check and initialize user subscription on login
 *
 * This hook monitors wallet connection and ensures users have a subscription.
 * If no subscription exists, a free tier subscription is automatically created.
 */
export function useSubscriptionCheck() {
  const { isConnected, address } = useWalletContext();

  // Track if we've already checked for this address to prevent duplicate calls
  const checkedAddressRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    async function checkAndInitializeSubscription() {
      // Only check when connected and we have an address
      if (!isConnected || !address) {
        checkedAddressRef.current = null;
        return;
      }

      // Skip if we've already checked this address or are currently checking
      if (checkedAddressRef.current === address.toLowerCase() || isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;

      try {
        // Check current subscription status
        const response = await fetch(`/api/subscription?address=${address}`);

        if (response.ok) {
          const data = await response.json();

          // If user has no subscription or is on free tier with no record, ensure one exists
          if (!data.subscription) {
            // Initialize a free subscription for the user
            await fetch("/api/subscription/init", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address: address,
              }),
            });

            console.log("[Subscription] Initialized free subscription for new user");
          } else {
            console.log(`[Subscription] User has ${data.tier} tier subscription`);
          }
        }

        // Mark this address as checked
        checkedAddressRef.current = address.toLowerCase();
      } catch (error) {
        console.error("[Subscription] Error checking subscription:", error);
      } finally {
        isCheckingRef.current = false;
      }
    }

    checkAndInitializeSubscription();
  }, [isConnected, address]);

  return null;
}

export default useSubscriptionCheck;
