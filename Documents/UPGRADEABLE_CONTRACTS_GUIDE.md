# Upgradeable Contracts Guide - PerkOS x402

Complete guide for deploying and upgrading the DeferredPaymentEscrow contract using OpenZeppelin's UUPS proxy pattern.

## Overview

The **DeferredPaymentEscrowUpgradeable** contract uses the **UUPS (Universal Upgradeable Proxy Standard)** pattern, which allows you to:

✅ **Fix bugs** without redeploying
✅ **Add new features** while preserving state
✅ **Maintain same address** for users
✅ **Control upgrades** via owner-only access
✅ **Gas efficient** - upgrade logic in implementation

## Architecture

```
┌─────────────────────────┐
│   Users/Wallets         │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│   ERC1967 Proxy         │  ← Fixed address (never changes)
│   - Stores all state    │
│   - Delegates calls     │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│   Implementation V1     │  ← Upgradeable (can be replaced)
│   - Business logic      │
│   - No state storage    │
└─────────────────────────┘
            │
            ↓ (upgrade)
┌─────────────────────────┐
│   Implementation V2     │  ← New version
│   - Updated logic       │
│   - Same state layout   │
└─────────────────────────┘
```

## 🚀 Initial Deployment

### Step 1: Ensure wallet is funded

```bash
# Check wallet balance
cast balance <YOUR_WALLET> --rpc-url <RPC_URL>

# Fund wallet with gas tokens (AVAX, ETH, CELO)
# Testnets: Use faucets
# Mainnets: Transfer from exchange or other wallet
```

### Step 2: Compile contracts

```bash
cd ServerApp
npm run compile
```

### Step 3: Deploy to testnet first

```bash
# Avalanche Fuji
npm run deploy:avalanche-fuji

# Base Sepolia
npm run deploy:base-sepolia

# Celo Sepolia
npm run deploy:celo-sepolia
```

### Step 4: Update .env file

The deployment script will output:

```bash
NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_DEFERRED_ENABLED=true
```

Add these to your `.env` file.

### Step 5: Deploy to mainnet

```bash
# ⚠️ Double check wallet and RPC before mainnet deployment!

# Avalanche
npm run deploy:avalanche

# Base
npm run deploy:base

# Celo
npm run deploy:celo
```

## 🔄 Upgrading Contracts

### When to Upgrade

✅ **Bug fixes** - Critical security issues
✅ **Feature additions** - New functionality requested
✅ **Performance improvements** - Gas optimizations
✅ **Standard updates** - EIP compliance changes

❌ **Don't upgrade** - Minor cosmetic changes
❌ **Don't upgrade** - Breaking state layout changes without migration

### Step 1: Modify contract

Edit `ServerApp/lib/contracts/DeferredPaymentEscrowUpgradeable.sol`:

```solidity
// Example: Add new feature
function newFeature() public {
    // New functionality
}

// Update version number
function version() public pure returns (string memory) {
    return "1.1.0"; // Increment version
}
```

**⚠️ Critical Rules:**
- ❌ NEVER change order of existing state variables
- ❌ NEVER remove existing state variables
- ❌ NEVER change types of existing state variables
- ✅ OK to add NEW state variables at the end
- ✅ OK to add NEW functions
- ✅ OK to modify existing function logic

### Step 2: Compile updated contract

```bash
npm run compile
```

### Step 3: Test upgrade on testnet

```bash
# Set proxy address from your testnet deployment
export PROXY_ADDRESS=0x1234...abcd

# Upgrade on Avalanche Fuji
npm run upgrade:avalanche-fuji

# Verify upgrade worked
# Check new version number and implementation address
```

### Step 4: Upgrade on mainnet

```bash
# ⚠️ CRITICAL: Only after successful testnet upgrade!

# Set proxy address from mainnet deployment
export PROXY_ADDRESS=0x5678...efgh

# Avalanche
npm run upgrade:avalanche

# Base
npm run upgrade:base

# Celo
npm run upgrade:celo
```

## 📊 Verification

### Check deployment

```bash
# Get implementation address
cast call <PROXY_ADDRESS> "getImplementation()" --rpc-url <RPC_URL>

# Get contract version
cast call <PROXY_ADDRESS> "version()" --rpc-url <RPC_URL>

# Get owner
cast call <PROXY_ADDRESS> "owner()" --rpc-url <RPC_URL>
```

