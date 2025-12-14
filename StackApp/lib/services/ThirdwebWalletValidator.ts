/**
 * Thirdweb Wallet Validator
 *
 * Validates if a wallet address exists as a server wallet in Thirdweb project
 * Uses Thirdweb's REST API to check wallet existence
 */

interface ThirdwebWallet {
  id: string;
  address: string;
  type: string;
  createdAt: string;
}

interface ThirdwebWalletsResponse {
  data: ThirdwebWallet[];
  total: number;
}

export class ThirdwebWalletValidator {
  private secretKey: string;
  private clientId: string;

  constructor() {
    this.secretKey = process.env.THIRDWEB_SECRET_KEY || "";
    this.clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "";

    if (!this.secretKey || !this.clientId) {
      throw new Error(
        "Missing Thirdweb credentials: THIRDWEB_SECRET_KEY and NEXT_PUBLIC_THIRDWEB_CLIENT_ID required"
      );
    }
  }

  /**
   * Lists all server wallets in the Thirdweb project
   */
  async listWallets(): Promise<ThirdwebWallet[]> {
    try {
      const response = await fetch(
        `https://embedded-wallet.thirdweb.com/api/2024-05-05/wallets`,
        {
          method: "GET",
          headers: {
            "x-client-id": this.clientId,
            "x-secret-key": this.secretKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Thirdweb API error: ${response.status} ${response.statusText}`);
      }

      const data: ThirdwebWalletsResponse = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Error listing Thirdweb wallets:", error);
      throw error;
    }
  }

  /**
   * Checks if a wallet address exists in Thirdweb project
   *
   * @param address - Ethereum address to check (case-insensitive)
   * @returns True if wallet exists, false otherwise
   */
  async walletExists(address: string): Promise<boolean> {
    try {
      const wallets = await this.listWallets();
      const normalizedAddress = address.toLowerCase();

      return wallets.some(
        (wallet) => wallet.address.toLowerCase() === normalizedAddress
      );
    } catch (error) {
      console.error("Error checking wallet existence:", error);
      // Return false on error to allow fallback behavior
      return false;
    }
  }

  /**
   * Gets wallet details by address
   *
   * @param address - Ethereum address to find
   * @returns Wallet details or null if not found
   */
  async getWalletByAddress(address: string): Promise<ThirdwebWallet | null> {
    try {
      const wallets = await this.listWallets();
      const normalizedAddress = address.toLowerCase();

      return wallets.find(
        (wallet) => wallet.address.toLowerCase() === normalizedAddress
      ) || null;
    } catch (error) {
      console.error("Error getting wallet by address:", error);
      return null;
    }
  }

  /**
   * Gets total count of server wallets in project
   */
  async getWalletCount(): Promise<number> {
    try {
      const wallets = await this.listWallets();
      return wallets.length;
    } catch (error) {
      console.error("Error getting wallet count:", error);
      return 0;
    }
  }
}

/**
 * Singleton instance
 */
let validatorInstance: ThirdwebWalletValidator | null = null;

/**
 * Gets or creates validator instance
 */
export function getThirdwebValidator(): ThirdwebWalletValidator {
  if (!validatorInstance) {
    validatorInstance = new ThirdwebWalletValidator();
  }
  return validatorInstance;
}
