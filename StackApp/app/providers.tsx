'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from 'react';
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { WalletProvider, ACTIVE_PROVIDER } from "@/lib/wallet/client";

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient inside component to avoid SSR/hydration issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  console.log("[Providers] Active wallet provider:", ACTIVE_PROVIDER);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
