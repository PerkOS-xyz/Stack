'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/lib/hooks/useSubscription';

interface RegistrationGuardProps {
  children: React.ReactNode;
  /** If true, only check registration without requiring wallet connection */
  allowDisconnected?: boolean;
  /** Custom redirect path (defaults to /plans) */
  redirectTo?: string;
  /** Show loading spinner while checking */
  showLoading?: boolean;
}

/**
 * RegistrationGuard Component
 *
 * Wraps protected pages to ensure user is registered.
 * Redirects to /plans if user is connected but not registered.
 *
 * Usage:
 * ```tsx
 * <RegistrationGuard>
 *   <YourProtectedContent />
 * </RegistrationGuard>
 * ```
 */
export function RegistrationGuard({
  children,
  allowDisconnected = false,
  redirectTo = '/plans',
  showLoading = true,
}: RegistrationGuardProps) {
  const router = useRouter();
  const { isConnected, isRegistered, isLoading } = useSubscription();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for subscription data to load
    if (isLoading) {
      return;
    }

    // If not connected and we don't allow disconnected, let the page handle it
    if (!isConnected && !allowDisconnected) {
      setIsChecking(false);
      return;
    }

    // If connected but not registered, redirect to plans
    if (isConnected && !isRegistered) {
      router.push(redirectTo);
      return;
    }

    // User is either registered or we allow disconnected users
    setIsChecking(false);
  }, [isConnected, isRegistered, isLoading, allowDisconnected, redirectTo, router]);

  // Show loading state while checking registration
  if (isLoading || isChecking) {
    if (!showLoading) {
      return null;
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500/20 border-t-cyan-400 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Checking registration status...</p>
        </div>
      </div>
    );
  }

  // If we're here and user is connected but not registered,
  // the redirect should be happening
  if (isConnected && !isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500/20 border-t-cyan-400 rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Redirecting to registration...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook for programmatic registration checking
 *
 * Use this in components where you need to check registration status
 * without the guard wrapper.
 */
export function useRegistrationGuard(redirectTo: string = '/plans') {
  const router = useRouter();
  const { isConnected, isRegistered, isLoading } = useSubscription();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!isLoading && isConnected && !isRegistered) {
      setShouldRedirect(true);
      router.push(redirectTo);
    }
  }, [isConnected, isRegistered, isLoading, redirectTo, router]);

  return {
    isLoading,
    isConnected,
    isRegistered,
    shouldRedirect,
  };
}
