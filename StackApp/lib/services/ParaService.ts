import Para, { Environment } from "@getpara/server-sdk";
import { ParaEthersSigner } from "@getpara/ethers-v6-integration";
import { createParaAccount, createParaViemClient } from "@getpara/viem-v2-integration";
import { ethers } from "ethers";
import { http, type Chain, type WalletClient, type Account, type Transport } from "viem";
import { getRpcUrl, type SupportedNetwork } from "../utils/config";
import { chains as viemChains } from "../utils/chains";

interface CreateWalletResponse {
  walletId: string;
  address: string;
  userShare: string; // User share for server-side signing operations
  walletType: "EVM" | "SOLANA" | "COSMOS"; // Type of wallet created
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
 * - User shares stored encrypted for server-side signing
 *
 * Database Storage:
 * - Stores para_wallet_id, address, and encrypted user_share
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
   * @param userWalletAddress - User's wallet address (used as customId for association)
   * @param network - Network type: 'evm', 'solana', or 'cosmos' (determines wallet type)
   * @returns Wallet ID, address, and userShare for signing operations
   */
  async createWallet(
    userWalletAddress: string,
    network: string
  ): Promise<CreateWalletResponse> {
    try {
      console.log(`Creating Para wallet for user: ${userWalletAddress}, network: ${network}`);

      // Map network to Para wallet type
      let walletType: "EVM" | "SOLANA" | "COSMOS";
      switch (network) {
        case "solana":
          walletType = "SOLANA";
          break;
        case "cosmos":
          walletType = "COSMOS";
          break;
        default:
          walletType = "EVM";
      }

      // Generate a unique identifier for this wallet
      // Use a combination of user address and timestamp to allow multiple wallets per user
      const uniqueId = `sponsor_${userWalletAddress.toLowerCase()}_${Date.now()}`;

      console.log(`Creating pregenerated wallet with type: ${walletType}, customId: ${uniqueId}`);

      // Create pregenerated wallet using Para SDK
      // Use createPregenWalletPerType which supports EVM, SOLANA, and COSMOS
      // See: https://github.com/getpara/examples-hub/blob/2.0.0/server/with-node/src/routes/createWallet.ts
      const wallets = await this.para.createPregenWalletPerType({
        types: [walletType],
        pregenId: {
          customId: uniqueId,
        },
      });

      // Find the wallet of the requested type
      const pregenWallet = wallets.find(w => w.type === walletType);

      if (!pregenWallet || !pregenWallet.id || !pregenWallet.address) {
        throw new Error(`Failed to create pregenerated ${walletType} wallet - invalid response`);
      }

      // Get the user share for server-side signing
      // This is required for signing transactions with this wallet
      const userShare = await this.para.getUserShare();

      if (!userShare) {
        throw new Error("Failed to get user share for wallet");
      }

      console.log(`Para wallet created successfully:`, {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
        type: walletType,
        hasUserShare: !!userShare,
      });

      return {
        walletId: pregenWallet.id,
        address: pregenWallet.address,
        userShare: userShare,
        walletType: walletType,
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
   * @param userShare - User share for signing (retrieved from database)
   * @returns ParaEthersSigner instance
   */
  async getSigner(walletId: string, rpcUrl: string, userShare?: string): Promise<ParaEthersSigner> {
    try {
      // Load the user share if provided, otherwise try to get the current one
      let share: string | undefined = userShare;
      if (!share) {
        console.log(`No userShare provided for wallet ${walletId}, attempting to fetch current share...`);
        try {
          const fetchedShare = await this.para.getUserShare();
          share = fetchedShare ?? undefined;
          if (share) {
            console.log(`Successfully retrieved userShare for wallet ${walletId}`);
          }
        } catch (shareError) {
          console.log(`Could not retrieve userShare: ${shareError instanceof Error ? shareError.message : 'unknown error'}`);
        }
      }

      if (share) {
        await this.para.setUserShare(share);
        console.log(`UserShare set for signing with wallet ${walletId}`);
      } else {
        console.log(`Proceeding without userShare for wallet ${walletId}`);
      }

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
   * @param userShare - User share for signing (retrieved from database)
   * @returns ParaEthersSigner instance
   */
  async getSignerForNetwork(walletId: string, network: SupportedNetwork, userShare?: string): Promise<ParaEthersSigner> {
    const rpcUrl = getRpcUrl(network);
    return this.getSigner(walletId, rpcUrl, userShare);
  }

  /**
   * Gets a Viem wallet client for a Para wallet
   *
   * This is a simpler approach that doesn't require manually managing userShare.
   * Uses Para's Viem integration for direct wallet operations.
   *
   * @param network - Network name (e.g., "avalanche", "base")
   * @param rpcUrl - RPC URL for the target network
   * @param userShare - Optional user share for pregenerated wallets
   * @returns Viem WalletClient with Para account
   */
  async getViemClient(network: string, rpcUrl: string, userShare?: string): Promise<WalletClient<Transport, Chain, Account>> {
    try {
      console.log(`Creating Para Viem client for network: ${network}`);

      // For pregenerated wallets, we need to set the user share first
      let share = userShare;
      if (!share) {
        console.log("No userShare provided, attempting to fetch from Para...");
        try {
          const fetchedShare = await this.para.getUserShare();
          share = fetchedShare ?? undefined;
          if (share) {
            console.log("Successfully retrieved userShare from Para");
          }
        } catch (shareError) {
          console.log(`Could not retrieve userShare: ${shareError instanceof Error ? shareError.message : 'unknown error'}`);
        }
      }

      if (share) {
        console.log("Setting userShare before creating account...");
        await this.para.setUserShare(share);
      }

      // Create a Para Account using the server SDK
      console.log("Calling createParaAccount...");
      const account = await createParaAccount(this.para);
      console.log(`Para account created with address: ${account.address}`);

      // Get the chain configuration from our chains.ts
      const chain = viemChains[network];
      if (!chain) {
        throw new Error(`Unsupported network: ${network}`);
      }

      // Create the Para Viem WalletClient
      console.log("Creating Para Viem WalletClient...");
      const walletClient = createParaViemClient(this.para, {
        account: account,
        chain: chain,
        transport: http(rpcUrl),
      });

      console.log(`Para Viem client created for network ${network}`);
      return walletClient as WalletClient<Transport, Chain, Account>;
    } catch (error) {
      console.error("Error creating Para Viem client:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw new Error(
        `Failed to create Para Viem client: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Signs a message using Para wallet
   *
   * @param walletId - Para wallet ID
   * @param message - Message to sign
   * @param userShare - User share for signing
   * @returns Signature string
   */
  async signMessage(walletId: string, message: string, userShare?: string): Promise<string> {
    try {
      if (userShare) {
        await this.para.setUserShare(userShare);
      }
      const messageBase64 = Buffer.from(message).toString('base64');
      const result = await this.para.signMessage({
        walletId,
        messageBase64,
      });
      // Handle the response which may be an object with signature property
      if (typeof result === 'string') {
        return result;
      }
      if (result && typeof result === 'object' && 'signature' in result) {
        return (result as { signature: string }).signature;
      }
      throw new Error('Unexpected signMessage response format');
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
      // For pregenerated wallets, we can get the wallet info directly
      const wallets = await this.para.getPregenWallets({});
      const wallet = wallets.find(w => w.id === walletId);
      if (wallet && wallet.address) {
        return wallet.address;
      }
      throw new Error(`Wallet ${walletId} not found`);
    } catch (error) {
      console.error("Error getting wallet address:", error);
      throw new Error(
        `Failed to get wallet address: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets a Solana signer for a Para wallet
   *
   * @param walletId - Para wallet ID
   * @param userShare - User share for signing
   * @returns Solana signer object with signTransaction method
   */
  async getSolanaSigner(walletId: string, userShare?: string): Promise<{
    signTransaction: (transaction: import("@solana/web3.js").Transaction) => Promise<import("@solana/web3.js").Transaction>;
    publicKey: import("@solana/web3.js").PublicKey;
  }> {
    try {
      const { Transaction, PublicKey } = await import("@solana/web3.js");

      // Set user share if provided
      if (userShare) {
        await this.para.setUserShare(userShare);
      }

      // Get the wallet to get its address
      const wallets = await this.para.getPregenWallets({});
      const wallet = wallets.find(w => w.id === walletId);
      if (!wallet || !wallet.address) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      const publicKey = new PublicKey(wallet.address);

      return {
        publicKey,
        signTransaction: async (transaction: import("@solana/web3.js").Transaction) => {
          // Serialize the transaction to base64
          const serializedMessage = transaction.serializeMessage();
          const messageBase64 = Buffer.from(serializedMessage).toString('base64');

          console.log(`[ParaService] Signing Solana transaction for wallet ${walletId}`);

          // Sign the transaction using Para
          const signResult = await this.para.signMessage({
            walletId,
            messageBase64,
          });

          // Extract signature from result
          let signatureBase64: string;
          if (typeof signResult === 'string') {
            signatureBase64 = signResult;
          } else if (signResult && typeof signResult === 'object' && 'signature' in signResult) {
            signatureBase64 = (signResult as { signature: string }).signature;
          } else {
            throw new Error('Unexpected sign response format');
          }

          // Convert base64 signature to Uint8Array
          const signatureBuffer = Buffer.from(signatureBase64, 'base64');

          // Add signature to transaction
          transaction.addSignature(publicKey, signatureBuffer);

          return transaction;
        },
      };
    } catch (error) {
      console.error("Error getting Solana signer:", error);
      throw new Error(
        `Failed to get Solana signer: ${error instanceof Error ? error.message : "Unknown error"}`
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
