import { firebaseAdmin } from "../db/firebase";
import { logger } from "../utils/logger";
import { CHAIN_IDS, getChainById, chains } from "../utils/chains";
import { getParaService } from "./ParaService";
import { ethers, Contract } from "ethers";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { getRpcUrl, type SupportedNetwork } from "../utils/config";
import type { Address, Hex } from "../types/x402";

interface SponsorWallet {
  id: string;
  user_wallet_address: string;
  network: string;
  para_wallet_id: string;
  para_user_share?: string; // User share for server-side signing
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
   * 1. Check if address is a whitelisted agent in perkos_sponsor_rules (agent_whitelist)
   * 2. Check if domain is whitelisted in perkos_sponsor_rules (domain_whitelist)
   * 3. Fall back to direct user_wallet_address lookup in perkos_sponsor_wallets
   *
   * @param walletAddress - The wallet address making the payment
   * @param domain - Optional domain/hostname of the service (e.g., "localhost:3001", "aura.perkos.xyz")
   */
  async findSponsorWallet(walletAddress: string, domain?: string): Promise<SponsorWallet | null> {
    const normalizedAddress = walletAddress.toLowerCase();
    const normalizedDomain = domain?.toLowerCase();

    try {
      // 1. First, check if this address is a whitelisted agent
      logger.info("Looking up sponsor wallet", { walletAddress: normalizedAddress, domain: normalizedDomain });

      const { data: agentRules, error: agentRuleError } = await firebaseAdmin
        .from("perkos_sponsor_rules")
        .select("sponsor_wallet_id")
        .eq("rule_type", "agent_whitelist")
        .eq("agent_address", normalizedAddress)
        .eq("enabled", true)
        .order("priority", { ascending: false })
        .limit(1);

      const agentRule = agentRules?.[0];

      if (agentRule && !agentRuleError) {
        // Found an agent whitelist rule - get the sponsor wallet
        logger.info("Found agent whitelist rule", {
          walletAddress: normalizedAddress,
          sponsorWalletId: agentRule.sponsor_wallet_id,
        });

        const { data: wallet, error: walletError } = await firebaseAdmin
          .from("perkos_sponsor_wallets")
          .select("*")
          .eq("id", agentRule.sponsor_wallet_id)
          .single();

        if (wallet && !walletError) {
          logger.info("Found sponsor wallet via agent whitelist", {
            agentAddress: normalizedAddress,
            sponsorAddress: wallet.sponsor_address,
          });
          return wallet as SponsorWallet;
        }
      }

      // 2. Check if domain is whitelisted (domain_whitelist rules)
      if (normalizedDomain) {
        // Try exact domain match first, then partial match (for subdomains)
        const { data: domainRules, error: domainRuleError } = await firebaseAdmin
          .from("perkos_sponsor_rules")
          .select("sponsor_wallet_id, domain")
          .eq("rule_type", "domain_whitelist")
          .eq("enabled", true)
          .order("priority", { ascending: false });

        // Debug: Log what rules were found
        logger.info("Domain whitelist query result", {
          searchDomain: normalizedDomain,
          rulesFound: domainRules?.length ?? 0,
          rules: domainRules?.map(r => ({ domain: r.domain, walletId: r.sponsor_wallet_id })) ?? [],
          error: domainRuleError?.message,
        });

        if (domainRules && !domainRuleError) {
          // Find matching domain rule (exact match or subdomain match)
          const matchingRule = domainRules.find(rule => {
            if (!rule.domain) return false;
            const ruleDomain = rule.domain.toLowerCase().trim();
            const searchDomain = normalizedDomain.trim();
            const isMatch = searchDomain === ruleDomain ||
                   searchDomain.endsWith('.' + ruleDomain) ||
                   ruleDomain.includes(searchDomain);
            logger.info("Domain matching check", {
              ruleDomain,
              searchDomain,
              exactMatch: searchDomain === ruleDomain,
              subdomainMatch: searchDomain.endsWith('.' + ruleDomain),
              partialMatch: ruleDomain.includes(searchDomain),
              isMatch,
            });
            return isMatch;
          });

          if (matchingRule) {
            logger.info("Found domain whitelist rule", {
              domain: normalizedDomain,
              matchedDomain: matchingRule.domain,
              sponsorWalletId: matchingRule.sponsor_wallet_id,
            });

            const { data: wallet, error: walletError } = await firebaseAdmin
              .from("perkos_sponsor_wallets")
              .select("*")
              .eq("id", matchingRule.sponsor_wallet_id)
              .single();

            if (wallet && !walletError) {
              logger.info("Found sponsor wallet via domain whitelist", {
                domain: normalizedDomain,
                sponsorAddress: wallet.sponsor_address,
              });
              return wallet as SponsorWallet;
            }
          }
        }
      }

      // 3. Fall back to direct user_wallet_address lookup
      // Use order + limit instead of .single() to handle users with multiple sponsor wallets
      // Returns the most recently created wallet by default
      const { data: directWallets, error: directError } = await firebaseAdmin
        .from("perkos_sponsor_wallets")
        .select("*")
        .eq("user_wallet_address", normalizedAddress)
        .order("created_at", { ascending: false })
        .limit(1);

      const directWallet = directWallets?.[0];

      if (directWallet && !directError) {
        logger.info("Found sponsor wallet via direct lookup", {
          userWalletAddress: normalizedAddress,
          sponsorAddress: directWallet.sponsor_address,
        });
        return directWallet as SponsorWallet;
      }

      logger.warn("No sponsor wallet found", {
        walletAddress: normalizedAddress,
        domain: normalizedDomain,
        checkedAgentWhitelist: true,
        checkedDomainWhitelist: !!normalizedDomain,
        checkedDirectLookup: true,
      });
      return null;
    } catch (error) {
      logger.error("Error finding sponsor wallet", {
        error: error instanceof Error ? error.message : String(error),
        walletAddress: normalizedAddress,
        domain: normalizedDomain,
      });
      return null;
    }
  }

