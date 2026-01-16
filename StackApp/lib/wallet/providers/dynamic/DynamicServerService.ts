/**
 * Dynamic Server Service - IServerWalletService Implementation
 *
 * This service uses Dynamic's native server wallet SDK for server-side operations.
 * Dynamic provides MPC-based server wallets with threshold signature schemes.
 *
 * Required packages:
 *   npm install @dynamic-labs-wallet/node @dynamic-labs-wallet/node-evm @dynamic-labs-wallet/node-svm
 *
 * Required environment variables:
 *   DYNAMIC_ENVIRONMENT_ID=your-environment-id
 *   DYNAMIC_AUTH_TOKEN=your-api-auth-token
 *
 * x402 Protocol Compliance:
 * - Supports both EVM and Solana (SVM) for multi-chain x402 payments
 * - See: https://www.dynamic.xyz/docs/node-sdk/svm/sign-transactions
 *
 * IMPORTANT: Dynamic SDK imports are done dynamically within methods to avoid
 * bundling client-side code (@dynamic-labs Logger) on the server.
 *
 * @see https://www.dynamic.xyz/docs/wallets/server-wallets/overview
 * @see https://www.dynamic.xyz/docs/node-sdk/evm/create-wallet
 */

import type { Signer } from "ethers";
import type { Chain, WalletClient, Account, Hex } from "viem";
import { createWalletClient, http } from "viem";
import type {
  IServerWalletService,
  CreateWalletResponse,
  SolanaSigner,
} from "../../interfaces";

// Dynamic SDK types only - actual imports are done dynamically to avoid RSC issues
type DynamicEvmWalletClientType = InstanceType<typeof import("@dynamic-labs-wallet/node-evm").DynamicEvmWalletClient>;
type DynamicSvmWalletClientType = InstanceType<typeof import("@dynamic-labs-wallet/node-svm").DynamicSvmWalletClient>;
type ServerKeyShare = import("@dynamic-labs-wallet/node").ServerKeyShare;

/**
 * Helper to safely parse externalServerKeyShares
 * Handles cases where the value might already be parsed (object) or still a string
 */
function parseKeyShares(keyShares: unknown): ServerKeyShare[] | undefined {
  if (!keyShares) return undefined;
  if (typeof keyShares === 'object' && Array.isArray(keyShares)) {
    return keyShares as ServerKeyShare[];
  }
  if (typeof keyShares === 'string') {
    try {
      return JSON.parse(keyShares);
    } catch {
      console.warn("[DynamicServerService] Could not parse externalServerKeyShares string");
      return undefined;
    }
  }
  // If it's an object but not an array, it might be wrapped
  if (typeof keyShares === 'object') {
    return keyShares as unknown as ServerKeyShare[];
  }
  return undefined;
}

/**
 * Wallet data stored in database for recovery (EVM)
 */
interface DynamicEvmWalletData {
  walletId: string;
  accountAddress: string;
  externalServerKeyShares?: string; // Encrypted key shares for backup
  thresholdScheme: string;
  walletType: "EVM";
}

/**
 * Wallet data stored in database for recovery (Solana/SVM)
 */
interface DynamicSvmWalletData {
  walletId: string;
  accountAddress: string; // Solana base58 address
  externalServerKeyShares?: string;
  walletType: "SOLANA";
}

/**
 * Union type for wallet data
 */
type DynamicWalletData = DynamicEvmWalletData | DynamicSvmWalletData;

/**
 * Dynamic Server Service implementing IServerWalletService
 *
 * Uses Dynamic's native MPC server wallets for secure server-side operations.
 * SDK imports are done lazily to avoid bundling client-side code on server.
 */
export class DynamicServerService implements IServerWalletService {
  private initialized: boolean = false;
  private environmentId: string | null = null;
  private authToken: string | null = null;
  private evmClient: DynamicEvmWalletClientType | null = null;
  private svmClient: DynamicSvmWalletClientType | null = null;
  private svmInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const environmentId = process.env.DYNAMIC_ENVIRONMENT_ID || process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
    const authToken = process.env.DYNAMIC_AUTH_TOKEN;

