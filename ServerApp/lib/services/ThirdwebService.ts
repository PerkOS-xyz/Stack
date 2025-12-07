import { createThirdwebClient, getContract } from "thirdweb";
import { privateKeyToAccount, generatePrivateKey } from "thirdweb/wallets";
import { defineChain } from "thirdweb/chains";

interface ThirdwebConfig {
  clientId: string;
  secretKey: string;
}

interface CreateWalletResponse {
  walletId: string;
  address: string;
  encryptedPrivateKey: string; // Encrypted with AES-256
}

interface SignTransactionParams {
  encryptedPrivateKey: string;
  transaction: any; // Thirdweb transaction object
}

/**
 * ThirdwebService - Manages sponsor wallets using Thirdweb SDK
 *
 * Features:
 * - Creates wallets server-side with encrypted private key storage
 * - Signs transactions using Thirdweb SDK
 * - Supports Account Abstraction (Smart Wallets) for gasless transactions
 * - Multi-chain support (Avalanche, Base, Celo)
 *
 * Security:
 * - Private keys encrypted with AES-256-GCM using SECRET_KEY
 * - Keys stored in database encrypted (only decrypted in memory for signing)
 * - Thirdweb enclave ensures secure key management
 */
export class ThirdwebService {
  private client: any;
  private encryptionKey: string;

  constructor(config: ThirdwebConfig) {
    // Initialize Thirdweb client
    this.client = createThirdwebClient({
      clientId: config.clientId,
      secretKey: config.secretKey,
    });

    // Get encryption key from environment (must be 32 bytes for AES-256)
    this.encryptionKey = process.env.WALLET_ENCRYPTION_KEY || "";
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error(
        "WALLET_ENCRYPTION_KEY must be set and at least 32 characters for AES-256"
      );
    }
  }

  /**
   * Creates a new sponsor wallet
   *
   * @param userWalletAddress - User's wallet address (for naming)
   * @param network - Network name (avalanche, base, celo)
   * @returns Wallet ID, address, and encrypted private key
   */
  async createWallet(
    userWalletAddress: string,
    network: string
  ): Promise<CreateWalletResponse> {
    try {
      // Generate new private key using Thirdweb
      const privateKey = generatePrivateKey();

      // Create account from private key
      const account = privateKeyToAccount({
        client: this.client,
        privateKey,
      });

      // Encrypt private key before storage
      const encryptedPrivateKey = await this.encryptPrivateKey(privateKey);

      // Generate unique wallet ID
      const walletId = `tw-${Date.now()}-${userWalletAddress.slice(2, 8)}`;

      return {
        walletId,
        address: account.address,
        encryptedPrivateKey,
      };
    } catch (error) {
      console.error("Error creating Thirdweb wallet:", error);
      throw new Error(
        `Failed to create Thirdweb wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Signs a transaction using encrypted private key
   *
   * @param params - Encrypted private key and transaction object
   * @returns Signed transaction
   */
  async signTransaction(params: SignTransactionParams): Promise<string> {
    try {
      const { encryptedPrivateKey, transaction } = params;

      // Decrypt private key
      const privateKey = await this.decryptPrivateKey(encryptedPrivateKey);

      // Create account from private key
      const account = privateKeyToAccount({
        client: this.client,
        privateKey,
      });

      // Sign transaction using Thirdweb account
      const signedTx = await account.signTransaction(transaction);

      return signedTx;
    } catch (error) {
      console.error("Error signing transaction with Thirdweb:", error);
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets wallet address from encrypted private key
   *
   * @param encryptedPrivateKey - Encrypted private key
   * @returns Ethereum address
   */
  async getWalletAddress(encryptedPrivateKey: string): Promise<string> {
    try {
      const privateKey = await this.decryptPrivateKey(encryptedPrivateKey);

      const account = privateKeyToAccount({
        client: this.client,
        privateKey,
      });

      return account.address;
    } catch (error) {
      console.error("Error getting wallet address:", error);
      throw new Error(
        `Failed to get wallet address: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Encrypts private key using AES-256-GCM
   *
   * @param privateKey - Raw private key
   * @returns Encrypted private key (hex string)
   */
  private async encryptPrivateKey(privateKey: string): Promise<string> {
    try {
      const crypto = await import("crypto");

      // Generate initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(this.encryptionKey.slice(0, 32)),
        iv
      );

      // Encrypt private key
      let encrypted = cipher.update(privateKey, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine iv + authTag + encrypted (hex encoded)
      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      console.error("Error encrypting private key:", error);
      throw new Error("Failed to encrypt private key");
    }
  }

  /**
   * Decrypts private key using AES-256-GCM
   *
   * @param encryptedData - Encrypted private key (format: iv:authTag:encrypted)
   * @returns Raw private key
   */
  private async decryptPrivateKey(encryptedData: string): Promise<string> {
    try {
      const crypto = await import("crypto");

      // Split encrypted data
      const parts = encryptedData.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted data format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.encryptionKey.slice(0, 32)),
        iv
      );

      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Error decrypting private key:", error);
      throw new Error("Failed to decrypt private key");
    }
  }

  /**
   * Gets Thirdweb client for direct use
   */
  getClient() {
    return this.client;
  }

  /**
   * Gets chain definition for network
   */
  getChain(network: string) {
    const chains: Record<string, any> = {
      avalanche: defineChain(43114),
      "avalanche-fuji": defineChain(43113),
      base: defineChain(8453),
      "base-sepolia": defineChain(84532),
      celo: defineChain(42220),
      "celo-alfajores": defineChain(44787),
    };

    return chains[network] || defineChain(43114); // Default to Avalanche
  }
}

/**
 * Singleton instance of ThirdwebService
 */
let thirdwebService: ThirdwebService | null = null;

/**
 * Gets or creates the Thirdweb service instance
 */
export function getThirdwebService(): ThirdwebService {
  if (!thirdwebService) {
    const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;

    if (!clientId || !secretKey) {
      throw new Error(
        "Missing Thirdweb configuration. Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID and THIRDWEB_SECRET_KEY environment variables."
      );
    }

    thirdwebService = new ThirdwebService({
      clientId,
      secretKey,
    });
  }

  return thirdwebService;
}
