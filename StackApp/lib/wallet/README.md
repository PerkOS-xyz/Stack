# Wallet Abstraction Layer

A unified wallet interface for StackApp that supports multiple wallet providers (Para, Dynamic) with seamless switching via environment configuration.

## Overview

This abstraction layer allows developers to switch between wallet providers without changing application code. Both client-side (UI wallet) and server-side (sponsor wallets) use the same provider selection.

## Quick Start

### 1. Set Provider in Environment

```bash
# .env or .env.local
NEXT_PUBLIC_WALLET_PROVIDER=para   # Use Para SDK (default)
# or
NEXT_PUBLIC_WALLET_PROVIDER=dynamic # Use Dynamic SDK
```

### 2. Wrap Your App with WalletProvider

```tsx
// app/providers.tsx
import { WalletProvider } from "@/lib/wallet";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}
```

### 3. Use Unified Hooks in Components

```tsx
import { useWalletProvider, useWalletModal } from "@/lib/wallet";

function ConnectButton() {
  const { isConnected, address, disconnect } = useWalletProvider();
  const { openModal } = useWalletModal();

  if (!isConnected) {
    return <button onClick={openModal}>Connect Wallet</button>;
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### 4. Server-Side Wallet Operations

```typescript
import { getServerWalletService } from "@/lib/wallet";

// The service automatically uses the correct provider
const walletService = getServerWalletService();

// Create a new wallet
const wallet = await walletService.createWallet(userId, "evm");

// Get a signer for transactions
const signer = await walletService.getSigner(
  wallet.walletId,
  rpcUrl,
  wallet.keyMaterial
);
```

## Architecture

```
lib/wallet/
├── index.ts                 # Main exports
├── config.ts                # Provider configuration
├── WalletProvider.tsx       # Unified provider component
├── context/
│   ├── WalletContext.tsx    # Shared wallet state context
│   └── index.ts
├── hooks/
│   ├── useWalletProvider.ts # Connection state hook
│   ├── useWalletModal.ts    # Modal control hook
│   ├── useWalletData.ts     # Wallet data hook
│   └── index.ts
├── interfaces/
│   ├── IWalletProvider.ts   # Client-side interface
│   ├── IServerWalletService.ts # Server-side interface
│   ├── IWalletModal.ts      # Modal interface
│   └── index.ts
└── providers/
    ├── para/
    │   ├── ParaClientProvider.tsx   # Para SDK wrapper
    │   ├── ParaServerService.ts     # Para server operations
    │   └── index.ts
    ├── dynamic/
    │   ├── DynamicClientProvider.tsx # Dynamic SDK wrapper
    │   ├── DynamicServerService.ts   # Dynamic MPC server wallets
    │   └── index.ts
    └── index.ts
```

## Provider Configuration

### Para SDK (Default)

**Required Environment Variables:**
```bash
NEXT_PUBLIC_WALLET_PROVIDER=para
NEXT_PUBLIC_PARA_API_KEY=your-para-api-key
PARA_SERVER_API_KEY=your-para-server-api-key
```

**Features:**
- Social login (Google, Twitter, Discord)
- External wallets (MetaMask, Phantom, WalletConnect)
- Pregenerated embedded wallets
- Server-side MPC signing via ParaEthersSigner

### Dynamic SDK

**Required Environment Variables:**
```bash
NEXT_PUBLIC_WALLET_PROVIDER=dynamic
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your-environment-id

# For server wallets (Dynamic native MPC)
DYNAMIC_AUTH_TOKEN=your-api-auth-token
```

**Required Packages:**

Client-side:
```bash
npm install @dynamic-labs/sdk-react-core @dynamic-labs/ethereum @dynamic-labs/solana
```

Server-side:
```bash
npm install @dynamic-labs-wallet/node @dynamic-labs-wallet/node-evm
```

**Features:**
- 50+ wallet connections
- Enhanced social login (Google, Apple, Discord, Twitter, etc.)
- Email/phone embedded wallets
- Native MPC server wallets (2-of-2, 2-of-3, 3-of-5 threshold schemes)
- Fast signing via MPC accelerator (<1 second)

## Unified Interfaces

### IWalletProvider (Client-Side)

```typescript
interface IWalletProvider {
  provider: WalletProviderType;
  isConnected: boolean;
  isLoading: boolean;
  address: `0x${string}` | undefined;
  chainId?: number;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain?: (chainId: number) => Promise<void>;
  error: Error | null;
}
```

### IServerWalletService (Server-Side)

```typescript
interface IServerWalletService {
  isInitialized(): boolean;

