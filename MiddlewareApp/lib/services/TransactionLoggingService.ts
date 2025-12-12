import { supabaseAdmin } from "../db/supabase";
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

      const { error } = await supabaseAdmin.from("perkos_x402_transactions").insert({
        transaction_hash: data.transactionHash,
        payer_address: data.payerAddress.toLowerCase(),
        recipient_address: data.recipientAddress.toLowerCase(),
        sponsor_address: data.sponsorAddress?.toLowerCase(),
        amount_wei: data.amountWei,
        amount_usd: amountUsd,
        asset_address: data.assetAddress.toLowerCase(),
        asset_symbol: data.assetSymbol || "USDC",
        network: data.network,
        chain_id: chainId,
        scheme: data.scheme,
        vendor_domain: data.vendorDomain,
        vendor_endpoint: data.vendorEndpoint,
        status: data.status,
        error_message: data.errorMessage,
      });

      if (error) {
        // Check if it's a duplicate (transaction already logged)
        if (error.code === "23505") {
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

      const { error } = await supabaseAdmin.from("perkos_sponsor_spending").insert({
        sponsor_wallet_id: data.sponsorWalletId,
        amount_wei: data.amountWei,
        agent_address: data.agentAddress.toLowerCase(),
        transaction_hash: data.transactionHash,
        server_domain: data.serverDomain,
        server_endpoint: data.serverEndpoint,
        chain_id: data.chainId.toString(),
        network_name: data.networkName,
      });

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
