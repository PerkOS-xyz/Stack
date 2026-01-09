'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import type { UserSubscription, UsageSummary } from '@/lib/types/access-plans';
import type { PlanId } from '@/lib/config/access-plans';

interface SubscriptionState {
  isLoading: boolean;
  isRegistered: boolean;
  subscription: UserSubscription | null;
  usage: UsageSummary | null;
  error: string | null;
}

interface UseSubscriptionReturn extends SubscriptionState {
  /** Refresh subscription data */
  refresh: () => Promise<void>;
  /** Register the connected wallet */
  register: (planId?: PlanId) => Promise<boolean>;
  /** Check if wallet is connected */
  isConnected: boolean;
  /** Connected wallet address */
  walletAddress: string | null;
}

/**
 * Hook to manage user subscription status
 *
 * Checks if the connected wallet is registered and fetches subscription details.
 * Use this hook to determine if a user needs to be redirected to the plans page.
 */
export function useSubscription(): UseSubscriptionReturn {
  const account = useActiveAccount();
  const walletAddress = account?.address ?? null;
  const isConnected = !!account;

  const [state, setState] = useState<SubscriptionState>({
    isLoading: false,
    isRegistered: false,
    subscription: null,
    usage: null,
    error: null,
  });

  const fetchSubscription = useCallback(async () => {
    if (!walletAddress) {
      setState({
        isLoading: false,
        isRegistered: false,
        subscription: null,
        usage: null,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/v2/access/status?walletAddress=${walletAddress}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setState({
          isLoading: false,
          isRegistered: data.isRegistered,
          subscription: data.subscription || null,
          usage: data.usage || null,
          error: null,
        });
      } else {
        setState({
          isLoading: false,
          isRegistered: false,
          subscription: null,
          usage: null,
          error: data.error || 'Failed to fetch subscription status',
        });
      }
    } catch (error) {
      setState({
        isLoading: false,
        isRegistered: false,
        subscription: null,
        usage: null,
        error: error instanceof Error ? error.message : 'Network error',
      });
    }
  }, [walletAddress]);

  const register = useCallback(async (planId: PlanId = 'free'): Promise<boolean> => {
    if (!walletAddress) {
      setState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/v2/access/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, planId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setState({
          isLoading: false,
          isRegistered: true,
          subscription: data.subscription || null,
          usage: null,
          error: null,
        });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Registration failed',
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Network error',
      }));
      return false;
    }
  }, [walletAddress]);

  // Fetch subscription when wallet connects/changes
  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchSubscription();
    }
  }, [isConnected, walletAddress, fetchSubscription]);

  return {
    ...state,
    refresh: fetchSubscription,
    register,
    isConnected,
    walletAddress,
  };
}
