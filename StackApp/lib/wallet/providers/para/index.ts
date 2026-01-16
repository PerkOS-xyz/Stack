/**
 * Para Provider Exports - Client Only
 *
 * This barrel file exports only client-safe components.
 * For server-side services, import directly:
 *   import { ParaServerService, getParaServerService } from "./ParaServerService";
 *
 * Or use the server entry point:
 *   import { getServerWalletService } from "@/lib/wallet/server";
 */

// Client-side provider only
export { ParaClientProvider, type ParaClientProviderProps } from "./ParaClientProvider";
