/**
 * Wallet Abstraction Layer - Server-Side Exports
 *
 * Use this import ONLY in server-side code (API routes, server actions).
 * For client-side usage, import from "@/lib/wallet/client" instead.
 *
 * IMPORTANT: This file imports Node.js-only modules and CANNOT be used
 * in browser/client-side code.
 *
 * @example
 * ```ts
 * // In API routes or server actions
 * import { getServerWalletService } from "@/lib/wallet/server";
 *
 * const walletService = getServerWalletService();
 * const wallet = await walletService.createWallet(userId, "evm");
 * const signer = await walletService.getSigner(wallet.walletId, rpcUrl, wallet.keyMaterial);
 * ```
 */

import { ACTIVE_PROVIDER } from "./config";
import type { IServerWalletService } from "./interfaces";

// Lazy-loaded server services to prevent bundling in client code
let paraServerService: IServerWalletService | null = null;
let dynamicServerService: IServerWalletService | null = null;

/**
 * Gets the Para server wallet service
 * Lazy-loaded to prevent bundling native modules
 */
async function getParaServerServiceAsync(): Promise<IServerWalletService> {
  if (!paraServerService) {
    const { getParaServerService } = await import("./providers/para/ParaServerService");
    paraServerService = getParaServerService();
  }
  return paraServerService;
}

/**
 * Gets the Dynamic server wallet service
 * Lazy-loaded to prevent bundling native modules
 */
async function getDynamicServerServiceAsync(): Promise<IServerWalletService> {
  if (!dynamicServerService) {
    const { getDynamicServerService } = await import("./providers/dynamic/DynamicServerService");
    dynamicServerService = getDynamicServerService();
  }
  return dynamicServerService;
}

/**
 * Gets the server wallet service for the active provider (async)
 *
 * The provider is selected based on NEXT_PUBLIC_WALLET_PROVIDER environment variable.
 * Uses dynamic imports to prevent native Node.js modules from being bundled in client code.
 *
 * @example
 * const walletService = await getServerWalletService();
 * const wallet = await walletService.createWallet(userId, "evm");
 */
export async function getServerWalletService(): Promise<IServerWalletService> {
  switch (ACTIVE_PROVIDER) {
    case "para":
      return getParaServerServiceAsync();

    case "dynamic":
      return getDynamicServerServiceAsync();

    case "privy":
      throw new Error("Privy server wallet service not yet implemented");

    default:
      throw new Error(`Unknown wallet provider: ${ACTIVE_PROVIDER}`);
  }
}

/**
 * Para Server Service - direct access (use with caution)
 * Prefer using getServerWalletService() for provider-agnostic code.
 */
export { ParaServerService, getParaServerService } from "./providers/para/ParaServerService";

/**
 * Dynamic Server Service - direct access (use with caution)
 * Prefer using getServerWalletService() for provider-agnostic code.
 */
export { DynamicServerService, getDynamicServerService } from "./providers/dynamic/DynamicServerService";

// Re-export interfaces for type usage
export type { IServerWalletService } from "./interfaces";
