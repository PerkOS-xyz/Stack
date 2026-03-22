import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { config } from "@/lib/utils/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PerkOS Stack -- Multi-Chain Payment Infrastructure for the Agentic Economy",
  description: config.facilitatorDescription,
  keywords: [
    "PerkOS",
    "Stack",
    "x402",
    "payment facilitator",
    "ERC-8004",
    "agent identity",
    "micropayments",
    "multi-chain",
    "agentic economy",
    "Web3",
    "USDC",
    "blockchain payments",
  ],
  metadataBase: new URL("https://stack.perkos.xyz"),
  openGraph: {
    type: "website",
    siteName: "PerkOS Stack",
    title: "PerkOS Stack -- Multi-Chain Payment Infrastructure",
    description: config.facilitatorDescription,
    url: "https://stack.perkos.xyz",
  },
  twitter: {
    card: "summary_large_image",
    site: "@perk_os",
    title: "PerkOS Stack",
    description: config.facilitatorDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
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
