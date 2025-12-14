# Multi-Chain Support Guide

PerkOS Stack supports **16 EVM blockchain networks** (8 mainnets + 8 testnets) with Thirdweb Server Wallets for x402 payment processing and gas sponsorship.

## Supported Networks

### Mainnets

| Network | Chain ID | Native Token | Status |
|---------|----------|--------------|--------|
| **Avalanche C-Chain** | 43114 | AVAX | Active |
| **Base** | 8453 | ETH | Active |
| **Celo** | 42220 | CELO | Active |
| **Arbitrum One** | 42161 | ETH | Active |
| **Optimism** | 10 | ETH | Active |
| **Polygon** | 137 | MATIC | Active |
| **Ethereum** | 1 | ETH | Active |
| **BNB Smart Chain** | 56 | BNB | Active |

### Testnets

| Network | Chain ID | Native Token | Status |
|---------|----------|--------------|--------|
| **Avalanche Fuji** | 43113 | AVAX | Active |
| **Base Sepolia** | 84532 | ETH | Active |
| **Celo Alfajores** | 44787 | CELO | Active |
| **Arbitrum Sepolia** | 421614 | ETH | Active |
| **Optimism Sepolia** | 11155420 | ETH | Active |
| **Polygon Amoy** | 80002 | MATIC | Active |
| **Sepolia** | 11155111 | ETH | Active |
| **BNB Testnet** | 97 | BNB | Active |

## USDC Token Addresses

### Mainnet

| Network | USDC Address | Decimals |
|---------|-------------|----------|
| Avalanche | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 6 |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| Arbitrum One | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| Optimism | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | 6 |
| Polygon | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | 6 |
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| BNB Smart Chain | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | 18 |

### Testnet

| Network | USDC Address | Decimals |
|---------|-------------|----------|
| Avalanche Fuji | `0x5425890298aed601595a70AB815c96711a31Bc65` | 6 |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 6 |
| Celo Alfajores | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` | 6 |
| Arbitrum Sepolia | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | 6 |
| Optimism Sepolia | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` | 6 |
| Polygon Amoy | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | 6 |
| Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 |
| BNB Testnet | `0x64544969ed7EBf5f083679233325356EbE738930` | 18 |

## RPC Endpoints

### Mainnet

```bash
# Avalanche C-Chain
https://api.avax.network/ext/bc/C/rpc

# Base
https://mainnet.base.org

# Celo
https://forno.celo.org

# Arbitrum One
https://arb1.arbitrum.io/rpc

# Optimism
https://mainnet.optimism.io

# Polygon
https://polygon-rpc.com

# Ethereum
https://eth.llamarpc.com

# BNB Smart Chain
https://bsc-dataseed.binance.org
```

### Testnet

```bash
# Avalanche Fuji
https://api.avax-test.network/ext/bc/C/rpc

# Base Sepolia
https://sepolia.base.org

# Celo Alfajores
https://alfajores-forno.celo-testnet.org

# Arbitrum Sepolia
https://sepolia-rollup.arbitrum.io/rpc

# Optimism Sepolia
https://sepolia.optimism.io

# Polygon Amoy
https://rpc-amoy.polygon.technology

# Sepolia
https://rpc.sepolia.org

# BNB Testnet
https://data-seed-prebsc-1-s1.binance.org:8545
```

## Block Explorers

| Network | Explorer |
|---------|----------|
| Avalanche | https://snowtrace.io |
| Avalanche Fuji | https://testnet.snowtrace.io |
| Base | https://basescan.org |
| Base Sepolia | https://sepolia.basescan.org |
| Celo | https://celoscan.io |
| Celo Alfajores | https://alfajores.celoscan.io |
| Arbitrum One | https://arbiscan.io |
| Arbitrum Sepolia | https://sepolia.arbiscan.io |
| Optimism | https://optimistic.etherscan.io |
| Optimism Sepolia | https://sepolia-optimism.etherscan.io |
| Polygon | https://polygonscan.com |
| Polygon Amoy | https://amoy.polygonscan.com |
| Ethereum | https://etherscan.io |
| Sepolia | https://sepolia.etherscan.io |
| BNB Smart Chain | https://bscscan.com |
| BNB Testnet | https://testnet.bscscan.com |

