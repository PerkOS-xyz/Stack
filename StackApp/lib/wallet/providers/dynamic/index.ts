/**
 * Dynamic Provider Exports - Client Only
 *
 * This barrel file exports only client-safe components.
 * For server-side services, import directly:
 *   import { DynamicServerService, getDynamicServerService } from "./DynamicServerService";
 *
 * Or use the server entry point:
 *   import { getServerWalletService } from "@/lib/wallet/server";
 */

// Client-side provider only
export { DynamicClientProvider, type DynamicClientProviderProps } from "./DynamicClientProvider";
