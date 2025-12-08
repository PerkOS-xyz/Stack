import { createThirdwebClient, getContract } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { defineChain } from "thirdweb/chains";
import { randomBytes } from "crypto";

interface ThirdwebConfig {
  clientId: string;
  secretKey: string;
}

interface CreateWalletResponse {
  walletId: string;
  address: string; // EOA address (for signing)
  smartWalletAddress: string; // Smart Wallet address (for Account Abstraction)
  encryptedPrivateKey: string; // Encrypted with AES-256
}

interface SignTransactionParams {
  encryptedPrivateKey: string;
  transaction: any; // Thirdweb transaction object
}

/**
 * ThirdwebService - Manages Thirdweb Server Wallets for sponsor transactions
 *
 * Features:
 * - Creates server wallets via Thirdweb API (https://api.thirdweb.com/v1/wallets/server)
 * - Thirdweb securely manages private keys (never exposed to our application)
 * - Single wallet address works across all EVM chains (Avalanche, Base, Celo)
 * - Signs transactions using Thirdweb SDK for blockchain interactions
 * - Supports Account Abstraction (Smart Wallets) for gasless transactions
 * - Multi-chain support via Thirdweb client (Avalanche, Base, Celo)
 *
 * Security:
 * - Private keys managed by Thirdweb infrastructure (never stored locally)
 * - Wallets identified by unique identifiers (sponsor-{userAddress}-{network})
 * - API access controlled by THIRDWEB_SECRET_KEY
 * - All transactions signed through Thirdweb's secure infrastructure
 *
 * Database Storage:
 * - Stores wallet identifier and address for association with user wallet
 * - encrypted_private_key field left empty (Thirdweb manages keys)
 * - Enables transaction sponsorship and gasless user experiences
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
   * Creates a new Thirdweb Server Wallet using the Thirdweb API
   *
   * @param userWalletAddress - User's wallet address (for naming/identifier)
   * @param network - Network name (not used in identifier, kept for backwards compatibility)
   * @returns Wallet ID, address, and encrypted private key
   */
  async createWallet(
    userWalletAddress: string,
    network: string
  ): Promise<CreateWalletResponse> {
    try {
      const secretKey = process.env.THIRDWEB_SECRET_KEY;
      if (!secretKey) {
        throw new Error("THIRDWEB_SECRET_KEY not configured");
      }

      // Create unique identifier for this wallet (network-agnostic)
      // Same wallet address works across all EVM chains
      const identifier = `sponsor-${userWalletAddress.toLowerCase()}`;

      console.log(`Creating Thirdweb server wallet with identifier: ${identifier}`);

      // Call Thirdweb API to create server wallet
      const response = await fetch("https://api.thirdweb.com/v1/wallets/server", {
        method: "POST",
        headers: {
          "x-secret-key": secretKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Thirdweb API error:", errorData);
        throw new Error(`Thirdweb API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log("Thirdweb server wallet created:", data);

      // The API returns both EOA address and Smart Wallet address
      // EOA: For transaction signing
      // Smart Wallet: For Account Abstraction and gasless transactions
      // Note: Thirdweb manages the private key, we don't store it
      return {
        walletId: identifier,
        address: data.result.address, // EOA address
        smartWalletAddress: data.result.smartWalletAddress || "", // Smart Wallet address
        encryptedPrivateKey: "", // Thirdweb manages the key
      };
    } catch (error) {
      console.error("Error creating Thirdweb server wallet:", error);
      throw new Error(
        `Failed to create Thirdweb server wallet: ${error instanceof Error ? error.message : "Unknown error"}`
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
