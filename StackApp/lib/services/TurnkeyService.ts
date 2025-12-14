import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

interface TurnkeyConfig {
  apiBaseUrl: string;
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
}

interface CreateWalletResponse {
  walletId: string;
  address: string;
}

interface SignTransactionParams {
  walletId: string;
  unsignedTransaction: string;
}

/**
 * TurnkeyService - Manages sponsor wallets using Turnkey infrastructure
 *
 * Features:
 * - Creates wallets in AWS Nitro Enclaves (keys never exposed)
 * - Signs transactions securely via API
 * - No private key storage in database
 */
export class TurnkeyService {
  private client: TurnkeyClient;
  private organizationId: string;

  constructor(config: TurnkeyConfig) {
    // Create API key stamper for request authentication
    const stamper = new ApiKeyStamper({
      apiPublicKey: config.apiPublicKey,
      apiPrivateKey: config.apiPrivateKey,
    });

    // Initialize Turnkey client
    this.client = new TurnkeyClient(
      {
        baseUrl: config.apiBaseUrl,
      },
      stamper
    );

    this.organizationId = config.organizationId;
  }

  /**
   * Creates a new sponsor wallet in Turnkey
   *
   * @param userWalletAddress - User's wallet address (for naming)
   * @param network - Network name (avalanche, base, celo)
   * @returns Wallet ID and address
   */
  async createWallet(
    userWalletAddress: string,
    network: string
  ): Promise<CreateWalletResponse> {
    try {
      const walletName = `sponsor-${userWalletAddress.toLowerCase()}-${network}`;

      // Create wallet in Turnkey with one Ethereum account
      const response = await this.client.createWallet({
        organizationId: this.organizationId,
        walletName,
        accounts: [
          {
            curve: "CURVE_SECP256K1", // Ethereum curve
            pathFormat: "PATH_FORMAT_BIP32",
            path: "m/44'/60'/0'/0/0", // Standard Ethereum derivation path
            addressFormat: "ADDRESS_FORMAT_ETHEREUM",
          },
        ],
      });

      if (!response.walletId || !response.addresses || response.addresses.length === 0) {
        throw new Error("Turnkey wallet creation failed: Invalid response");
      }

      return {
        walletId: response.walletId,
        address: response.addresses[0], // First address from the wallet
      };
    } catch (error) {
      console.error("Error creating Turnkey wallet:", error);
      throw new Error(`Failed to create Turnkey wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Signs a transaction using Turnkey wallet
   *
   * @param params - Wallet ID and unsigned transaction
   * @returns Signed transaction hex
   */
  async signTransaction(params: SignTransactionParams): Promise<string> {
    try {
      const { walletId, unsignedTransaction } = params;

      const response = await this.client.signTransaction({
        organizationId: this.organizationId,
        signWith: walletId,
        type: "TRANSACTION_TYPE_ETHEREUM",
        unsignedTransaction,
      });

      if (!response.signedTransaction) {
        throw new Error("Turnkey signing failed: No signed transaction returned");
      }

      return response.signedTransaction;
    } catch (error) {
      console.error("Error signing transaction with Turnkey:", error);
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Gets wallet address from Turnkey (for verification)
   *
   * @param walletId - Turnkey wallet ID
   * @returns Ethereum address
   */
  async getWalletAddress(walletId: string): Promise<string> {
    try {
      const response = await this.client.getWallet({
        organizationId: this.organizationId,
        walletId,
      });

      if (!response.accounts || response.accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }

      return response.accounts[0].address;
    } catch (error) {
      console.error("Error getting wallet address from Turnkey:", error);
      throw new Error(`Failed to get wallet address: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Exports a wallet (for backup purposes only - requires user authentication)
   * WARNING: This exposes the private key. Use with extreme caution.
   *
   * @param walletId - Turnkey wallet ID
   * @returns Encrypted wallet bundle
   */
  async exportWallet(walletId: string): Promise<string> {
    try {
      const response = await this.client.exportWallet({
        organizationId: this.organizationId,
        walletId,
        targetPublicKey: process.env.TURNKEY_EXPORT_PUBLIC_KEY || "",
      });

      if (!response.exportBundle) {
        throw new Error("Export failed: No bundle returned");
      }

      return response.exportBundle;
    } catch (error) {
      console.error("Error exporting wallet from Turnkey:", error);
      throw new Error(`Failed to export wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

/**
 * Singleton instance of TurnkeyService
 */
let turnkeyService: TurnkeyService | null = null;

/**
 * Gets or creates the Turnkey service instance
 */
export function getTurnkeyService(): TurnkeyService {
  if (!turnkeyService) {
    const apiBaseUrl = process.env.TURNKEY_API_BASE_URL || "https://api.turnkey.com";
    const organizationId = process.env.TURNKEY_ORGANIZATION_ID;
    const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
    const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

    if (!organizationId || !apiPublicKey || !apiPrivateKey) {
      throw new Error(
        "Missing Turnkey configuration. Set TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, and TURNKEY_API_PRIVATE_KEY environment variables."
      );
    }

    turnkeyService = new TurnkeyService({
      apiBaseUrl,
      organizationId,
      apiPublicKey,
      apiPrivateKey,
    });
  }

  return turnkeyService;
}
