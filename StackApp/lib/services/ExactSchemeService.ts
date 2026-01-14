import {
  createPublicClient,
  http,
  type Hex,
  recoverTypedDataAddress,
} from "viem";
import type {
  ExactPayload,
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
  Address,
} from "../types/x402";
import { getPaymentAmount, getResourceUrl } from "../types/x402";
import { config, type SupportedNetwork } from "../utils/config";
import { getChainById, CHAIN_IDS } from "../utils/chains";
import { logger } from "../utils/logger";
import { networkToCAIP2 } from "../utils/x402-headers";
import { getEIP712Version, getTokenName } from "../utils/x402-payment";
import { getParaTransactionService } from "./ParaTransactionService";
import { getTransactionLoggingService } from "./TransactionLoggingService";

export class ExactSchemeService {
  private network: SupportedNetwork;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private publicClient: any;

  constructor(network: SupportedNetwork = config.defaultNetwork) {
    this.network = network;

    const chainId = this.getChainIdForNetwork(network);
    const chain = getChainById(chainId);
    const rpcUrl = config.rpcUrls[network];

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  private getChainIdForNetwork(network: SupportedNetwork): number {
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
   * Get network in V2 CAIP-2 format for responses
   */
  private getNetworkCAIP2(): string {
    return networkToCAIP2(this.network) || this.network;
  }

  /**
   * Verify exact scheme payment (EIP-3009)
   */
  async verify(
    payload: ExactPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      const { authorization, signature } = payload;

      // 1. Validate basic fields
      if (!this.validateAuthorization(authorization, requirements)) {
        return {
          isValid: false,
          invalidReason: "Authorization fields invalid",
          payer: null,
        };
      }

      // 2. Verify signature and recover signer
      const signer = await this.recoverSigner(authorization, signature, requirements.asset);

      if (!signer) {
        return {
          isValid: false,
          invalidReason: "Invalid signature",
          payer: null,
        };
      }

      // 3. Verify signer matches 'from' address
      logger.info("Signature verification details", {
        network: this.getNetworkCAIP2(),
        recoveredSigner: signer,
        fromAddress: authorization.from,
        signerMatch: signer.toLowerCase() === authorization.from.toLowerCase(),
      });
      
      if (signer.toLowerCase() !== authorization.from.toLowerCase()) {
        return {
          isValid: false,
          invalidReason: `Signer does not match 'from' address. Recovered: ${signer}, Expected: ${authorization.from}`,
          payer: null,
        };
      }

      // 4. Check token balance
      const hasBalance = await this.checkBalance(
        authorization.from,
        authorization.value,
        requirements.asset
      );

      if (!hasBalance) {
        return {
          isValid: false,
          invalidReason: "Insufficient balance",
          payer: null,
        };
      }

      // 5. Verify timing constraints
      const now = BigInt(Math.floor(Date.now() / 1000));
      const validAfter = BigInt(authorization.validAfter);
      const validBefore = BigInt(authorization.validBefore);

      if (now < validAfter) {
        return {
          isValid: false,
          invalidReason: "Authorization not yet valid",
          payer: null,
        };
      }

      if (now > validBefore) {
        return {
          isValid: false,
          invalidReason: "Authorization expired",
          payer: null,
        };
      }

      // 6. Check if nonce is already used on-chain (EIP-3009 authorizationState)
      const isNonceUsed = await this.checkNonceState(
        authorization.from,
        authorization.nonce as `0x${string}`,
        requirements.asset
      );

      if (isNonceUsed) {
        logger.warn("Authorization nonce already used or canceled", {
          from: authorization.from,
          nonce: authorization.nonce,
        });
        return {
          isValid: false,
          invalidReason: "Authorization nonce already used or canceled. Please sign a new payment.",
          payer: null,
        };
      }

      logger.info("Exact scheme payment verified", {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
      });

      return {
        isValid: true,
        invalidReason: null,
        payer: authorization.from,
      };
    } catch (error) {
      logger.error("Error verifying exact scheme payment", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        invalidReason: "Verification failed",
        payer: null,
      };
    }
  }

  /**
   * Settle exact scheme payment on-chain using Para server wallet
   *
   * Flow:
   * 1. Verify the payment authorization
   * 2. Look up the sponsor wallet for the payer (consumer/client)
   * 3. Execute transferWithAuthorization via Para signer
   *    - The sponsor wallet pays gas fees
   *    - USDC moves from payer to vendor
   */
  // Track in-flight settlements to prevent duplicates
  private static pendingSettlements = new Map<string, Promise<SettleResponse>>();

  async settle(
    payload: ExactPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const { authorization } = payload;

    // Create unique settlement key from nonce + from address
    const settlementKey = `${authorization.from.toLowerCase()}-${authorization.nonce}`;

    // Check if this exact settlement is already in progress
    const existingSettlement = ExactSchemeService.pendingSettlements.get(settlementKey);
    if (existingSettlement) {
      logger.warn("Settlement already in progress for this nonce, waiting for result", {
        settlementKey,
        nonce: authorization.nonce,
        from: authorization.from,
      });
      return existingSettlement;
    }

    // Create promise for this settlement
    const settlementPromise = this.executeSettlement(payload, requirements, settlementKey);
    ExactSchemeService.pendingSettlements.set(settlementKey, settlementPromise);

    try {
      return await settlementPromise;
    } finally {
      ExactSchemeService.pendingSettlements.delete(settlementKey);
    }
  }

  private async executeSettlement(
    payload: ExactPayload,
    requirements: PaymentRequirements,
    settlementKey: string
  ): Promise<SettleResponse> {
    try {
      const { authorization, signature } = payload;

      logger.info("Starting settlement", {
        settlementKey,
        nonce: authorization.nonce,
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
      });

      // First verify
      const verifyResult = await this.verify(payload, requirements);
      if (!verifyResult.isValid) {
        return {
          success: false,
          errorReason: verifyResult.invalidReason || undefined,
          payer: null,
          transaction: null,
          network: this.getNetworkCAIP2(),
        };
      }

      // Look up sponsor wallet for the payer (consumer/client)
      const paraTxService = getParaTransactionService();
      const sponsorWallet = await paraTxService.findSponsorWallet(authorization.from);

      if (!sponsorWallet) {
        logger.error("No sponsor wallet found for payer", {
          payer: authorization.from,
        });
        return {
          success: false,
          errorReason: "No sponsor wallet configured for this payer",
          payer: authorization.from,
          transaction: null,
          network: this.getNetworkCAIP2(),
        };
      }

      logger.info("Found sponsor wallet for payer", {
        payer: authorization.from,
        sponsorWallet: sponsorWallet.sponsor_address,
        smartWallet: sponsorWallet.smart_wallet_address,
      });

      // Parse signature
      const sig = this.parseSignature(signature);

      // Execute transferWithAuthorization via Para server wallet
      // Retry once with a delay if we get "authorization is used or canceled" error
      // (can happen due to RPC state sync timing issues)
      let result = await paraTxService.executeTransferWithAuthorization({
        network: this.network,
        tokenAddress: requirements.asset,
        sponsorWalletId: sponsorWallet.para_wallet_id,
        sponsorUserShare: sponsorWallet.para_user_share, // User share for server-side signing
        from: authorization.from,
        to: authorization.to,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce as Hex,
        v: sig.v,
        r: sig.r,
        s: sig.s,
      });

      // On ANY settlement failure, check if the nonce is actually used on-chain
      // This handles multiple scenarios:
      // 1. Race condition where Para reports failure but tx actually succeeded
      // 2. Malformed error responses that hide the actual "authorization used" error
      // 3. Client retrying a previously successful payment
      if (!result.success) {
        logger.warn("Settlement failed, checking if nonce was already used on-chain...", {
          originalError: result.error,
          nonce: authorization.nonce,
        });

        // Wait a moment for chain state to sync
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Re-check nonce state on-chain
        const isNonceActuallyUsed = await this.checkNonceState(
          authorization.from,
          authorization.nonce as `0x${string}`,
          requirements.asset
        );

        if (isNonceActuallyUsed) {
          // The nonce IS used on-chain - this means a previous transaction succeeded!
          // Try to find the transaction hash by looking at recent sponsor wallet transactions
          logger.info("Nonce confirmed used on-chain - previous transaction likely succeeded", {
            nonce: authorization.nonce,
            from: authorization.from,
          });

          // Look for the transaction in recent sponsor wallet activity
          const txHash = await this.findRecentTransferWithAuthorizationTx(
            sponsorWallet.sponsor_address as Address,
            authorization.from,
            authorization.to,
            requirements.asset
          );

          if (txHash) {
            logger.info("Found existing successful transaction for this authorization", {
              txHash,
              nonce: authorization.nonce,
            });
            return {
              success: true,
              payer: authorization.from,
              transaction: txHash,
              network: this.getNetworkCAIP2(),
            };
          } else {
            // Nonce is used but we can't find the tx hash - the payment DID succeed, just return success
            // This can happen if the tx was mined in a block we didn't search or if there's indexing delay
            logger.warn("Nonce used on-chain but could not find transaction hash - treating as success", {
              nonce: authorization.nonce,
            });
            return {
              success: true,  // Payment succeeded (nonce is used on-chain!)
              payer: authorization.from,
              transaction: null,  // Can't provide tx hash but payment went through
              network: this.getNetworkCAIP2(),
            };
          }
        } else {
          // Nonce is NOT used on-chain - this might be a transient error, retry
          logger.info("Nonce not used on-chain, retrying transaction...", {
            nonce: authorization.nonce,
          });

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Retry via Para server wallet
          result = await paraTxService.executeTransferWithAuthorization({
            network: this.network,
            tokenAddress: requirements.asset,
            sponsorWalletId: sponsorWallet.para_wallet_id,
            sponsorUserShare: sponsorWallet.para_user_share, // User share for server-side signing
            from: authorization.from,
            to: authorization.to,
            value: BigInt(authorization.value),
            validAfter: BigInt(authorization.validAfter),
            validBefore: BigInt(authorization.validBefore),
            nonce: authorization.nonce as Hex,
            v: sig.v,
            r: sig.r,
            s: sig.s,
          });

          logger.info("Retry result", { success: result.success, error: result.error });
        }
      }

      if (result.success && result.transactionHash) {
        logger.info("Exact scheme payment settled via Para", {
          txHash: result.transactionHash,
          from: authorization.from,
          to: authorization.to,
          value: authorization.value,
          sponsorWallet: sponsorWallet.sponsor_address,
          gasUsed: result.gasUsed,
          gasCostWei: result.gasCostWei,
        });

        // Log transaction to database for analytics
        const loggingService = getTransactionLoggingService();
        const chainId = this.getChainIdForNetwork(this.network);

        // Extract vendor domain and endpoint from resource URL
        let vendorDomain: string | undefined;
        let vendorEndpoint: string | undefined;
        try {
          const resourceUrlStr = getResourceUrl(requirements);
          const resourceUrl = new URL(resourceUrlStr);
          vendorDomain = resourceUrl.hostname;
          vendorEndpoint = resourceUrl.pathname;
        } catch {
          // Invalid URL, leave vendor info undefined
        }

        // Log the x402 transaction (USDC payment)
        await loggingService.logTransaction({
          transactionHash: result.transactionHash,
          payerAddress: authorization.from,
          recipientAddress: authorization.to,
          sponsorAddress: sponsorWallet.sponsor_address,
          amountWei: authorization.value,
          assetAddress: requirements.asset,
          assetSymbol: "USDC",
          network: this.network,
          scheme: "exact",
          status: "success",
          vendorDomain,
          vendorEndpoint,
        });

        // Log sponsor spending for gas analytics (actual gas cost paid by sponsor)
        // Only log if we have gas cost info, use "0" as fallback if receipt failed
        const gasCost = result.gasCostWei || "0";
        await loggingService.logSponsorSpending({
          sponsorWalletId: sponsorWallet.id,
          amountWei: gasCost, // Actual gas cost in native token wei (AVAX/ETH/CELO)
          agentAddress: authorization.from,
          transactionHash: result.transactionHash,
          chainId: chainId,
          networkName: this.network,
          serverDomain: vendorDomain,
          serverEndpoint: vendorEndpoint,
        });

        return {
          success: true,
          payer: authorization.from,
          transaction: result.transactionHash,
          network: this.getNetworkCAIP2(),
        };
      } else {
        return {
          success: false,
          errorReason: result.error || "Transaction failed",
          payer: authorization.from,
          transaction: null,
          network: this.getNetworkCAIP2(),
        };
      }
    } catch (error) {
      logger.error("Error settling exact scheme payment", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorReason: error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: this.getNetworkCAIP2(),
      };
    }
  }

  private validateAuthorization(
    auth: ExactPayload["authorization"],
    requirements: PaymentRequirements
  ): boolean {
    // Validate recipient
    if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return false;
    }

    // Validate amount - use V2 helper for both amount and maxAmountRequired fields
    const value = BigInt(auth.value);
    const maxAmount = BigInt(getPaymentAmount(requirements));
    if (value > maxAmount) {
      return false;
    }

    return true;
  }

