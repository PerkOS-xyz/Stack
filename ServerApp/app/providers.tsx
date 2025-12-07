'use client';

import { ThirdwebProvider } from "thirdweb/react";
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}
