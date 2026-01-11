'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ParaProvider, Environment } from "@getpara/react-sdk";
import "@getpara/react-sdk/styles.css";
import type { ReactNode } from 'react';
import { celo } from "wagmi/chains";
import { SubscriptionProvider } from "@/lib/contexts/SubscriptionContext";

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

  const paraApiKey = process.env.NEXT_PUBLIC_PARA_API_KEY;
  const isProduction = process.env.NODE_ENV === "production";

  // Always provide QueryClient for hooks that depend on it
  if (!paraApiKey) {
    console.warn("NEXT_PUBLIC_PARA_API_KEY not configured - wallet features disabled");
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        paraClientConfig={{
          apiKey: paraApiKey,
          env: process.env.NODE_ENV === "production" ? Environment.PRODUCTION : Environment.BETA,
        }}
        config={{
          appName: "PerkOS Stack",
        }}
        externalWalletConfig={{
          wallets: ["METAMASK","PHANTOM"],
          evmConnector: {
            config: {
              chains: [celo],
            },
          },
          walletConnect: {
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
          },
        }}
        paraModalConfig={{
          logo: "https://stack.perkos.xyz/logo.png",
          theme: {"backgroundColor":"#090b0e","foregroundColor":"#f3ebeb","accentColor":"#4e6edf"},
          oAuthMethods: ["GOOGLE", "TWITTER","DISCORD"],
          authLayout: ["EXTERNAL:FULL", "AUTH:FULL"],
          recoverySecretStepEnabled: true,
          onRampTestMode: !isProduction,
        }}

      >
        <SubscriptionProvider>
          {children}
        </SubscriptionProvider>
      </ParaProvider>
    </QueryClientProvider>
  );
}
