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
import { config, type SupportedNetwork } from "../utils/config";
import { getChainById, CHAIN_IDS } from "../utils/chains";
import { logger } from "../utils/logger";
import { getThirdwebTransactionService } from "./ThirdwebTransactionService";
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
        network: this.network,
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
   * Settle exact scheme payment on-chain using Thirdweb server wallet
   *
   * Flow:
   * 1. Verify the payment authorization
   * 2. Look up the sponsor wallet for the payer (consumer/client)
   * 3. Execute transferWithAuthorization via Thirdweb API
   *    - The sponsor wallet pays gas fees
   *    - USDC moves from payer to vendor
   */
  async settle(
    payload: ExactPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    try {
      // First verify
      const verifyResult = await this.verify(payload, requirements);
      if (!verifyResult.isValid) {
        return {
          success: false,
          errorReason: verifyResult.invalidReason || undefined,
          payer: null,
          transaction: null,
          network: this.network,
        };
      }

      const { authorization, signature } = payload;

      // Look up sponsor wallet for the payer (consumer/client)
      const thirdwebTxService = getThirdwebTransactionService();
      const sponsorWallet = await thirdwebTxService.findSponsorWallet(authorization.from);

      if (!sponsorWallet) {
        logger.error("No sponsor wallet found for payer", {
          payer: authorization.from,
        });
        return {
          success: false,
          errorReason: "No sponsor wallet configured for this payer",
          payer: authorization.from,
          transaction: null,
          network: this.network,
        };
      }

      logger.info("Found sponsor wallet for payer", {
        payer: authorization.from,
        sponsorWallet: sponsorWallet.sponsor_address,
        smartWallet: sponsorWallet.smart_wallet_address,
      });

      // Parse signature
      const sig = this.parseSignature(signature);

      // Execute transferWithAuthorization via Thirdweb server wallet
      const result = await thirdwebTxService.executeTransferWithAuthorization({
        network: this.network,
        tokenAddress: requirements.asset,
        sponsorWalletAddress: sponsorWallet.sponsor_address,
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

      if (result.success && result.transactionHash) {
        logger.info("Exact scheme payment settled via Thirdweb", {
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
          const resourceUrl = new URL(requirements.resource);
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
          network: this.network,
        };
      } else {
        return {
          success: false,
          errorReason: result.error || "Transaction failed",
          payer: authorization.from,
          transaction: null,
          network: this.network,
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
        network: this.network,
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

    // Validate amount
    const value = BigInt(auth.value);
    const maxAmount = BigInt(requirements.maxAmountRequired);
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
        name: "USD Coin", // Standard USDC name
        version: "2",
        chainId,
        verifyingContract: tokenAddress,
      };
      
      logger.info("Recovering signer", {
        network: this.network,
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

  private parseSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
    const sig = signature.slice(2); // Remove '0x'
    const r = `0x${sig.slice(0, 64)}` as Hex;
    const s = `0x${sig.slice(64, 128)}` as Hex;
    const v = parseInt(sig.slice(128, 130), 16);

    return { v, r, s };
  }
}