## Deployment

### 1. Compile Contracts

```bash
cd StackApp
npm run compile
```

### 2. Deploy to Single Testnet

**Avalanche Fuji:**
```bash
npm run deploy:avalanche-fuji
```

**Base Sepolia:**
```bash
npm run deploy:base-sepolia
```

**Arbitrum Sepolia:**
```bash
npm run deploy:arbitrum-sepolia
```

### 3. Deploy to All Testnets at Once

```bash
npm run deploy:all-testnets
```

This will deploy the `DeferredPaymentEscrowUpgradeable` contract (UUPS proxy) to all testnets sequentially.

### 4. Deploy to Mainnet

**Warning: Mainnet deployment costs real money!**

```bash
# Avalanche Mainnet
npm run deploy:avalanche

# Base Mainnet
npm run deploy:base

# Arbitrum Mainnet
npm run deploy:arbitrum

# Optimism Mainnet
npm run deploy:optimism
```

## Configuration

After deployment, update your `.env` file with the escrow addresses:

```bash
# Testnet Escrow Addresses (UUPS Proxies)
NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS=0x...deployed-address...
NEXT_PUBLIC_BASE_SEPOLIA_ESCROW_ADDRESS=0x...deployed-address...
NEXT_PUBLIC_ARBITRUM_SEPOLIA_ESCROW_ADDRESS=0x...deployed-address...

# Mainnet Escrow Addresses
NEXT_PUBLIC_AVALANCHE_ESCROW_ADDRESS=0x...deployed-address...
NEXT_PUBLIC_BASE_ESCROW_ADDRESS=0x...deployed-address...

# Enable deferred scheme
NEXT_PUBLIC_DEFERRED_ENABLED=true

# Thirdweb Configuration
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key
```

## Thirdweb Integration

PerkOS Stack uses Thirdweb Server Wallets for:
- x402 payment processing
- Gas sponsorship for gasless transactions
- Multi-chain wallet management

### Setting Up Thirdweb

