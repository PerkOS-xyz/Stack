/**
 * Para Server Service - IServerWalletService Implementation
 *
 * This service wraps the Para Server SDK to conform to the
 * IServerWalletService interface, enabling provider-agnostic server wallet operations.
 *
 * Features:
 * - Creates pregenerated wallets via Para Server SDK
 * - Signs transactions using ParaEthersSigner (ethers.js compatible)
 * - Supports viem wallet clients via createParaViemClient
 * - Multi-chain support (EVM, Solana)
 */

import Para, { Environment } from "@getpara/server-sdk";
import { ParaEthersSigner } from "@getpara/ethers-v6-integration";
import { createParaAccount, createParaViemClient } from "@getpara/viem-v2-integration";
import { ethers, type Signer } from "ethers";
import { http, type Chain, type WalletClient, type Account, type Transport } from "viem";
import { chains as viemChains } from "@/lib/utils/chains";
import type {
  IServerWalletService,
  CreateWalletResponse,
  SolanaSigner,
} from "../../interfaces";

/**
 * Para Server Service implementing IServerWalletService
 */
export class ParaServerService implements IServerWalletService {
  private para: Para;
  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.PARA_SERVER_API_KEY;
    if (!apiKey) {
      console.warn("PARA_SERVER_API_KEY not configured - Para server features disabled");
      this.para = null as unknown as Para;
      return;
    }

    const environment =
      process.env.NODE_ENV === "production"
        ? Environment.PRODUCTION
        : Environment.BETA;

    this.para = new Para(environment, apiKey);
    this.initialized = true;
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Creates a new Para pregenerated wallet
   *
   * @param userId - User identifier (used as customId for association)
   * @param network - Network type: 'evm' or 'solana'
   * @returns Wallet ID, address, and keyMaterial (userShare)
   */
  async createWallet(
    userId: string,
    network: "evm" | "solana"
  ): Promise<CreateWalletResponse> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      console.log(`[ParaServerService] Creating wallet for user: ${userId}, network: ${network}`);

      // Map network to Para wallet type
      const walletType: "EVM" | "SOLANA" = network === "solana" ? "SOLANA" : "EVM";

      // Generate unique identifier
      const uniqueId = `sponsor_${userId.toLowerCase()}_${Date.now()}`;

      // Create pregenerated wallet using Para SDK
      const wallets = await this.para.createPregenWalletPerType({
        types: [walletType],
        pregenId: { customId: uniqueId },
      });

      const pregenWallet = wallets.find((w) => w.type === walletType);

      if (!pregenWallet?.id || !pregenWallet?.address) {
        throw new Error(`Failed to create pregenerated ${walletType} wallet`);
      }

      // Get user share for server-side signing
      const userShare = await this.para.getUserShare();

      if (!userShare) {
        throw new Error("Failed to get user share for wallet");
      }

      console.log(`[ParaServerService] Wallet created:`, {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
        type: walletType,
      });

