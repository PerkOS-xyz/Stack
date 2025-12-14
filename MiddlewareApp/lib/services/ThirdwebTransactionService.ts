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
    transactionIds?: string[];  // Array of transaction IDs for polling
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
  }): Promise<{
    success: boolean;
    transactionHash?: Hex;
    error?: string;
    gasUsed?: string;
    effectiveGasPrice?: string;
    gasCostWei?: string;
  }> {
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
      // Encode the transferWithAuthorization call data
      const { encodeFunctionData } = await import("viem");
      const callData = encodeFunctionData({
        abi: [
          {
            name: "transferWithAuthorization",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
              { name: "v", type: "uint8" },
              { name: "r", type: "bytes32" },
              { name: "s", type: "bytes32" },
            ],
            outputs: [],
          },
        ],
        functionName: "transferWithAuthorization",
        args: [
          params.from,
          params.to,
          params.value,
          params.validAfter,
          params.validBefore,
          params.nonce,
          params.v,
          params.r,
          params.s,
        ],
      });

      logger.info("Encoded call data", { callData: callData.slice(0, 20) + "..." });

      // Use Thirdweb Engine V3 write contract endpoint
      // https://engine.thirdweb.com/v1/write/contract with execution options in body
      // Force EOA execution type to avoid EIP-7702 (not supported on Avalanche)
      const requestBody = {
        executionOptions: {
          type: "EOA",
          from: params.sponsorWalletAddress,
          chainId: chainId,
        },
        params: [
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
      };

      logger.info("Thirdweb Engine V3 request", {
        endpoint: "https://engine.thirdweb.com/v1/write/contract",
        requestBody: JSON.stringify(requestBody, null, 2),
      });

      const response = await fetch(
        `https://engine.thirdweb.com/v1/write/contract`,
        {
          method: "POST",
          headers: {
            "x-secret-key": this.secretKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();

      logger.info("Thirdweb transaction submitted - FULL RESPONSE", {
        fullData: JSON.stringify(data, null, 2),
      });

      // Engine V3 format: { result: { transactions: [{ id: "...", ... }] } }
      // or direct: { transactions: [{ id: "...", ... }] }
      const transactions = data.result?.transactions || data.transactions;
      if (transactions && Array.isArray(transactions) && transactions.length > 0) {
        const transactionId = transactions[0].id;
        logger.info("Engine V3: Polling for transaction hash", { transactionId });
        const pollResult = await this.pollForTransaction(transactionId);
        if (pollResult.success && pollResult.transactionHash) {
          // Get gas info from receipt
          const gasInfo = await this.getTransactionReceipt(pollResult.transactionHash, chainId);
          return {
            success: true,
            transactionHash: pollResult.transactionHash,
            ...gasInfo,
          };
        }
        return {
          success: false,
          error: pollResult.error || "Transaction queued but failed to get hash",
        };
      }

      // Check for direct transactionHash at root level
      if (data.transactionHash) {
        const txHash = data.transactionHash as Hex;
        const gasInfo = await this.getTransactionReceipt(txHash, chainId);
        return {
          success: true,
          transactionHash: txHash,
          ...gasInfo,
        };
      }

      // Check for queueId at root level (backend wallet uses this)
      if (data.queueId) {
        logger.info("Polling for transaction hash", { queueId: data.queueId });
        const pollResult = await this.pollForTransaction(data.queueId);
        if (pollResult.success && pollResult.transactionHash) {
          const gasInfo = await this.getTransactionReceipt(pollResult.transactionHash, chainId);
          return {
            success: true,
            transactionHash: pollResult.transactionHash,
            ...gasInfo,
          };
        }
        return {
          success: false,
          error: pollResult.error || "Transaction queued but failed to get hash",
        };
      }

      // Check for result wrapper (contracts/write endpoint format)
      if (data.result) {
        // If we get a transaction hash directly, return it
        if (data.result.transactionHash) {
          const txHash = data.result.transactionHash as Hex;
          const gasInfo = await this.getTransactionReceipt(txHash, chainId);
          return {
            success: true,
            transactionHash: txHash,
            ...gasInfo,
          };
        }

        // If we get transactionIds array, poll for the first one
        if (data.result.transactionIds && data.result.transactionIds.length > 0) {
          const transactionId = data.result.transactionIds[0];
          logger.info("Polling for transaction hash", { transactionId });
          const pollResult = await this.pollForTransaction(transactionId);
          if (pollResult.success && pollResult.transactionHash) {
            const gasInfo = await this.getTransactionReceipt(pollResult.transactionHash, chainId);
            return {
              success: true,
              transactionHash: pollResult.transactionHash,
              ...gasInfo,
            };
          }
          return {
            success: false,
            error: pollResult.error || "Transaction submitted but failed to get hash",
          };
        }

        // If we get a queueId, we need to poll for the transaction hash
        if (data.result.queueId) {
          const pollResult = await this.pollForTransaction(data.result.queueId);
          if (pollResult.success && pollResult.transactionHash) {
            const gasInfo = await this.getTransactionReceipt(pollResult.transactionHash, chainId);
            return {
              success: true,
              transactionHash: pollResult.transactionHash,
              ...gasInfo,
            };
          }
          return {
            success: false,
            error: pollResult.error || "Transaction queued but failed to get hash",
          };
        }
      }

      return {
        success: false,
        error: "Unexpected response from Thirdweb API: " + JSON.stringify(data),
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
   * Get transaction receipt to extract gas information
   */
  private async getTransactionReceipt(
    transactionHash: Hex,
    chainId: number
  ): Promise<{ gasUsed?: string; effectiveGasPrice?: string; gasCostWei?: string }> {
    try {
      const { createPublicClient, http } = await import("viem");
      const { getChainById } = await import("../utils/chains");

      const chain = getChainById(chainId);
      const client = createPublicClient({
        chain,
        transport: http(),
      });

      const receipt = await client.getTransactionReceipt({
        hash: transactionHash,
      });

      if (receipt) {
        const gasUsed = receipt.gasUsed.toString();
        const effectiveGasPrice = receipt.effectiveGasPrice?.toString() || "0";
        const gasCostWei = (receipt.gasUsed * (receipt.effectiveGasPrice || BigInt(0))).toString();

        logger.info("Transaction receipt retrieved", {
          transactionHash,
          gasUsed,
          effectiveGasPrice,
          gasCostWei,
        });

        return { gasUsed, effectiveGasPrice, gasCostWei };
      }

      return {};
    } catch (error) {
      logger.warn("Error getting transaction receipt", {
        transactionHash,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * Poll for transaction hash from transaction ID
   * Returns object with success status, transaction hash, and error details
   */
  private async pollForTransaction(
    transactionId: string,
    maxAttempts = 30
  ): Promise<{
    success: boolean;
    transactionHash?: Hex;
    error?: string;
    gasUsed?: string;
    effectiveGasPrice?: string;
    gasCostWei?: string;
  }> {
    logger.info("Starting transaction poll", { transactionId, maxAttempts });

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(
          `https://api.thirdweb.com/v1/transactions/${transactionId}`,
          {
            headers: {
              "x-secret-key": this.secretKey,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();

          logger.info("Transaction poll response", {
            transactionId,
            attempt: i + 1,
            status: data.result?.status || data.status,
            hasHash: !!(data.result?.transactionHash || data.transactionHash),
          });

          // Check various response formats
          const txHash = data.result?.transactionHash || data.transactionHash;
          const status = (data.result?.status || data.status || "").toLowerCase();

          if (txHash) {
            logger.info("Transaction hash received", { transactionId, txHash });
            return { success: true, transactionHash: txHash as Hex };
          }

          // Check for failed status (case-insensitive)
          if (status === "failed" || status === "errored" || status === "error") {
            // Extract all possible error information from Thirdweb response
            // Check for nested inner error (billing/bundler errors)
            const innerError = data.result?.executionResult?.error?.innerError;
            let detailedError = "";
            if (innerError?.kind?.body) {
              try {
                const bodyError = JSON.parse(innerError.kind.body);
                detailedError = bodyError.error || "";
              } catch {
                detailedError = innerError.message || "";
              }
            }

            const errorMessage =
              detailedError ||
              data.result?.executionResult?.error?.errorCode ||
              data.result?.errorMessage ||
              data.errorMessage ||
              data.result?.error ||
              data.error ||
              data.result?.failureReason ||
              data.failureReason ||
              data.result?.revertReason ||
              data.revertReason ||
              "Unknown error";

            logger.error("Transaction failed - FULL RESPONSE", {
              transactionId,
              status,
              errorMessage,
              fullData: JSON.stringify(data, null, 2),
            });
            return { success: false, error: errorMessage };
          }

          // Check for success status (case-insensitive)
          if (status === "confirmed" || status === "mined" || status === "success") {
            // Transaction confirmed but hash might be in a different field
            const hash = data.result?.hash || data.hash || data.result?.onChainTxHash;
            if (hash) {
              logger.info("Transaction confirmed with hash", { transactionId, hash });
              return { success: true, transactionHash: hash as Hex };
            }
          }
        } else {
          const errorText = await response.text();
          logger.warn("Transaction poll error response", {
            transactionId,
            attempt: i + 1,
            status: response.status,
            error: errorText,
          });
        }

        // Wait 2 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        logger.warn("Error polling transaction", {
          transactionId,
          attempt: i + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.error("Transaction polling timeout", { transactionId });
    return { success: false, error: "Transaction polling timeout" };
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