  /**
   * Detect if keyMaterial is from Dynamic provider (JSON with externalServerKeyShares)
   */
  private isDynamicKeyMaterial(keyMaterial: string): boolean {
    try {
      const parsed = JSON.parse(keyMaterial);
      return parsed && typeof parsed === 'object' && 'externalServerKeyShares' in parsed;
    } catch {
      return false;
    }
  }

  /**
   * Execute transferWithAuthorization via Dynamic wallet service (viem)
   */
  private async executeViaDynamic(params: {
    network: SupportedNetwork;
    tokenAddress: Address;
    sponsorWalletId: string;
    sponsorKeyMaterial: string;
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
    const chain = chains[params.network];

    if (!chain) {
      return { success: false, error: `Unsupported network: ${params.network}` };
    }

    logger.info("Executing transferWithAuthorization via Dynamic (viem)", {
      chainId,
      tokenAddress: params.tokenAddress,
      sponsorWalletId: params.sponsorWalletId,
      from: params.from,
      to: params.to,
      value: params.value.toString(),
    });

    try {
      // Import wallet service dynamically to avoid circular dependencies
      const { getServerWalletService } = await import("@/lib/wallet/server");
      const walletService = await getServerWalletService();

      if (!walletService.isInitialized()) {
        return { success: false, error: "Wallet service not initialized" };
      }

      // Get viem wallet client for the sponsor wallet
      const walletClient = await walletService.getViemClient(
        params.sponsorWalletId,
        chain,
        params.sponsorKeyMaterial
      );

      if (!walletClient.account) {
        return { success: false, error: "Wallet client account not found" };
      }

      logger.info("Using Dynamic wallet client", {
        address: walletClient.account.address,
      });

      // Encode the function call data
      const data = encodeFunctionData({
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "transferWithAuthorization",
        args: [
          params.from,
          params.to,
          params.value,
          params.validAfter,
          params.validBefore,
          params.nonce,
          params.v,
          params.r as `0x${string}`,
          params.s as `0x${string}`,
        ],
      });

      logger.info("Submitting transaction via viem...");
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: params.tokenAddress as `0x${string}`,
        data,
        chain,
      });

      logger.info("Transaction submitted", { hash });

      // Create public client for waiting for receipt
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrl(params.network)),
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === "reverted") {
        logger.error("Transaction reverted", { hash });
        return { success: false, error: "Transaction reverted on-chain" };
      }

      const transactionHash = receipt.transactionHash as Hex;
      const gasUsed = receipt.gasUsed.toString();
      const effectiveGasPrice = receipt.effectiveGasPrice?.toString() || "0";
      const gasCostWei = (receipt.gasUsed * (receipt.effectiveGasPrice || BigInt(0))).toString();

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
      logger.error("Error executing Dynamic transaction", { error: errorMessage });

      let revertReason = errorMessage;
      if (errorMessage.includes("execution reverted")) {
        const match = errorMessage.match(/reason="([^"]+)"/);
        if (match) {
          revertReason = match[1];
        }
      }

      return { success: false, error: revertReason };
    }
  }

  /**
   * Execute transferWithAuthorization via Para signer (ethers.js)
   */
  private async executeViaPara(params: {
    network: SupportedNetwork;
    tokenAddress: Address;
    sponsorWalletId: string;
    sponsorUserShare: string;
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

    logger.info("Executing transferWithAuthorization via Para (ethers)", {
      chainId,
      tokenAddress: params.tokenAddress,
      sponsorWalletId: params.sponsorWalletId,
      from: params.from,
      to: params.to,
      value: params.value.toString(),
    });

    try {
      const paraService = getParaService();
      const signer = await paraService.getSigner(params.sponsorWalletId, rpcUrl, params.sponsorUserShare);

      const signerAddress = await signer.getAddress();
      logger.info("Using Para signer", { signerAddress });

      const tokenContract = new Contract(
        params.tokenAddress,
        TRANSFER_WITH_AUTHORIZATION_ABI,
        signer
      );

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

      const receipt = await tx.wait();

      if (receipt.status === 0) {
        logger.error("Transaction reverted", { hash: tx.hash });
        return { success: false, error: "Transaction reverted on-chain" };
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

      let revertReason = errorMessage;
      if (errorMessage.includes("execution reverted")) {
        const match = errorMessage.match(/reason="([^"]+)"/);
        if (match) {
          revertReason = match[1];
        }
      }

      return { success: false, error: revertReason };
    }
  }

  /**
   * Execute transferWithAuthorization via the appropriate wallet provider
   *
   * Automatically detects provider (Dynamic vs Para) based on keyMaterial format:
   * - Dynamic: JSON with externalServerKeyShares
   * - Para: Simple string (userShare)
   */
  async executeTransferWithAuthorization(params: {
    network: SupportedNetwork;
    tokenAddress: Address;
    sponsorWalletId: string;
    sponsorUserShare?: string; // Key material for server-side signing (userShare for Para, keyMaterial for Dynamic)
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
    if (!params.sponsorUserShare) {
      logger.error("Missing sponsor key material for transaction signing");
      return {
        success: false,
        error: "Sponsor wallet missing key material - please recreate the wallet",
      };
    }

    // Detect provider based on keyMaterial format
    const isDynamic = this.isDynamicKeyMaterial(params.sponsorUserShare);

    logger.info("Detected wallet provider", {
      provider: isDynamic ? "dynamic" : "para",
      walletId: params.sponsorWalletId,
    });

    if (isDynamic) {
      return this.executeViaDynamic({
        network: params.network,
        tokenAddress: params.tokenAddress,
        sponsorWalletId: params.sponsorWalletId,
        sponsorKeyMaterial: params.sponsorUserShare,
        from: params.from,
        to: params.to,
        value: params.value,
        validAfter: params.validAfter,
        validBefore: params.validBefore,
        nonce: params.nonce,
        v: params.v,
        r: params.r,
        s: params.s,
      });
    } else {
      return this.executeViaPara({
        network: params.network,
        tokenAddress: params.tokenAddress,
        sponsorWalletId: params.sponsorWalletId,
        sponsorUserShare: params.sponsorUserShare,
        from: params.from,
        to: params.to,
        value: params.value,
        validAfter: params.validAfter,
        validBefore: params.validBefore,
        nonce: params.nonce,
        v: params.v,
        r: params.r,
        s: params.s,
      });
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
