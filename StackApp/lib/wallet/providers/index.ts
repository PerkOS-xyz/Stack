/**
 * Wallet Provider Implementations - Client-Only Exports
 *
 * This file exports only client-safe provider components.
 * For server-side services, import directly from the specific provider files:
 *   - import { ParaServerService } from "./para/ParaServerService";
 *   - import { DynamicServerService } from "./dynamic/DynamicServerService";
 *
 * Or use the server entry point:
 *   - import { getServerWalletService } from "@/lib/wallet/server";
 */

// Para Provider - Client only
export { ParaClientProvider, type ParaClientProviderProps } from "./para/ParaClientProvider";

// Dynamic Provider - Client only
export { DynamicClientProvider, type DynamicClientProviderProps } from "./dynamic/DynamicClientProvider";

// Future providers:
// export { PrivyClientProvider } from "./privy/PrivyClientProvider";
