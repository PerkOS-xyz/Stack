import { createThirdwebClient } from "thirdweb";
import { avalanche, avalancheFuji, base, baseSepolia, celo, celoAlfajores } from "thirdweb/chains";

// Get client ID from environment
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  throw new Error("Missing NEXT_PUBLIC_THIRDWEB_CLIENT_ID environment variable");
}

// Create Thirdweb client
export const client = createThirdwebClient({
  clientId,
});

// Supported chains (Avalanche Fuji first = default active network)
export const chains = [
  avalancheFuji, // Default network for login
  avalanche,
  baseSepolia,
  base,
  celoAlfajores,
  celo,
];

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
