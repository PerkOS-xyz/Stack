'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ParaProvider, Environment } from "@getpara/react-sdk";
import "@getpara/react-sdk/styles.css";
import type { ReactNode } from 'react';
import { celo } from "wagmi/chains";

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
  const environment = (process.env.NEXT_PUBLIC_PARA_ENV || "beta") as Environment;
  const isProduction = environment === "production";

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
          env: process.env.NODE_ENV === "production" ? "production" : "beta",
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
          oAuthMethods: ["GOOGLE", "TWITTER","DISCORD"],
          authLayout: ["EXTERNAL:FULL", "AUTH:FULL"],
          recoverySecretStepEnabled: true,
          onRampTestMode: !isProduction,
        }}

      >
        {children}
      </ParaProvider>
    </QueryClientProvider>
  );
}
