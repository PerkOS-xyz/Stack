'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from 'react';
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";
import { WalletProvider } from "@/lib/wallet/client";

export default function WalletLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

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
