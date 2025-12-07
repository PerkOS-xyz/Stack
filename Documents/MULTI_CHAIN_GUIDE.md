# Multi-Chain Support Guide

The x402 Facilitator now supports **3 blockchain networks** with their respective testnets.

## Supported Networks

| Network | Chain ID | Testnet | Testnet Chain ID |
|---------|----------|---------|------------------|
| **Avalanche C-Chain** | 43114 | Fuji | 43113 |
| **Celo** | 42220 | Sepolia | 11142220 |
| **Base** | 8453 | Sepolia | 84532 |

## USDC Token Addresses

### Mainnet

| Network | USDC Address | Decimals |
|---------|-------------|----------|
| Avalanche | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 6 |
| Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |

### Testnet

| Network | USDC Address | Decimals |
|---------|-------------|----------|
| Avalanche Fuji | `0x5425890298aed601595a70AB815c96711a31Bc65` | 6 |
| Celo Sepolia | *TBD - Network newly launched* | 6 |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 |

## RPC Endpoints

### Mainnet

```bash
# Avalanche C-Chain
https://api.avax.network/ext/bc/C/rpc

# Celo
https://forno.celo.org

# Base
https://mainnet.base.org
```

### Testnet

```bash
# Avalanche Fuji
https://api.avax-test.network/ext/bc/C/rpc

# Celo Sepolia
https://forno.celo-sepolia.celo-testnet.org

# Base Sepolia
https://sepolia.base.org
```

## Block Explorers

| Network | Explorer |
|---------|----------|
| Avalanche | https://snowtrace.io |
| Avalanche Fuji | https://testnet.snowtrace.io |
| Celo | https://explorer.celo.org/mainnet |
| Celo Sepolia | https://celo-sepolia.blockscout.com |
| Base | https://basescan.org |
| Base Sepolia | https://sepolia.basescan.org |

## Deployment

### 1. Compile Contracts

```bash
cd ServerApp
npm run compile
```

### 2. Deploy to Single Testnet

**Avalanche Fuji:**
```bash
npm run deploy:avalanche-fuji
```

**Celo Sepolia:**
```bash
npm run deploy:celo-sepolia
```

**Base Sepolia:**
```bash
npm run deploy:base-sepolia
```

### 3. Deploy to All Testnets at Once

```bash
npm run deploy:all-testnets
```

This will deploy the `DeferredPaymentEscrow` contract to all three testnets sequentially.

### 4. Deploy to Mainnet

**⚠️ Warning: Mainnet deployment costs real money!**

```bash
# Avalanche Mainnet
npm run deploy:avalanche

# Celo Mainnet
npm run deploy:celo

# Base Mainnet
npm run deploy:base
```

## Configuration

After deployment, update your `.env` file with the escrow addresses:

```bash
# Avalanche Fuji
NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS=0x...deployed-address...

# Celo Alfajores
NEXT_PUBLIC_CELO_ALFAJORES_ESCROW_ADDRESS=0x...deployed-address...

# Base Sepolia
NEXT_PUBLIC_BASE_SEPOLIA_ESCROW_ADDRESS=0x...deployed-address...

# Enable deferred scheme
NEXT_PUBLIC_DEFERRED_ENABLED=true
```

## API Usage

### Network Parameter

All API endpoints now support a `network` parameter:

```json
{
  "x402Version": 1,
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "celo",  // avalanche | celo | base
    "payload": { ... }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "celo",  // Must match paymentPayload.network
    "maxAmountRequired": "1000000",
    "resource": "https://api.example.com",
    "payTo": "0x...",
    "maxTimeoutSeconds": 60,
    "asset": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C"  // Celo USDC
  }
}
```

### Supported Networks Endpoint

```bash
curl http://localhost:3402/api/v2/x402/supported
```

**Response:**
```json
{
  "kinds": [
    { "scheme": "exact", "network": "avalanche" },
    { "scheme": "exact", "network": "celo" },
    { "scheme": "exact", "network": "base" },
    { "scheme": "deferred", "network": "avalanche" },
    { "scheme": "deferred", "network": "celo" },
    { "scheme": "deferred", "network": "base" }
  ]
}
```

## Network-Specific Features

### Avalanche
- ✅ Fastest finality (~2 seconds)
- ✅ Lowest gas fees
- ✅ Native USDC support
- ✅ Mature DeFi ecosystem

### Celo
- ✅ Mobile-first blockchain
- ✅ Stable gas fees in cUSD
- ✅ Carbon-negative
- ✅ ReFi ecosystem

### Base
- ✅ Ethereum L2 (Optimism Superchain)
- ✅ Low gas fees
- ✅ Coinbase integration
- ✅ Growing ecosystem

## Testing

### Get Testnet Tokens

**Avalanche Fuji:**
- Faucet: https://faucet.avax.network

**Celo Sepolia:**
- Google Cloud Faucet: https://cloud.google.com/application/web3/faucet/celo/sepolia
- Celo Faucet: https://faucet.celo.org/celo-sepolia

**Base Sepolia:**
- Bridge from Ethereum Sepolia: https://bridge.base.org

### Get Testnet USDC

After getting native tokens, swap for USDC on testnet DEXs or use faucets if available.

## Monitoring

Monitor your facilitator across all chains:

```bash
# Health check
curl http://localhost:3402/api/v2/x402/health

# Configuration
curl http://localhost:3402/api/v2/x402/config
```

## Troubleshooting

### Contract Verification Failed

Manually verify using:

```bash
npx hardhat verify --network avalanche-fuji 0x...contract-address...
npx hardhat verify --network celo-alfajores 0x...contract-address...
npx hardhat verify --network base-sepolia 0x...contract-address...
```

### RPC Connection Issues

If RPC endpoints are slow or unavailable, update with alternative providers:

```bash
# Use Alchemy, Infura, or other providers
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Gas Estimation Issues

Different chains have different gas dynamics. If transactions fail:

1. Check gas price is appropriate for the network
2. Ensure sufficient native token balance
3. Try increasing gas limit

## Best Practices

1. **Test on testnets first** before mainnet deployment
2. **Monitor gas prices** and adjust accordingly
3. **Use different wallets** for different networks (security)
4. **Keep escrow deposits small** (max $10 recommended)
5. **Monitor contract balances** regularly
6. **Set up alerts** for low balances or failures

## Migration Guide

### From Single-Chain to Multi-Chain

If you're migrating from the original Avalanche-only version:

1. Update environment variables (see `.env.example`)
2. Deploy contracts to new networks
3. Update client code to specify `network` parameter
4. Test with small amounts first
5. Monitor all networks simultaneously

## Resources

- [Avalanche Documentation](https://docs.avax.network)
- [Celo Documentation](https://docs.celo.org)
- [Base Documentation](https://docs.base.org)
- [x402 Protocol](https://x402.gitbook.io/x402)
