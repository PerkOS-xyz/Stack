import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Hex,
  recoverTypedDataAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  ExactPayload,
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
  Address,
} from "../types/x402";
import { config, type SupportedNetwork } from "../utils/config";
import { getChainById, CHAIN_IDS, USDC_ADDRESSES } from "../utils/chains";
import { logger } from "../utils/logger";

// EIP-3009 ABI for transferWithAuthorization
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
] as const;

export class ExactSchemeService {
  private network: SupportedNetwork;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(network: SupportedNetwork = config.defaultNetwork) {
    this.network = network;

    const chainId = this.getChainIdForNetwork(network);
    const chain = getChainById(chainId);
    const rpcUrl = config.rpcUrls[network];

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    if (config.privateKey) {
      const account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
      });
    }
  }

  private getChainIdForNetwork(network: SupportedNetwork): number {
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
      if (signer.toLowerCase() !== authorization.from.toLowerCase()) {
        return {
          isValid: false,
          invalidReason: "Signer does not match 'from' address",
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
   * Settle exact scheme payment on-chain
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
          error: verifyResult.invalidReason,
          payer: null,
          transaction: null,
          network: this.network,
        };
      }

      if (!this.walletClient) {
        return {
          success: false,
          error: "Wallet client not configured",
          payer: null,
          transaction: null,
          network: this.network,
        };
      }

      const { authorization, signature } = payload;

      // Parse signature
      const sig = this.parseSignature(signature);

      // Call transferWithAuthorization
      const hash = await this.walletClient.writeContract({
        address: requirements.asset,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "transferWithAuthorization",
        args: [
          authorization.from,
          authorization.to,
          BigInt(authorization.value),
          BigInt(authorization.validAfter),
          BigInt(authorization.validBefore),
          authorization.nonce,
          sig.v,
          sig.r,
          sig.s,
        ],
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        logger.info("Exact scheme payment settled", {
          txHash: hash,
          from: authorization.from,
          to: authorization.to,
          value: authorization.value,
        });

        return {
          success: true,
          error: null,
          payer: authorization.from,
          transaction: hash,
          network: this.network,
        };
      } else {
        return {
          success: false,
          error: "Transaction reverted",
          payer: authorization.from,
          transaction: hash,
          network: this.network,
        };
      }
    } catch (error) {
      logger.error("Error settling exact scheme payment", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Settlement failed",
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
