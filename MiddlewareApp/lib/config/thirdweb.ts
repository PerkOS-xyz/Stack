import { createThirdwebClient } from "thirdweb";
import { avalanche, avalancheFuji, base, baseSepolia, celo } from "thirdweb/chains";

// Get client ID from environment
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "";

// Create Thirdweb client (will fail at runtime if clientId is missing)
export const client = clientId ? createThirdwebClient({
  clientId,
}) : null as any;

// Supported chains (Avalanche Fuji first = default active network)
// Note: Celo testnet (Alfajores) not available in Thirdweb v5
// Filter out any undefined chains to prevent errors
export const chains = [
  avalancheFuji, // Default network for login
  avalanche,
  baseSepolia,
  base,
  celo, // Mainnet only - testnet infrastructure hidden from UI
].filter(chain => chain && chain.id !== undefined);

// Wallet config
export const walletConfig = {
  supportedWallets: [
    "io.metamask",
    "com.coinbase.wallet",
    "me.rainbow",
    "app.phantom",
  ],
  showAllWallets: true,
};
