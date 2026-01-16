import { firebaseAdmin } from "../db/firebase";
import { logger } from "../utils/logger";
import { CHAIN_IDS } from "../utils/chains";
import type { SupportedNetwork } from "../utils/config";

/**
 * Transaction data to be logged
 */
export interface TransactionLogData {
  transactionHash: string;
  payerAddress: string;
  recipientAddress: string;
  sponsorAddress?: string;
  amountWei: string;
  amountUsd?: number;
  assetAddress: string;
  assetSymbol?: string;
  network: SupportedNetwork;
  scheme: "exact" | "deferred";
  vendorDomain?: string;
  vendorEndpoint?: string;
  status: "success" | "failed" | "pending";
  errorMessage?: string;
  gasFeeWei?: string;
  gasFeeUsd?: number;
}

/**
 * Sponsor spending data to be logged
 */
export interface SponsorSpendingData {
  sponsorWalletId: string;
  amountWei: string;
  agentAddress: string;
  transactionHash: string;
  serverDomain?: string;
  serverEndpoint?: string;
  chainId: number;
  networkName: string;
}

/**
 * TransactionLoggingService - Logs x402 transactions and sponsor spending to database
 */
export class TransactionLoggingService {
  /**
   * Get chain ID for network
   */
  private getChainId(network: SupportedNetwork): number {
    const chainIdMap: Record<SupportedNetwork, number> = {
      avalanche: CHAIN_IDS.AVALANCHE,
      "avalanche-fuji": CHAIN_IDS.AVALANCHE_FUJI,
      celo: CHAIN_IDS.CELO,
      "celo-sepolia": CHAIN_IDS.CELO_SEPOLIA,
      base: CHAIN_IDS.BASE,
      "base-sepolia": CHAIN_IDS.BASE_SEPOLIA,
      ethereum: CHAIN_IDS.ETHEREUM,
      sepolia: CHAIN_IDS.SEPOLIA,
      polygon: CHAIN_IDS.POLYGON,
      "polygon-amoy": CHAIN_IDS.POLYGON_AMOY,
      monad: CHAIN_IDS.MONAD,
      "monad-testnet": CHAIN_IDS.MONAD_TESTNET,
      arbitrum: CHAIN_IDS.ARBITRUM,
      "arbitrum-sepolia": CHAIN_IDS.ARBITRUM_SEPOLIA,
      optimism: CHAIN_IDS.OPTIMISM,
      "optimism-sepolia": CHAIN_IDS.OPTIMISM_SEPOLIA,
    };
    return chainIdMap[network];
  }

  /**
   * Convert wei amount to USD (assuming USDC with 6 decimals)
   */
  private weiToUsd(amountWei: string): number {
    try {
      const wei = BigInt(amountWei);
      // USDC has 6 decimals, so 1 USDC = 1_000_000 wei
      const usd = Number(wei) / 1_000_000;
      return Math.round(usd * 1_000_000) / 1_000_000; // Round to 6 decimals
    } catch {
      return 0;
    }
  }

  /**
   * Log a x402 transaction to the database
   */
  async logTransaction(data: TransactionLogData): Promise<{ success: boolean; error?: string }> {
    try {
      const chainId = this.getChainId(data.network);
      const amountUsd = data.amountUsd ?? this.weiToUsd(data.amountWei);

      logger.info("Logging x402 transaction", {
        transactionHash: data.transactionHash,
        payer: data.payerAddress,
        recipient: data.recipientAddress,
        amountWei: data.amountWei,
        amountUsd,
        network: data.network,
        scheme: data.scheme,
      });

      // Build insert object, filtering out undefined values (Firestore doesn't allow undefined)
      const insertData: Record<string, unknown> = {
        transaction_hash: data.transactionHash,
        payer_address: data.payerAddress.toLowerCase(),
        recipient_address: data.recipientAddress.toLowerCase(),
        amount_wei: data.amountWei,
        amount_usd: amountUsd,
        asset_address: data.assetAddress.toLowerCase(),
        asset_symbol: data.assetSymbol || "USDC",
        network: data.network,
        chain_id: chainId,
        scheme: data.scheme,
        status: data.status,
      };

      // Add optional fields only if they have values
      if (data.sponsorAddress) insertData.sponsor_address = data.sponsorAddress.toLowerCase();
      if (data.vendorDomain) insertData.vendor_domain = data.vendorDomain;
      if (data.vendorEndpoint) insertData.vendor_endpoint = data.vendorEndpoint;
      if (data.errorMessage) insertData.error_message = data.errorMessage;
      if (data.gasFeeWei) insertData.gas_fee_wei = data.gasFeeWei;
      if (data.gasFeeUsd !== undefined) insertData.gas_fee_usd = data.gasFeeUsd;

      const { error } = await firebaseAdmin.from("perkos_x402_transactions").insert(insertData);

      if (error) {
        // Check if it's a duplicate (transaction already logged)
        if ((error as { code?: string }).code === "23505") {
          logger.warn("Transaction already logged", { transactionHash: data.transactionHash });
          return { success: true }; // Not really an error
        }

        logger.error("Failed to log transaction", {
          error: error.message,
          transactionHash: data.transactionHash,
        });
        return { success: false, error: error.message };
      }

      logger.info("Transaction logged successfully", {
        transactionHash: data.transactionHash,
      });
      return { success: true };
    } catch (error) {
      logger.error("Error logging transaction", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Log sponsor wallet spending to the database
   */
  async logSponsorSpending(data: SponsorSpendingData): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("Logging sponsor spending", {
        sponsorWalletId: data.sponsorWalletId,
        amountWei: data.amountWei,
        agentAddress: data.agentAddress,
        transactionHash: data.transactionHash,
      });

      // Build insert object, filtering out undefined values (Firestore doesn't allow undefined)
      const insertData: Record<string, unknown> = {
        sponsor_wallet_id: data.sponsorWalletId,
        amount_wei: data.amountWei,
        agent_address: data.agentAddress.toLowerCase(),
        transaction_hash: data.transactionHash,
        chain_id: data.chainId.toString(),
        network_name: data.networkName,
        spent_at: new Date().toISOString(), // Timestamp for analytics ordering
      };

      // Add optional fields only if they have values
      if (data.serverDomain) insertData.server_domain = data.serverDomain;
      if (data.serverEndpoint) insertData.server_endpoint = data.serverEndpoint;

      const { error } = await firebaseAdmin.from("perkos_sponsor_spending").insert(insertData);

      if (error) {
        logger.error("Failed to log sponsor spending", {
          error: error.message,
          transactionHash: data.transactionHash,
        });
        return { success: false, error: error.message };
      }

      logger.info("Sponsor spending logged successfully", {
        transactionHash: data.transactionHash,
      });
      return { success: true };
    } catch (error) {
      logger.error("Error logging sponsor spending", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

/**
 * Singleton instance
 */
let loggingService: TransactionLoggingService | null = null;

/**
 * Gets or creates the transaction logging service instance
 */
export function getTransactionLoggingService(): TransactionLoggingService {
  if (!loggingService) {
    loggingService = new TransactionLoggingService();
  }
  return loggingService;
}
