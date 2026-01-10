import Para, { Environment } from "@getpara/server-sdk";
import { ParaEthersSigner } from "@getpara/ethers-v6-integration";
import { ethers } from "ethers";
import { getRpcUrl } from "../utils/chains";

interface CreateWalletResponse {
  walletId: string;
  address: string;
}

/**
 * ParaService - Manages Para Server Wallets for sponsor transactions
 *
 * Features:
 * - Creates pregenerated wallets via Para Server SDK
 * - Para securely manages private keys (never exposed to our application)
 * - Single wallet address works across all EVM chains
 * - Signs transactions using ParaEthersSigner (ethers.js compatible)
 * - Multi-chain support (Avalanche, Base, Celo, Polygon, Arbitrum, Optimism, etc.)
 *
 * Security:
 * - Private keys managed by Para infrastructure (never stored locally)
 * - Wallets identified by Para wallet IDs stored in database
 * - API access controlled by PARA_SERVER_API_KEY
 * - All transactions signed through Para's secure infrastructure
 *
 * Database Storage:
 * - Stores para_wallet_id and address for association with user wallet
 * - Enables transaction sponsorship and gasless user experiences
 */
export class ParaService {
  private para: Para;

  constructor() {
    const apiKey = process.env.PARA_SERVER_API_KEY;
    if (!apiKey) {
      throw new Error("PARA_SERVER_API_KEY not configured");
    }

    // Use BETA environment for development, PRODUCTION for mainnet
    const environment = process.env.NODE_ENV === "production"
      ? Environment.PRODUCTION
      : Environment.BETA;

    this.para = new Para(environment, apiKey);
  }

  /**
   * Creates a new Para pregenerated wallet
   *
   * @param userWalletAddress - User's wallet address (for naming/association)
   * @param network - Network name (not used in wallet creation, kept for backwards compatibility)
   * @returns Wallet ID and address
   */
  async createWallet(
    userWalletAddress: string,
    network: string
  ): Promise<CreateWalletResponse> {
    try {
      console.log(`Creating Para wallet for user: ${userWalletAddress}`);

      // Create pregenerated wallet using Para SDK
      const pregenWallet = await this.para.createPregenWallet();

      if (!pregenWallet || !pregenWallet.id || !pregenWallet.address) {
        throw new Error("Failed to create pregenerated wallet - invalid response");
      }

      console.log(`Para wallet created successfully:`, {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
      });

      return {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
      };
    } catch (error) {
      console.error("Error creating Para wallet:", error);
      throw new Error(
        `Failed to create Para wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets an ethers.js compatible signer for a Para wallet
   *
   * @param walletId - Para wallet ID
   * @param rpcUrl - RPC URL for the target network
   * @returns ParaEthersSigner instance
   */
  async getSigner(walletId: string, rpcUrl: string): Promise<ParaEthersSigner> {
    try {
      // Set the active wallet in Para
      await this.para.setActiveWallet(walletId);

      // Create ethers provider
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Create Para ethers signer
      const signer = new ParaEthersSigner(this.para, provider);

      return signer;
    } catch (error) {
      console.error("Error getting Para signer:", error);
      throw new Error(
        `Failed to get Para signer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets an ethers.js compatible signer for a Para wallet using network name
   *
   * @param walletId - Para wallet ID
   * @param network - Network name (e.g., "avalanche", "base")
   * @returns ParaEthersSigner instance
   */
  async getSignerForNetwork(walletId: string, network: string): Promise<ParaEthersSigner> {
    const rpcUrl = getRpcUrl(network);
    return this.getSigner(walletId, rpcUrl);
  }

  /**
   * Signs a message using Para wallet
   *
   * @param walletId - Para wallet ID
   * @param message - Message to sign
   * @returns Signature string
   */
  async signMessage(walletId: string, message: string): Promise<string> {
    try {
      await this.para.setActiveWallet(walletId);
      const signature = await this.para.signMessage(message);
      return signature;
    } catch (error) {
      console.error("Error signing message with Para:", error);
      throw new Error(
        `Failed to sign message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets the wallet address for a Para wallet ID
   *
   * @param walletId - Para wallet ID
   * @returns Wallet address
   */
  async getWalletAddress(walletId: string): Promise<string> {
    try {
      await this.para.setActiveWallet(walletId);
      const address = await this.para.getAddress();
      return address;
    } catch (error) {
      console.error("Error getting wallet address:", error);
      throw new Error(
        `Failed to get wallet address: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets the Para client instance for advanced operations
   */
  getClient(): Para {
    return this.para;
  }
}

/**
 * Singleton instance of ParaService
 */
let paraService: ParaService | null = null;

/**
 * Gets or creates the Para service instance
 */
export function getParaService(): ParaService {
  if (!paraService) {
    paraService = new ParaService();
  }
  return paraService;
}
