"use client";

import { useEffect, useRef } from "react";
import { useWalletContext } from "@/lib/wallet/client";

/**
 * Component that checks and initializes user subscription on wallet connection
 *
 * This component monitors wallet connection and ensures users have a subscription.
 * If no subscription exists, a free tier subscription is automatically created.
 *
 * Place this component inside the WalletProvider to access wallet hooks.
 */
export function SubscriptionChecker() {
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

          // If user has no subscription record, initialize one
          if (!data.subscription) {
            // Initialize a free subscription for the user
            const initResponse = await fetch("/api/subscription/init", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address: address,
              }),
            });

            if (initResponse.ok) {
              const initData = await initResponse.json();
              if (initData.subscription?.created) {
                console.log("[Subscription] Initialized free subscription for new user");
              }
            }
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

  // This component doesn't render anything
  return null;
}

export default SubscriptionChecker;