      return {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
        walletType: walletType,
        keyMaterial: userShare, // Para's "userShare" is the keyMaterial
        metadata: {
          customId: uniqueId,
          provider: "para",
        },
      };
    } catch (error) {
      console.error("[ParaServerService] Error creating wallet:", error);
      throw new Error(
        `Failed to create wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets an ethers.js compatible signer for a Para wallet
   *
   * @param walletId - Para wallet ID
   * @param rpcUrl - RPC URL for the target network
   * @param keyMaterial - User share for signing (from database)
   */
  async getSigner(
    walletId: string,
    rpcUrl: string,
    keyMaterial?: string
  ): Promise<Signer> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      // Set user share if provided
      if (keyMaterial) {
        await this.para.setUserShare(keyMaterial);
        console.log(`[ParaServerService] UserShare set for wallet ${walletId}`);
      } else {
        // Try to fetch current share
        const fetchedShare = await this.para.getUserShare();
        if (fetchedShare) {
          await this.para.setUserShare(fetchedShare);
        }
      }

      // Create ethers provider
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Create Para ethers signer
      const signer = new ParaEthersSigner(this.para, provider);

      return signer;
    } catch (error) {
      console.error("[ParaServerService] Error getting signer:", error);
      throw new Error(
        `Failed to get signer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets a viem WalletClient for a Para wallet
   *
   * @param walletId - Para wallet ID (not used directly, Para manages internally)
   * @param chain - Viem chain configuration
   * @param keyMaterial - User share for signing
   */
  async getViemClient(
    walletId: string,
    chain: Chain,
    keyMaterial?: string
  ): Promise<WalletClient> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      // Set user share if provided
      if (keyMaterial) {
        await this.para.setUserShare(keyMaterial);
      }

      // Create Para account
      const account = await createParaAccount(this.para);
      console.log(`[ParaServerService] Account created: ${account.address}`);

      // Get RPC URL from chain config or use default
      const rpcUrl = chain.rpcUrls.default.http[0];

      // Create viem wallet client
      const walletClient = createParaViemClient(this.para, {
        account: account,
        chain: chain,
        transport: http(rpcUrl),
      });

      return walletClient as WalletClient;
    } catch (error) {
      console.error("[ParaServerService] Error creating viem client:", error);
      throw new Error(
        `Failed to create viem client: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets a viem Account for a Para wallet
   *
   * @param walletId - Para wallet ID
   * @param keyMaterial - User share for signing
   */
  async getViemAccount(
    walletId: string,
    keyMaterial?: string
  ): Promise<Account> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      if (keyMaterial) {
        await this.para.setUserShare(keyMaterial);
      }

      const account = await createParaAccount(this.para);
      return account;
    } catch (error) {
      console.error("[ParaServerService] Error creating account:", error);
      throw new Error(
        `Failed to create account: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Signs a message using Para wallet
   *
   * @param walletId - Para wallet ID
   * @param message - Message to sign
   * @param keyMaterial - User share for signing
   */
  async signMessage(
    walletId: string,
    message: string,
    keyMaterial?: string
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      if (keyMaterial) {
        await this.para.setUserShare(keyMaterial);
      }

      const messageBase64 = Buffer.from(message).toString("base64");
      const result = await this.para.signMessage({
        walletId,
        messageBase64,
      });

      // Handle response format
      if (typeof result === "string") {
        return result;
      }
      if (result && typeof result === "object" && "signature" in result) {
        return (result as { signature: string }).signature;
      }

      throw new Error("Unexpected signMessage response format");
    } catch (error) {
      console.error("[ParaServerService] Error signing message:", error);
      throw new Error(
        `Failed to sign message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Restore wallet signing capability by setting the user share
   *
   * @param walletId - Para wallet ID
   * @param keyMaterial - User share to restore
   */
  async restoreWallet(walletId: string, keyMaterial: string): Promise<void> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    await this.para.setUserShare(keyMaterial);
    console.log(`[ParaServerService] Wallet ${walletId} signing capability restored`);
  }

  /**
   * Check if Solana wallets are supported
   */
  supportsSolana(): boolean {
    return this.initialized;
  }

  /**
   * Gets a Solana signer for a Para wallet (x402 SVM support)
   *
   * @param walletId - Para wallet ID
   * @param keyMaterial - User share for signing
   * @returns Solana signer compatible with @solana/web3.js
   */
  async getSolanaSigner(walletId: string, keyMaterial?: string): Promise<SolanaSigner> {
    if (!this.initialized) {
      throw new Error("Para server service not initialized");
    }

    try {
      const { Transaction, PublicKey } = await import("@solana/web3.js");

      // Set user share if provided
      if (keyMaterial) {
        await this.para.setUserShare(keyMaterial);
      }

      // Get the wallet to retrieve its address
      const wallets = await this.para.getPregenWallets({});
      const wallet = wallets.find((w) => w.id === walletId);

      if (!wallet || !wallet.address) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      const publicKey = new PublicKey(wallet.address);
      const para = this.para;

      return {
        publicKey,
        signTransaction: async (transaction: InstanceType<typeof Transaction>) => {
          // Serialize the transaction message to base64
          const serializedMessage = transaction.serializeMessage();
          const messageBase64 = Buffer.from(serializedMessage).toString("base64");

          console.log(`[ParaServerService] Signing Solana transaction for wallet ${walletId}`);

          // Sign using Para
          const signResult = await para.signMessage({
            walletId,
            messageBase64,
          });

          // Extract signature from result
          let signatureBase64: string;
          if (typeof signResult === "string") {
            signatureBase64 = signResult;
          } else if (signResult && typeof signResult === "object" && "signature" in signResult) {
            signatureBase64 = (signResult as { signature: string }).signature;
          } else {
            throw new Error("Unexpected sign response format");
          }

          // Convert base64 signature to Uint8Array
          const signatureBuffer = Buffer.from(signatureBase64, "base64");

          // Add signature to transaction
          transaction.addSignature(publicKey, signatureBuffer);

          return transaction;
        },
      };
    } catch (error) {
      console.error("[ParaServerService] Error getting Solana signer:", error);
      throw new Error(
        `Failed to get Solana signer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets the raw Para client for advanced operations
   */
  getParaClient(): Para {
    return this.para;
  }
}

// Singleton instance
let paraServerService: ParaServerService | null = null;

/**
 * Gets or creates the Para server service instance
 */
export function getParaServerService(): ParaServerService {
  if (!paraServerService) {
    paraServerService = new ParaServerService();
  }
  return paraServerService;
}

export default ParaServerService;