1. Create account at [thirdweb.com](https://thirdweb.com)
2. Create a new project
3. Generate API credentials (Client ID + Secret Key)
4. Set up Server Wallets for each network
5. Configure gas sponsorship rules (optional)

### Gas Sponsorship

Configure sponsorship rules in the database (`perkos_sponsor_rules` table):
- `agent_whitelist`: Allow specific wallet addresses
- `domain_whitelist`: Allow requests from specific domains
- `spending_limit`: Set daily/monthly/per-transaction limits
- `time_restriction`: Limit sponsorship to specific hours/days

## API Usage

### Network Parameter

All API endpoints support a `network` parameter:

```json
{
  "x402Version": 1,
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "base",
    "payload": { ... }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "1000000",
    "resource": "https://api.example.com",
    "payTo": "0x...",
    "maxTimeoutSeconds": 60,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
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
    { "scheme": "exact", "network": "base" },
    { "scheme": "exact", "network": "arbitrum" },
    { "scheme": "exact", "network": "optimism" },
    { "scheme": "exact", "network": "polygon" },
    { "scheme": "exact", "network": "ethereum" },
    { "scheme": "exact", "network": "bnb" },
    { "scheme": "deferred", "network": "avalanche" },
    { "scheme": "deferred", "network": "base" },
    { "scheme": "deferred", "network": "arbitrum" }
  ]
}
```

## Network-Specific Features

### Avalanche
- Fastest finality (~2 seconds)
- Lowest gas fees among L1s
- Native USDC support
- Mature DeFi ecosystem

### Base
- Ethereum L2 (Optimism Superchain)
- Very low gas fees
- Coinbase integration
- Growing ecosystem

### Arbitrum
- Ethereum L2 (Nitro)
- High throughput
- Strong DeFi presence
- Stylus support (Rust/C++)

### Optimism
- Ethereum L2 (OP Stack)
- Retroactive public goods funding
- Superchain ecosystem
- Strong developer tools

### Polygon
- Ethereum sidechain/L2
- Lowest gas fees
- High throughput
- Massive ecosystem

### Celo
- Mobile-first blockchain
- Stable gas fees in cUSD
- Carbon-negative
- ReFi ecosystem

### Ethereum
- Original smart contract platform
- Highest security
- Most liquidity
- Higher gas fees

### BNB Smart Chain
- EVM-compatible
- Low gas fees
- Large user base
- Binance ecosystem

## Testing

### Get Testnet Tokens

**Avalanche Fuji:**
- Faucet: https://faucet.avax.network

**Base Sepolia:**
- Faucet: https://www.alchemy.com/faucets/base-sepolia

**Arbitrum Sepolia:**
- Faucet: https://www.alchemy.com/faucets/arbitrum-sepolia

**Optimism Sepolia:**
- Faucet: https://www.alchemy.com/faucets/optimism-sepolia

**Polygon Amoy:**
- Faucet: https://faucet.polygon.technology

**Sepolia:**
- Faucet: https://sepoliafaucet.com

**BNB Testnet:**
- Faucet: https://testnet.bnbchain.org/faucet-smart

### Get Testnet USDC

After getting native tokens, swap for USDC on testnet DEXs or use Circle faucets if available.

## Monitoring

Monitor your facilitator across all chains:

```bash
# Health check
curl http://localhost:3402/api/v2/x402/health

# Configuration
curl http://localhost:3402/api/v2/x402/config

# Dashboard stats
curl http://localhost:3402/api/dashboard/stats
```

## Troubleshooting

### Contract Verification Failed

Manually verify using:

```bash
npx hardhat verify --network avalanche-fuji 0x...contract-address...
npx hardhat verify --network base-sepolia 0x...contract-address...
npx hardhat verify --network arbitrum-sepolia 0x...contract-address...
```

### RPC Connection Issues

If RPC endpoints are slow or unavailable, update with alternative providers:

```bash
# Use Alchemy, Infura, or other providers
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

### Gas Estimation Issues

Different chains have different gas dynamics. If transactions fail:

1. Check gas price is appropriate for the network
2. Ensure sufficient native token balance
3. Try increasing gas limit
4. Check Thirdweb sponsorship configuration

### Thirdweb Wallet Issues

1. Verify `THIRDWEB_SECRET_KEY` is set correctly
2. Check Server Wallet has sufficient balance
3. Verify sponsorship rules allow the transaction
4. Check Thirdweb dashboard for error logs

## Best Practices

1. **Test on testnets first** before mainnet deployment
2. **Monitor gas prices** and adjust accordingly
3. **Use Thirdweb Server Wallets** for secure key management
4. **Keep escrow deposits small** (max $10 recommended for testing)
5. **Monitor contract balances** regularly
6. **Set up alerts** for low balances or failures
7. **Configure sponsorship limits** to prevent abuse
8. **Use domain whitelists** for gas sponsorship

## Adding New Networks

To add a new EVM network:

1. Add chain configuration to `StackApp/lib/utils/chains.ts`
2. Add USDC address to `USDC_ADDRESSES` mapping
3. Configure RPC URL in environment variables
4. Deploy escrow contract (for deferred payments)
5. Update Thirdweb Server Wallet configuration
6. Test with small amounts first

## Resources

- [Avalanche Documentation](https://docs.avax.network)
- [Base Documentation](https://docs.base.org)
- [Arbitrum Documentation](https://docs.arbitrum.io)
- [Optimism Documentation](https://docs.optimism.io)
- [Polygon Documentation](https://docs.polygon.technology)
- [Celo Documentation](https://docs.celo.org)
- [Thirdweb Documentation](https://portal.thirdweb.com)
- [x402 Protocol](https://x402.org)
