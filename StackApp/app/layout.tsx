import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { config } from "@/lib/utils/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: config.facilitatorName,
  description: config.facilitatorDescription,
};

// Root layout - minimal, no wallet providers
// Wallet providers are loaded per-route group for better code splitting
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
