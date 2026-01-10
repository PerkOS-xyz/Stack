import { firebaseAdmin } from "../db/firebase";
import { logger } from "../utils/logger";
import { CHAIN_IDS, getRpcUrl, getChainById } from "../utils/chains";
import { getParaService } from "./ParaService";
import { ethers, Contract } from "ethers";
import { createPublicClient, http } from "viem";
import type { SupportedNetwork } from "../utils/config";
import type { Address, Hex } from "../types/x402";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  para_wallet_id: string;
  sponsor_address: string;
  smart_wallet_address?: string;
  balance: string;
}

// EIP-3009 transferWithAuthorization ABI
const TRANSFER_WITH_AUTHORIZATION_ABI = [
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
];

/**
 * ParaTransactionService - Executes transactions via Para server wallets
 *
 * Flow:
 * 1. Look up sponsor wallet for the payer (consumer/client) in database
 * 2. Use Para signer to execute transaction from that sponsor wallet
 * 3. The sponsor wallet pays gas fees, USDC moves from payer to vendor
 */
export class ParaTransactionService {
  constructor() {
    // Validate Para service is available
    getParaService();
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

      const { data: rule, error: ruleError } = await firebaseAdmin
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

        const { data: wallet, error: walletError } = await firebaseAdmin
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
      const { data: directWallet, error: directError } = await firebaseAdmin
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
   * Execute transferWithAuthorization via Para signer
   *
   * Uses Para's ethers.js compatible signer to execute EIP-3009 transfers
   */
  async executeTransferWithAuthorization(params: {
    network: SupportedNetwork;
    tokenAddress: Address;
    sponsorWalletId: string;
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
    const rpcUrl = getRpcUrl(params.network);

    logger.info("Executing transferWithAuthorization via Para", {
      chainId,
      tokenAddress: params.tokenAddress,
      sponsorWalletId: params.sponsorWalletId,
      from: params.from,
      to: params.to,
      value: params.value.toString(),
    });

    try {
      // Get Para signer for the sponsor wallet
      const paraService = getParaService();
      const signer = await paraService.getSigner(params.sponsorWalletId, rpcUrl);

      // Get signer address for logging
      const signerAddress = await signer.getAddress();
      logger.info("Using Para signer", { signerAddress });

      // Create contract instance with Para signer
      const tokenContract = new Contract(
        params.tokenAddress,
        TRANSFER_WITH_AUTHORIZATION_ABI,
        signer
      );

      // Execute transferWithAuthorization
      logger.info("Submitting transaction...");
      const tx = await tokenContract.transferWithAuthorization(
        params.from,
        params.to,
        params.value,
        params.validAfter,
        params.validBefore,
        params.nonce,
        params.v,
        params.r,
        params.s
      );

      logger.info("Transaction submitted", { hash: tx.hash });

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        logger.error("Transaction reverted", { hash: tx.hash });
        return {
          success: false,
          error: "Transaction reverted on-chain",
        };
      }

      const transactionHash = receipt.hash as Hex;
      const gasUsed = receipt.gasUsed.toString();
      const effectiveGasPrice = receipt.gasPrice?.toString() || "0";
      const gasCostWei = (receipt.gasUsed * (receipt.gasPrice || BigInt(0))).toString();

      logger.info("Transaction confirmed", {
        transactionHash,
        gasUsed,
        effectiveGasPrice,
        gasCostWei,
      });

      return {
        success: true,
        transactionHash,
        gasUsed,
        effectiveGasPrice,
        gasCostWei,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Error executing Para transaction", { error: errorMessage });

      // Extract revert reason if available
      let revertReason = errorMessage;
      if (errorMessage.includes("execution reverted")) {
        const match = errorMessage.match(/reason="([^"]+)"/);
        if (match) {
          revertReason = match[1];
        }
      }

      return {
        success: false,
        error: revertReason,
      };
    }
  }

  /**
   * Get transaction receipt to extract gas information
   */
  async getTransactionReceipt(
    transactionHash: Hex,
    chainId: number
  ): Promise<{ gasUsed?: string; effectiveGasPrice?: string; gasCostWei?: string }> {
    try {
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
}

/**
 * Singleton instance
 */
let paraTxService: ParaTransactionService | null = null;

/**
 * Gets or creates the Para transaction service instance
 */
export function getParaTransactionService(): ParaTransactionService {
  if (!paraTxService) {
    paraTxService = new ParaTransactionService();
  }
  return paraTxService;
}
