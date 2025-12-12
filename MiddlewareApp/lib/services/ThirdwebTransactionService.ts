import { supabaseAdmin } from "../db/supabase";
import { logger } from "../utils/logger";
import { CHAIN_IDS } from "../utils/chains";
import type { SupportedNetwork } from "../utils/config";
import type { Address, Hex } from "../types/x402";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  turnkey_wallet_id: string;
  sponsor_address: string;
  smart_wallet_address?: string;
  balance: string;
}

interface ThirdwebTransactionResponse {
  result: {
    transactionHash?: string;
    queueId?: string;
    status?: string;
  };
}

/**
 * ThirdwebTransactionService - Executes transactions via Thirdweb server wallets
 *
 * Flow:
 * 1. Look up sponsor wallet for the payer (consumer/client) in database
 * 2. Use Thirdweb API to execute transaction from that sponsor wallet
 * 3. The sponsor wallet pays gas fees, USDC moves from payer to vendor
 */
export class ThirdwebTransactionService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.THIRDWEB_SECRET_KEY || "";
    if (!this.secretKey) {
      throw new Error("THIRDWEB_SECRET_KEY not configured");
    }
  }

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
   * Find sponsor wallet for a wallet address
   *
   * Lookup order:
   * 1. Check if address is a whitelisted agent in perkos_sponsor_rules
   * 2. Fall back to direct user_wallet_address lookup in perkos_sponsor_wallets
   */
  async findSponsorWallet(walletAddress: string): Promise<SponsorWallet | null> {
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // 1. First, check if this address is a whitelisted agent
      logger.info("Looking up sponsor wallet for address", { walletAddress: normalizedAddress });

      const { data: rule, error: ruleError } = await supabaseAdmin
        .from("perkos_sponsor_rules")
        .select("sponsor_wallet_id")
        .eq("rule_type", "agent_whitelist")
        .eq("agent_address", normalizedAddress)
        .eq("enabled", true)
        .order("priority", { ascending: false })
        .limit(1)
        .single();

      if (rule && !ruleError) {
        // Found a whitelist rule - get the sponsor wallet
        logger.info("Found agent whitelist rule", {
          walletAddress: normalizedAddress,
          sponsorWalletId: rule.sponsor_wallet_id,
        });

        const { data: wallet, error: walletError } = await supabaseAdmin
          .from("perkos_sponsor_wallets")
          .select("*")
          .eq("id", rule.sponsor_wallet_id)
          .single();

        if (wallet && !walletError) {
          logger.info("Found sponsor wallet via whitelist", {
            agentAddress: normalizedAddress,
            sponsorAddress: wallet.sponsor_address,
          });
          return wallet as SponsorWallet;
        }
      }

      // 2. Fall back to direct user_wallet_address lookup
      const { data: directWallet, error: directError } = await supabaseAdmin
        .from("perkos_sponsor_wallets")
        .select("*")
        .eq("user_wallet_address", normalizedAddress)
        .single();

      if (directWallet && !directError) {
        logger.info("Found sponsor wallet via direct lookup", {
          userWalletAddress: normalizedAddress,
          sponsorAddress: directWallet.sponsor_address,
        });
        return directWallet as SponsorWallet;
      }

      logger.warn("No sponsor wallet found for address", {
        walletAddress: normalizedAddress,
        checkedWhitelist: true,
        checkedDirectLookup: true,
      });
      return null;
    } catch (error) {
      logger.error("Error finding sponsor wallet", {
        error: error instanceof Error ? error.message : String(error),
        walletAddress: normalizedAddress,
      });
      return null;
    }
  }

  /**
   * Execute transferWithAuthorization via Thirdweb server wallet
   *
   * Uses POST https://api.thirdweb.com/v1/contracts/write
   */
  async executeTransferWithAuthorization(params: {
    network: SupportedNetwork;
    tokenAddress: Address;
    sponsorWalletAddress: string;
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    v: number;
    r: Hex;
    s: Hex;
  }): Promise<{ success: boolean; transactionHash?: Hex; error?: string }> {
    const chainId = this.getChainId(params.network);

    logger.info("Executing transferWithAuthorization via Thirdweb", {
      chainId,
      tokenAddress: params.tokenAddress,
      sponsorWallet: params.sponsorWalletAddress,
      from: params.from,
      to: params.to,
      value: params.value.toString(),
    });

    try {
      // Use Thirdweb contract write API
      const response = await fetch("https://api.thirdweb.com/v1/contracts/write", {
        method: "POST",
        headers: {
          "x-secret-key": this.secretKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chainId,
          from: params.sponsorWalletAddress,
          calls: [
            {
              contractAddress: params.tokenAddress,
              method: "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
              params: [
                params.from,
                params.to,
                params.value.toString(),
                params.validAfter.toString(),
                params.validBefore.toString(),
                params.nonce,
                params.v,
                params.r,
                params.s,
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Thirdweb API error", {
          status: response.status,
          error: errorText,
        });
        return {
          success: false,
          error: `Thirdweb API error: ${response.status} - ${errorText}`,
        };
      }

      const data: ThirdwebTransactionResponse = await response.json();

      logger.info("Thirdweb transaction submitted", {
        result: data.result,
      });

      // If we get a transaction hash directly, return it
      if (data.result.transactionHash) {
        return {
          success: true,
          transactionHash: data.result.transactionHash as Hex,
        };
      }

      // If we get a queueId, we need to poll for the transaction hash
      if (data.result.queueId) {
        const txHash = await this.pollForTransaction(data.result.queueId);
        if (txHash) {
          return {
            success: true,
            transactionHash: txHash,
          };
        }
        return {
          success: false,
          error: "Transaction queued but failed to get hash",
        };
      }

      return {
        success: false,
        error: "Unexpected response from Thirdweb API",
      };
    } catch (error) {
      logger.error("Error executing Thirdweb transaction", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      };
    }
  }

  /**
   * Poll for transaction hash from queue
   */
  private async pollForTransaction(queueId: string, maxAttempts = 30): Promise<Hex | null> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(
          `https://api.thirdweb.com/v1/transactions/${queueId}`,
          {
            headers: {
              "x-secret-key": this.secretKey,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.result?.transactionHash) {
            return data.result.transactionHash as Hex;
          }
          if (data.result?.status === "failed") {
            logger.error("Transaction failed", { queueId, data });
            return null;
          }
        }

        // Wait 2 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        logger.warn("Error polling transaction", {
          queueId,
          attempt: i + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.error("Transaction polling timeout", { queueId });
    return null;
  }
}

/**
 * Singleton instance
 */
let thirdwebTxService: ThirdwebTransactionService | null = null;

/**
 * Gets or creates the Thirdweb transaction service instance
 */
export function getThirdwebTransactionService(): ThirdwebTransactionService {
  if (!thirdwebTxService) {
    thirdwebTxService = new ThirdwebTransactionService();
  }
  return thirdwebTxService;
}