  private async recoverSigner(
    authorization: ExactPayload["authorization"],
    signature: Hex,
    tokenAddress: Address
  ): Promise<Address | null> {
    try {
      const chainId = this.getChainIdForNetwork(this.network);
      const domain = {
        name: getTokenName(chainId), // Network-specific: Celo uses "USDC", others use "USD Coin"
        version: getEIP712Version(chainId), // Network-specific: Celo uses "1", others use "2"
        chainId,
        verifyingContract: tokenAddress,
      };
      
      logger.info("Recovering signer", {
        network: this.getNetworkCAIP2(),
        chainId,
        tokenAddress,
        domain,
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value,
          validAfter: authorization.validAfter,
          validBefore: authorization.validBefore,
          nonce: authorization.nonce,
        },
      });

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const message = {
        from: authorization.from,
        to: authorization.to,
        value: BigInt(authorization.value),
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce,
      };

      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
        signature,
      });
      
      logger.info("Signature recovery result", {
        recoveredAddress,
        signature: signature.substring(0, 20) + "...",
      });

      return recoveredAddress;
    } catch (error) {
      logger.error("Error recovering signer", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async checkBalance(
    address: Address,
    amount: string,
    tokenAddress: Address
  ): Promise<boolean> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "balanceOf",
        args: [address],
      });

      return balance >= BigInt(amount);
    } catch (error) {
      logger.error("Error checking balance", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if a nonce has already been used or canceled on-chain
   * EIP-3009 FiatTokenV2 tracks authorization state per (authorizer, nonce)
   */
  private async checkNonceState(
    authorizer: Address,
    nonce: `0x${string}`,
    tokenAddress: Address
  ): Promise<boolean> {
    try {
      const isUsed = await this.publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: "authorizationState",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "authorizer", type: "address" },
              { name: "nonce", type: "bytes32" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "authorizationState",
        args: [authorizer, nonce],
      });

      logger.info("Nonce state check", {
        authorizer,
        nonce,
        isUsed,
      });

      return isUsed as boolean;
    } catch (error) {
      // If the check fails, log warning but don't block the payment
      // (some tokens may not implement authorizationState)
      logger.warn("Error checking nonce state (token may not support EIP-3009)", {
        error: error instanceof Error ? error.message : String(error),
        authorizer,
        nonce,
      });
      return false;
    }
  }

  private parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
    const sig = signature.slice(2); // Remove '0x'
    const r = `0x${sig.slice(0, 64)}` as Hex;
    const s = `0x${sig.slice(64, 128)}` as Hex;
    const v = parseInt(sig.slice(128, 130), 16);

    return { v, r, s };
  }

  /**
   * Find a recent transferWithAuthorization transaction from sponsor to recipient
   * This helps recover the tx hash when Thirdweb reports failure but tx actually succeeded
   */
  private async findRecentTransferWithAuthorizationTx(
    sponsorAddress: Address,
    fromAddress: Address,
    toAddress: Address,
    tokenAddress: Address
  ): Promise<Hex | null> {
    try {
      // Wait a moment for block to be indexed (tx may have just been mined)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get current block AFTER the wait
      const currentBlock = await this.publicClient.getBlockNumber();
      // Look back further (~60 seconds worth of blocks) to catch tx that may have been mined during our wait
      const blocksToSearch = 30n; // ~60 seconds on Avalanche (2s block time)
      const fromBlock = currentBlock - blocksToSearch;

      logger.info("Searching for recent transferWithAuthorization tx", {
        sponsorAddress,
        fromAddress,
        toAddress,
        tokenAddress,
        fromBlock: fromBlock.toString(),
        toBlock: currentBlock.toString(),
      });

      // Look for Transfer events from the USDC contract where:
      // - from = fromAddress (the payer)
      // - to = toAddress (the vendor)
      const logs = await this.publicClient.getLogs({
        address: tokenAddress,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
          ],
        },
        args: {
          from: fromAddress,
          to: toAddress,
        },
        fromBlock,
        toBlock: "latest", // Use "latest" to ensure we catch very recent blocks
      });

      if (logs.length > 0) {
        // Return the most recent matching transaction
        const mostRecent = logs[logs.length - 1];
        logger.info("Found matching Transfer event", {
          txHash: mostRecent.transactionHash,
          blockNumber: mostRecent.blockNumber?.toString(),
        });
        return mostRecent.transactionHash as Hex;
      }

      logger.info("No matching Transfer events found in recent blocks");
      return null;
    } catch (error) {
      logger.warn("Error searching for recent transaction", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