### Verify on block explorer

After deployment, verify contracts on block explorers:

- **Avalanche**: snowtrace.io
- **Base**: basescan.org
- **Celo**: explorer.celo.org

The deployment script will attempt automatic verification. If it fails:

```bash
# Verify implementation manually
npx hardhat verify --network <network> <IMPLEMENTATION_ADDRESS>

# Verify proxy manually
npx hardhat verify --network <network> <PROXY_ADDRESS> <IMPLEMENTATION_ADDRESS> <INIT_DATA>
```

## 🔐 Security Best Practices

### Access Control

- ✅ **Owner only** can upgrade contracts
- ✅ Use multi-sig wallet for production owner
- ✅ Time-lock upgrades for critical changes
- ✅ Announce upgrades to community in advance

### Testing

```bash
# Before any upgrade:
1. Review all code changes
2. Run security audit (for major changes)
3. Test on local hardhat network
4. Test on testnet
5. Monitor testnet for 24-48 hours
6. Only then upgrade mainnet
```

### State Migration

If you need to migrate state:

```solidity
// Add migration function in new implementation
function migrateV2() external onlyOwner {
    // One-time state migration logic
    // Call this immediately after upgrade
}
```

## 📝 Deployment Addresses

Keep track of all deployments:

### Testnet Deployments

| Network | Proxy Address | Implementation | Version |
|---------|---------------|----------------|---------|
| Avalanche Fuji | 0x... | 0x... | 1.0.0 |
| Base Sepolia | 0x... | 0x... | 1.0.0 |
| Celo Sepolia | 0x... | 0x... | 1.0.0 |

### Mainnet Deployments

| Network | Proxy Address | Implementation | Version |
|---------|---------------|----------------|---------|
| Avalanche | 0x... | 0x... | 1.0.0 |
| Base | 0x... | 0x... | 1.0.0 |
| Celo | 0x... | 0x... | 1.0.0 |

## 🔧 Troubleshooting

### Issue: "Only owner can upgrade"

**Solution**: Verify you're using the correct deployer wallet:

```bash
cast call <PROXY_ADDRESS> "owner()" --rpc-url <RPC_URL>
# Compare with your wallet address
```

### Issue: "Storage layout incompatible"

**Solution**: You changed state variable order. Revert changes and only add new variables at the end.

### Issue: "Contract verification failed"

**Solution**: Wait longer (60 seconds) before verification, or verify manually:

```bash
npx hardhat verify --network <network> <ADDRESS>
```

### Issue: "Insufficient funds for gas"

**Solution**: Fund your wallet with more native tokens:

```bash
# Check balance
cast balance <YOUR_WALLET> --rpc-url <RPC_URL>

# Deployment typically costs 0.01-0.05 native tokens
```

## 📚 Advanced Topics

### Multi-Sig Ownership

Transfer ownership to Gnosis Safe multi-sig:

```bash
# After deployment, transfer ownership
cast send <PROXY_ADDRESS> "transferOwnership(address)" <GNOSIS_SAFE_ADDRESS> \
  --rpc-url <RPC_URL> \
  --private-key <PRIVATE_KEY>
```

### Time-Locked Upgrades

Add timelock before critical upgrades:

1. Deploy TimelockController
2. Transfer proxy ownership to timelock
3. Queue upgrade transaction
4. Wait delay period (e.g., 48 hours)
5. Execute upgrade

### Upgrade with Initialization

If new version needs initialization:

```solidity
// In new implementation
function initializeV2(uint256 newParam) public reinitializer(2) {
    // Initialize new features
}
```

```bash
# Encode initialization data
INIT_DATA=$(cast calldata "initializeV2(uint256)" 12345)

# Upgrade with initialization
# (Modify upgrade.ts to pass INIT_DATA)
```

## 📖 References

- [OpenZeppelin Upgrades Plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [UUPS Proxies](https://docs.openzeppelin.com/contracts/5.x/api/proxy#UUPSUpgradeable)
- [Writing Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable)
- [Proxy Upgrade Pattern](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies)

---

**Last Updated**: December 2024
**Contract Version**: 1.0.0
**Pattern**: UUPS (ERC-1967)
