import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 43114,
    },
    // Avalanche Networks
    avalanche: {
      url: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "avalanche-fuji": {
      url: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Celo Networks
    celo: {
      url: process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org",
      chainId: 42220,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "celo-sepolia": {
      url: process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL || "https://forno.celo-sepolia.celo-testnet.org",
      chainId: 11142220,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Base Networks
    base: {
      url: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "base-sepolia": {
      url: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./lib/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
