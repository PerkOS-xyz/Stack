/**
 * Stellar Wallet Types for PerkOS Stack
 *
 * Server-managed Stellar wallets that enable x402 payments
 * without requiring client-side wallet extensions.
 */

export interface StellarWallet {
  id: string;
  userId: string;
  publicKey: string;
  encryptedSecret: string;
  iv: string;
  authTag: string;

  xlmBalance: string;
  usdcBalance: string;

  autoSwap: boolean;
  spendingLimit: string;
  spent24h: string;
  lastSpendReset: number;

  createdAt: number;
  updatedAt: number;
  status: "active" | "frozen" | "closed";
}

export interface StellarTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: "deposit" | "swap" | "x402_payment" | "withdrawal";

  amount: string;
  asset: "XLM" | "USDC";

  fromAsset?: string;
  fromAmount?: string;
  toAsset?: string;
  toAmount?: string;

  stellarTxHash?: string;
  ledger?: number;

  x402Endpoint?: string;
  x402Vendor?: string;

  status: "pending" | "confirmed" | "failed";
  error?: string;
  createdAt: number;
}

export interface StellarConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  usdcContract: string;
  masterKey: string;
}

export interface SwapQuote {
  xlmAmount: string;
  usdcEstimate: string;
  rate: string;
  minUsdcOut: string;
}

export interface X402PaymentResult {
  success: boolean;
  txHash?: string;
  usdcCharged?: string;
  response?: unknown;
  error?: string;
}