  createWallet(
    userId: string,
    network: "evm" | "solana"
  ): Promise<CreateWalletResponse>;

  getSigner(
    walletId: string,
    rpcUrl: string,
    keyMaterial?: string
  ): Promise<Signer>;

  getViemClient(
    walletId: string,
    chain: Chain,
    keyMaterial?: string
  ): Promise<WalletClient>;

  signMessage(
    walletId: string,
    message: string,
    keyMaterial?: string
  ): Promise<string>;
}
```

## Hooks Reference

### useWalletProvider()

Primary hook for wallet connection state.

```typescript
const {
  provider,      // "para" | "dynamic" | "privy"
  isConnected,   // boolean
  isLoading,     // boolean
  address,       // `0x${string}` | undefined
  chainId,       // number | undefined
  connect,       // () => Promise<void>
  disconnect,    // () => Promise<void>
  switchChain,   // (chainId: number) => Promise<void>
  error,         // Error | null
} = useWalletProvider();
```

### useWalletModal()

Hook for controlling the wallet connection modal.

```typescript
const {
  openModal,   // () => void
  closeModal,  // () => void
  isOpen,      // boolean | undefined
} = useWalletModal();
```

### useWalletData()

Hook for additional wallet data (balance, tokens, etc).

```typescript
const {
  balance,       // string | undefined
  tokens,        // Token[] | undefined
  nfts,          // NFT[] | undefined
  isLoading,     // boolean
  error,         // Error | null
  refresh,       // () => Promise<void>
} = useWalletData();
```

## Migration Guide

### From Direct Para Usage

**Before:**
```tsx
import { useModal, useAccount, useWallet, useLogout } from "@getpara/react-sdk";

function Component() {
  const { openModal } = useModal();
  const { isConnected } = useAccount();
  const { data: wallet } = useWallet();
  const { logout } = useLogout();
  // ...
}
```

**After:**
```tsx
import { useWalletProvider, useWalletModal } from "@/lib/wallet";

function Component() {
  const { isConnected, address, disconnect } = useWalletProvider();
  const { openModal } = useWalletModal();
  // ...
}
```

### Switching Providers

Simply change the environment variable:

```bash
# Switch from Para to Dynamic
NEXT_PUBLIC_WALLET_PROVIDER=dynamic
```

No code changes required in components.

## Adding New Providers

1. Create provider directory: `lib/wallet/providers/{provider-name}/`

2. Implement client provider:
```tsx
// {Provider}ClientProvider.tsx
export function {Provider}ClientProvider({ children }) {
  // Wrap provider SDK and provide to WalletContext
  return (
    <ProviderSDK>
      <WalletContextProvider value={{...}}>
        {children}
      </WalletContextProvider>
    </ProviderSDK>
  );
}
```

3. Implement server service:
```typescript
// {Provider}ServerService.ts
export class {Provider}ServerService implements IServerWalletService {
  // Implement all interface methods
}
```

4. Update `WalletProvider.tsx` switch statement
5. Update `getServerWalletService()` in `index.ts`
6. Add to config validation in `config.ts`

## Supported Networks

The abstraction layer supports all networks configured in `lib/utils/chains.ts`:

| Network | Chain ID | Type |
|---------|----------|------|
| Avalanche | 43114 | Mainnet |
| Avalanche Fuji | 43113 | Testnet |
| Base | 8453 | Mainnet |
| Base Sepolia | 84532 | Testnet |
| Celo | 42220 | Mainnet |
| Optimism | 10 | Mainnet |
| Arbitrum | 42161 | Mainnet |
| Polygon | 137 | Mainnet |
| Ethereum | 1 | Mainnet |

## Troubleshooting

### "Unknown wallet provider" Error

Ensure `NEXT_PUBLIC_WALLET_PROVIDER` is set to a valid value: `para` or `dynamic`.

### Para Server Features Disabled

Check that `PARA_SERVER_API_KEY` is set in server environment.

### Dynamic SDK Not Working

1. Install required packages:
   ```bash
   npm install @dynamic-labs/sdk-react-core @dynamic-labs/ethereum
   ```
2. Set `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`
3. Configure wallet connectors in Dynamic dashboard

### Server Wallet Creation Fails

- **Para**: Verify `PARA_SERVER_API_KEY` has wallet creation permissions
- **Dynamic**: Verify Turnkey credentials are correct

## Best Practices

1. **Use abstraction hooks** instead of provider-specific hooks
2. **Check `isInitialized()`** before server wallet operations
3. **Handle loading states** with `isLoading` from hooks
4. **Catch errors** and display user-friendly messages
5. **Test with both providers** before deployment

## License

MIT