    if (!environmentId || !authToken) {
      console.warn(
        "[DynamicServerService] Server wallet features disabled. " +
          "Set DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN to enable."
      );
      return;
    }

    this.environmentId = environmentId;
    this.authToken = authToken;
    // Mark as initialized - actual SDK loading happens lazily
    this.initialized = true;
    console.log("[DynamicServerService] Service configured, SDK will load on first use");
  }

  /**
   * Lazily initialize the EVM client (loads SDK on first use)
   */
  private async ensureEvmClientInitialized(): Promise<DynamicEvmWalletClientType> {
    if (this.evmClient) {
      return this.evmClient;
    }

    if (!this.environmentId || !this.authToken) {
      throw new Error("DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN not configured");
    }

    // Dynamic import to avoid bundling client-side code
    const { DynamicEvmWalletClient } = await import("@dynamic-labs-wallet/node-evm");

    // Note: enableMPCAccelerator must be false for Node.js server environments
    // ForwardMPC uses WebSocket/WASM which doesn't work in server-side Node.js
    this.evmClient = new DynamicEvmWalletClient({
      environmentId: this.environmentId,
      enableMPCAccelerator: false,
    });

    console.log("[DynamicServerService] EVM client initialized");
    return this.evmClient;
  }

  /**
   * Lazily initialize the SVM client (loads SDK on first use)
   */
  private async ensureSvmClientInitialized(): Promise<DynamicSvmWalletClientType> {
    if (this.svmClient) {
      return this.svmClient;
    }

    if (!this.environmentId || !this.authToken) {
      throw new Error("DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN not configured");
    }

    // Dynamic import to avoid bundling client-side code
    const { DynamicSvmWalletClient } = await import("@dynamic-labs-wallet/node-svm");

    this.svmClient = new DynamicSvmWalletClient({
      environmentId: this.environmentId,
    });

    this.svmInitialized = true;
    console.log("[DynamicServerService] SVM client initialized");
    return this.svmClient;
  }

  /**
   * Authenticate the EVM client (call once before EVM operations)
   */
  private async ensureEvmAuthenticated(): Promise<DynamicEvmWalletClientType> {
    if (!this.authToken) {
      throw new Error("DYNAMIC_AUTH_TOKEN not configured");
    }

    const evmClient = await this.ensureEvmClientInitialized();
    await evmClient.authenticateApiToken(this.authToken);
    return evmClient;
  }

  /**
   * Authenticate the SVM client (call once before Solana operations)
   */
  private async ensureSvmAuthenticated(): Promise<DynamicSvmWalletClientType> {
    if (!this.authToken) {
      throw new Error("DYNAMIC_AUTH_TOKEN not configured");
    }

    const svmClient = await this.ensureSvmClientInitialized();
    await svmClient.authenticateApiToken(this.authToken);
    return svmClient;
  }

  /**
   * Legacy method for backward compatibility
   */
  private async ensureAuthenticated(): Promise<DynamicEvmWalletClientType> {
    return this.ensureEvmAuthenticated();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Creates a new Dynamic MPC wallet
   *
   * @param userId - User identifier for wallet association
   * @param network - Network type: 'evm' or 'solana'
   * @returns Wallet ID, address, and optional key shares for backup
   */
  async createWallet(
    userId: string,
    network: "evm" | "solana"
  ): Promise<CreateWalletResponse> {
    if (network === "solana") {
      return this.createSolanaWallet(userId);
    }

    return this.createEvmWallet(userId);
  }

  /**
   * Creates a new EVM wallet
   */
  private async createEvmWallet(userId: string): Promise<CreateWalletResponse> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Service not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const evmClient = await this.ensureEvmAuthenticated();

      // Dynamic import for ThresholdSignatureScheme
      const { ThresholdSignatureScheme } = await import("@dynamic-labs-wallet/node");

      console.log(`[DynamicServerService] Creating EVM wallet for user: ${userId}`);

      const walletData = await evmClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      });

      console.log(`[DynamicServerService] EVM wallet created:`, {
        walletId: walletData.walletId,
        address: walletData.accountAddress,
      });

      // Store externalServerKeyShares securely - needed for signing
      return {
        walletId: walletData.walletId,
        address: walletData.accountAddress as `0x${string}`,
        walletType: "EVM",
        keyMaterial: JSON.stringify({
          externalServerKeyShares: walletData.externalServerKeyShares,
          walletId: walletData.walletId,
          accountAddress: walletData.accountAddress,
          thresholdScheme: "TWO_OF_TWO",
          walletType: "EVM",
        }),
        metadata: {
          provider: "dynamic",
          thresholdScheme: "TWO_OF_TWO",
          userId,
        },
      };
    } catch (error) {
      console.error("[DynamicServerService] Error creating EVM wallet:", error);
      throw new Error(
        `Failed to create EVM wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Creates a new Solana wallet (x402 SVM support)
   */
  private async createSolanaWallet(userId: string): Promise<CreateWalletResponse> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Service not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const svmClient = await this.ensureSvmAuthenticated();

      // Dynamic import for ThresholdSignatureScheme
      const { ThresholdSignatureScheme } = await import("@dynamic-labs-wallet/node");

      console.log(`[DynamicServerService] Creating Solana wallet for user: ${userId}`);

      // Create Solana wallet using Dynamic SVM SDK
      // Note: SVM wallets use TWO_OF_TWO threshold scheme like EVM
      const walletData = await svmClient.createWalletAccount({
        thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      });

      // Note: SVM createWalletAccount doesn't return walletId, use accountAddress as identifier
      const walletId = walletData.accountAddress;

      console.log(`[DynamicServerService] Solana wallet created:`, {
        walletId: walletId,
        address: walletData.accountAddress,
      });

      // Store key shares for signing
      return {
        walletId: walletId,
        address: walletData.accountAddress,
        walletType: "SOLANA",
        keyMaterial: JSON.stringify({
          externalServerKeyShares: walletData.externalServerKeyShares,
          walletId: walletId,
          accountAddress: walletData.accountAddress,
          walletType: "SOLANA",
        }),
        metadata: {
          provider: "dynamic",
          userId,
        },
      };
    } catch (error) {
      console.error("[DynamicServerService] Error creating Solana wallet:", error);
      throw new Error(
        `Failed to create Solana wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets an ethers.js compatible signer for a Dynamic wallet
   *
   * Note: Dynamic SDK primarily uses viem. For ethers compatibility,
   * consider using getViemClient() and wrapping with ethers adapter.
   */
  async getSigner(
    walletId: string,
    rpcUrl: string,
    keyMaterial?: string
  ): Promise<Signer> {
    throw new Error(
      "[DynamicServerService] ethers Signer not directly supported. " +
        "Use getViemClient() instead, or implement an ethers adapter."
    );
  }

  /**
   * Gets a viem WalletClient for a Dynamic wallet
   *
   * @param walletId - Dynamic wallet ID
   * @param chain - Viem chain configuration
   * @param keyMaterial - JSON string containing wallet data and key shares
   */
  async getViemClient(
    walletId: string,
    chain: Chain,
    keyMaterial?: string
  ): Promise<WalletClient> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const evmClient = await this.ensureEvmAuthenticated();

      // Parse wallet data from keyMaterial
      let walletData: DynamicWalletData | null = null;
      if (keyMaterial) {
        try {
          walletData = JSON.parse(keyMaterial);
        } catch {
          console.warn("[DynamicServerService] Could not parse keyMaterial");
        }
      }

      const accountAddress = walletData?.accountAddress;
      if (!accountAddress) {
        throw new Error("accountAddress required in keyMaterial");
      }

      // Create viem wallet client with Dynamic signer
      const rpcUrl = chain.rpcUrls.default.http[0];

      // Get key shares for signing
      const externalServerKeyShares = parseKeyShares(walletData?.externalServerKeyShares)
        ?? await evmClient.getExternalServerKeyShares({ accountAddress });

      // Create a custom account that uses Dynamic for signing
      const account = await this.createDynamicAccount(evmClient, accountAddress, externalServerKeyShares);

      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });

      return walletClient;
    } catch (error) {
      console.error("[DynamicServerService] Error creating viem client:", error);
      throw new Error(
        `Failed to create viem client: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Creates a viem-compatible account using Dynamic MPC signing
   *
   * @param evmClient - Authenticated EVM client instance
   * @param accountAddress - Wallet account address
   * @param externalServerKeyShares - Key shares for signing
   */
  private async createDynamicAccount(
    evmClient: DynamicEvmWalletClientType,
    accountAddress: string,
    externalServerKeyShares: ServerKeyShare[]
  ): Promise<Account> {
    return {
      address: accountAddress as Hex,
      type: "local",

      async signMessage({ message }: { message: string | { raw: Hex } }) {
        const messageStr = typeof message === "string" ? message : message.raw;
        const signature = await evmClient.signMessage({
          message: messageStr,
          accountAddress,
          externalServerKeyShares,
        });
        return signature;
      },

      async signTransaction(transaction: Parameters<typeof evmClient.signTransaction>[0]["transaction"]) {
        const signedTx = await evmClient.signTransaction({
          senderAddress: accountAddress,
          externalServerKeyShares,
          transaction,
        });
        return signedTx as Hex;
      },

      async signTypedData(typedData: Parameters<typeof evmClient.signTypedData>[0]["typedData"]) {
        const signature = await evmClient.signTypedData({
          accountAddress,
          externalServerKeyShares,
          typedData,
        });
        return signature;
      },
    } as unknown as Account;
  }

  /**
   * Gets a viem Account for a Dynamic wallet
   */
  async getViemAccount(
    walletId: string,
    keyMaterial?: string
  ): Promise<Account> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    const evmClient = await this.ensureEvmAuthenticated();

    // Parse wallet data
    let walletData: DynamicWalletData | null = null;
    if (keyMaterial) {
      try {
        walletData = JSON.parse(keyMaterial);
      } catch {
        throw new Error("Invalid keyMaterial format");
      }
    }

    if (!walletData?.accountAddress) {
      throw new Error("accountAddress required in keyMaterial");
    }

    // Get key shares
    const externalServerKeyShares = parseKeyShares(walletData?.externalServerKeyShares)
      ?? await evmClient.getExternalServerKeyShares({ accountAddress: walletData.accountAddress });

    return this.createDynamicAccount(evmClient, walletData.accountAddress, externalServerKeyShares);
  }

  /**
   * Signs a message using Dynamic wallet
   *
   * @param walletId - Dynamic wallet ID
   * @param message - Message to sign
   * @param keyMaterial - JSON string containing wallet data and key shares
   */
  async signMessage(
    walletId: string,
    message: string,
    keyMaterial?: string
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const evmClient = await this.ensureEvmAuthenticated();

      // Parse wallet data
      let walletData: DynamicWalletData | null = null;
      if (keyMaterial) {
        try {
          walletData = JSON.parse(keyMaterial);
        } catch {
          throw new Error("Invalid keyMaterial format");
        }
      }

      const accountAddress = walletData?.accountAddress;
      if (!accountAddress) {
        throw new Error("accountAddress required in keyMaterial");
      }

      const externalServerKeyShares = parseKeyShares(walletData?.externalServerKeyShares)
        ?? await evmClient.getExternalServerKeyShares({ accountAddress });

      const signature = await evmClient.signMessage({
        message,
        accountAddress,
        externalServerKeyShares,
      });

      return signature;
    } catch (error) {
      console.error("[DynamicServerService] Error signing message:", error);
      throw new Error(
        `Failed to sign message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Restore wallet signing capability
   *
   * For Dynamic, this mainly involves re-authenticating and
   * ensuring key shares are available.
   */
  async restoreWallet(walletId: string, keyMaterial: string): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      await this.ensureEvmAuthenticated();

      // Parse and validate wallet data
      const walletData: DynamicWalletData = JSON.parse(keyMaterial);
      if (!walletData.accountAddress || !walletData.walletId) {
        throw new Error("Invalid wallet data in keyMaterial");
      }

      console.log(
        `[DynamicServerService] Wallet ${walletId} ready for signing`
      );
    } catch (error) {
      console.error("[DynamicServerService] Error restoring wallet:", error);
      throw new Error(
        `Failed to restore wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Sign a transaction (EVM)
   *
   * @param walletId - Dynamic wallet ID
   * @param transaction - Transaction to sign
   * @param keyMaterial - JSON string containing wallet data
   */
  async signTransaction(
    walletId: string,
    transaction: {
      to: string;
      value?: bigint;
      data?: string;
      chainId: number;
    },
    keyMaterial?: string
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const evmClient = await this.ensureEvmAuthenticated();

      // Parse wallet data
      let walletData: DynamicWalletData | null = null;
      if (keyMaterial) {
        walletData = JSON.parse(keyMaterial);
      }

      const accountAddress = walletData?.accountAddress;
      if (!accountAddress) {
        throw new Error("accountAddress required in keyMaterial");
      }

      const externalServerKeyShares = parseKeyShares(walletData?.externalServerKeyShares)
        ?? await evmClient.getExternalServerKeyShares({ accountAddress });

      const signedTx = await evmClient.signTransaction({
        senderAddress: accountAddress,
        externalServerKeyShares,
        transaction: transaction as Parameters<typeof evmClient.signTransaction>[0]["transaction"],
      });

      return signedTx;
    } catch (error) {
      console.error("[DynamicServerService] Error signing transaction:", error);
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if Solana wallets are supported
   * Returns true if Dynamic is configured (Solana SDK loads lazily on first use)
   */
  supportsSolana(): boolean {
    return this.initialized;
  }

  /**
   * Gets a Solana signer for a Dynamic wallet (x402 SVM support)
   *
   * @param walletId - Dynamic wallet ID
   * @param keyMaterial - JSON string containing Solana wallet data and key shares
   * @returns Solana signer compatible with @solana/web3.js
   */
  async getSolanaSigner(walletId: string, keyMaterial?: string): Promise<SolanaSigner> {
    if (!this.initialized) {
      throw new Error(
        "[DynamicServerService] Not initialized. Check DYNAMIC_ENVIRONMENT_ID and DYNAMIC_AUTH_TOKEN"
      );
    }

    try {
      const svmClient = await this.ensureSvmAuthenticated();

      // Dynamic import to avoid loading @solana/web3.js unless needed
      const { PublicKey, Transaction } = await import("@solana/web3.js");

      // Parse wallet data from keyMaterial
      let walletData: DynamicSvmWalletData | null = null;
      if (keyMaterial) {
        try {
          walletData = JSON.parse(keyMaterial);
        } catch {
          throw new Error("Invalid keyMaterial format");
        }
      }

      const accountAddress = walletData?.accountAddress;
      if (!accountAddress) {
        throw new Error("accountAddress required in keyMaterial for Solana signing");
      }

      // Parse external server key shares if stored
      const externalServerKeyShares = parseKeyShares(walletData?.externalServerKeyShares);

      const publicKey = new PublicKey(accountAddress);

      console.log(`[DynamicServerService] Creating Solana signer for wallet: ${walletId}, address: ${accountAddress}`);

      return {
        publicKey,
        signTransaction: async (transaction: InstanceType<typeof Transaction>) => {
          console.log(`[DynamicServerService] Signing Solana transaction for wallet ${walletId}`);

          // Sign using Dynamic SVM SDK - pass Transaction directly
          // SDK accepts: VersionedTransaction | Transaction | string
          const signatureBase64 = await svmClient.signTransaction({
            senderAddress: accountAddress,
            transaction: transaction,
            externalServerKeyShares,
          });

          // Dynamic returns base64 encoded signature string
          const signature = Buffer.from(signatureBase64, "base64");

          // Add signature to transaction
          transaction.addSignature(publicKey, signature);

          console.log(`[DynamicServerService] Solana transaction signed successfully`);
          return transaction;
        },
      };
    } catch (error) {
      console.error("[DynamicServerService] Error getting Solana signer:", error);
      throw new Error(
        `Failed to get Solana signer: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

// Singleton instance
let dynamicServerService: DynamicServerService | null = null;

/**
 * Gets or creates the Dynamic server service instance
 */
export function getDynamicServerService(): DynamicServerService {
  if (!dynamicServerService) {
    dynamicServerService = new DynamicServerService();
  }
  return dynamicServerService;
}

export default DynamicServerService;
