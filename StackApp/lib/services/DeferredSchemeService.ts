import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  recoverTypedDataAddress,
  type Hex,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  DeferredPayload,
  Voucher,
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
  Address,
  StoredVoucher,
} from "../types/x402";
import { getPaymentAmount } from "../types/x402";
import { config, type SupportedNetwork } from "../utils/config";
import { getChainById, CHAIN_IDS } from "../utils/chains";
import { logger } from "../utils/logger";
import { networkToCAIP2 } from "../utils/x402-headers";
import { DEFERRED_ESCROW_ABI } from "../contracts/abi/index";

// Use full compiled ABI from deployed contract
const ESCROW_ABI = DEFERRED_ESCROW_ABI;

export class DeferredSchemeService {
  private network: SupportedNetwork;
  private chain: Chain;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private account?: Account;
  private escrowAddress: Address;
  private voucherStore: Map<string, StoredVoucher> = new Map();

  constructor(network: SupportedNetwork = config.defaultNetwork) {
    this.network = network;

    const escrowAddress = config.deferredEscrowAddresses[network];
    if (!escrowAddress) {
      throw new Error(`Deferred escrow address not configured for network: ${network}`);
    }

    this.escrowAddress = escrowAddress;

    const chainId = this.getChainIdForNetwork(network);
    const chain = getChainById(chainId);
    if (!chain) {
      throw new Error(`Chain configuration not found for network: ${network}`);
    }
    this.chain = chain;
    const rpcUrl = config.rpcUrls[network];

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });

    if (config.privateKey) {
      this.account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
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
   * Verify deferred scheme payment (EIP-712 voucher)
   */
  async verify(
    payload: DeferredPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      const { voucher, signature } = payload;

      // 1. Validate voucher fields
      if (!this.validateVoucher(voucher, requirements)) {
        return {
          isValid: false,
          invalidReason: "Voucher fields invalid",
          payer: null,
        };
      }

      // 2. Verify signature
      const signer = await this.recoverSigner(voucher, signature);

      if (!signer) {
        return {
          isValid: false,
          invalidReason: "Invalid signature",
          payer: null,
        };
      }

      // 3. Verify signer matches buyer
      if (signer.toLowerCase() !== voucher.buyer.toLowerCase()) {
        return {
          isValid: false,
          invalidReason: "Signer does not match buyer",
          payer: null,
        };
      }

      // 4. Check if already claimed
      const claimed = await this.isVoucherClaimed(voucher.id, BigInt(voucher.nonce));
      if (claimed) {
        return {
          isValid: false,
          invalidReason: "Voucher already claimed",
          payer: null,
        };
      }

      // 5. Check escrow balance
      const balance = await this.getEscrowBalance(
        voucher.buyer,
        voucher.seller,
        voucher.asset
      );

      const valueAggregate = BigInt(voucher.valueAggregate);
      if (balance < valueAggregate) {
        return {
          isValid: false,
          invalidReason: "Insufficient escrow balance",
          payer: null,
        };
      }

      logger.info("Deferred scheme payment verified", {
        voucherId: voucher.id,
        buyer: voucher.buyer,
        seller: voucher.seller,
        valueAggregate: voucher.valueAggregate.toString(),
        nonce: voucher.nonce.toString(),
      });

      return {
        isValid: true,
        invalidReason: null,
        payer: voucher.buyer,
      };
    } catch (error) {
      logger.error("Error verifying deferred scheme payment", {
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
   * Store voucher for later settlement (facilitator-managed)
   */
  async settle(
    payload: DeferredPayload,
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
          network: this.getNetworkCAIP2(),
        };
      }

      const { voucher, signature } = payload;

      // Store voucher
      const storedVoucher: StoredVoucher = {
        id: voucher.id,
        voucher,
        signature,
        buyer: voucher.buyer,
        seller: voucher.seller,
        asset: voucher.asset,
        nonce: BigInt(voucher.nonce),
        valueAggregate: BigInt(voucher.valueAggregate),
        timestamp: BigInt(voucher.timestamp),
        settled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const key = this.getVoucherKey(voucher.id, BigInt(voucher.nonce));
      this.voucherStore.set(key, storedVoucher);

      logger.info("Deferred scheme voucher stored", {
        voucherId: voucher.id,
        nonce: voucher.nonce.toString(),
        buyer: voucher.buyer,
      });

      return {
        success: true,
        payer: voucher.buyer,
        transaction: null, // No on-chain tx yet
        network: this.getNetworkCAIP2(),
      };
    } catch (error) {
      logger.error("Error storing deferred scheme voucher", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorReason: error instanceof Error ? error.message : "Storage failed",
        payer: null,
        transaction: null,
        network: this.getNetworkCAIP2(),
      };
    }
  }

  /**
   * Claim voucher on-chain
   */
  async claimVoucher(voucherId: Hex, nonce: bigint): Promise<SettleResponse> {
    try {
      if (!this.walletClient) {
        return {
          success: false,
          errorReason: "Wallet client not configured",
          payer: null,
          transaction: null,
          network: this.getNetworkCAIP2(),
        };
      }

      const key = this.getVoucherKey(voucherId, nonce);
      const storedVoucher = this.voucherStore.get(key);

      if (!storedVoucher) {
        return {
          success: false,
          errorReason: "Voucher not found",
          payer: null,
          transaction: null,
          network: this.getNetworkCAIP2(),
        };
      }

      if (storedVoucher.settled) {
        return {
          success: false,
          errorReason: "Voucher already settled",
          payer: storedVoucher.buyer,
          transaction: storedVoucher.settledTxHash || null,
          network: this.getNetworkCAIP2(),
        };
      }

      // Prepare voucher for contract call
      const voucherTuple = {
        id: storedVoucher.voucher.id,
        buyer: storedVoucher.voucher.buyer,
        seller: storedVoucher.voucher.seller,
        valueAggregate: BigInt(storedVoucher.voucher.valueAggregate),
        asset: storedVoucher.voucher.asset,
        timestamp: BigInt(storedVoucher.voucher.timestamp),
        nonce: BigInt(storedVoucher.voucher.nonce),
        escrow: storedVoucher.voucher.escrow,
        chainId: BigInt(storedVoucher.voucher.chainId),
      };

      // Call claimVoucher
      const hash = await this.walletClient.writeContract({
        account: this.account!,
        chain: this.chain,
        address: this.escrowAddress,
        abi: ESCROW_ABI,
        functionName: "claimVoucher",
        args: [voucherTuple, storedVoucher.signature],
      });

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        // Mark as settled
        storedVoucher.settled = true;
        storedVoucher.settledTxHash = hash;
        storedVoucher.updatedAt = new Date();
        this.voucherStore.set(key, storedVoucher);

        logger.info("Deferred scheme voucher claimed", {
          voucherId: storedVoucher.id,
          nonce: nonce.toString(),
          txHash: hash,
        });

        return {
          success: true,
          payer: storedVoucher.buyer,
          transaction: hash,
          network: this.getNetworkCAIP2(),
        };
      } else {
        return {
          success: false,
          errorReason: "Transaction reverted",
          payer: storedVoucher.buyer,
          transaction: hash,
          network: this.getNetworkCAIP2(),
        };
      }
    } catch (error) {
      logger.error("Error claiming voucher", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorReason: error instanceof Error ? error.message : "Claim failed",
        payer: null,
        transaction: null,
        network: this.getNetworkCAIP2(),
      };
    }
  }

  /**
   * Get stored vouchers
   */
  getVouchers(filters?: {
    buyer?: Address;
    seller?: Address;
    asset?: Address;
    settled?: boolean;
  }): StoredVoucher[] {
    let vouchers = Array.from(this.voucherStore.values());

    if (filters?.buyer) {
      vouchers = vouchers.filter(
        (v) => v.buyer.toLowerCase() === filters.buyer!.toLowerCase()
      );
    }

    if (filters?.seller) {
      vouchers = vouchers.filter(
        (v) => v.seller.toLowerCase() === filters.seller!.toLowerCase()
      );
    }

    if (filters?.asset) {
      vouchers = vouchers.filter(
        (v) => v.asset.toLowerCase() === filters.asset!.toLowerCase()
      );
    }

    if (filters?.settled !== undefined) {
      vouchers = vouchers.filter((v) => v.settled === filters.settled);
    }

    return vouchers;
  }

  /**
   * Get escrow balance
   */
  async getEscrowBalance(buyer: Address, seller: Address, asset: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.escrowAddress,
        abi: ESCROW_ABI,
        functionName: "getAvailableBalance",
        args: [buyer, seller, asset],
      });

      return balance;
    } catch (error) {
      logger.error("Error getting escrow balance", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0n;
    }
  }

  private validateVoucher(voucher: Voucher, requirements: PaymentRequirements): boolean {
    // Validate escrow address
    if (voucher.escrow.toLowerCase() !== this.escrowAddress.toLowerCase()) {
      return false;
    }

    // Validate chain ID
    const expectedChainId = this.getChainIdForNetwork(this.network);
    if (BigInt(voucher.chainId) !== BigInt(expectedChainId)) {
      return false;
    }

    // Validate seller
    if (voucher.seller.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return false;
    }

    // Validate amount - use V2 helper for both amount and maxAmountRequired fields
    const valueAggregate = BigInt(voucher.valueAggregate);
    const maxAmount = BigInt(getPaymentAmount(requirements));
    if (valueAggregate > maxAmount) {
      return false;
    }

    // Validate asset
    if (voucher.asset.toLowerCase() !== requirements.asset.toLowerCase()) {
      return false;
    }

    return true;
  }

  private async recoverSigner(voucher: Voucher, signature: Hex): Promise<Address | null> {
    try {
      const domain = {
        name: "X402DeferredEscrow",
        version: "1",
        chainId: Number(voucher.chainId),
        verifyingContract: this.escrowAddress,
      };

      const types = {
        Voucher: [
          { name: "id", type: "bytes32" },
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "valueAggregate", type: "uint256" },
          { name: "asset", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "nonce", type: "uint256" },
          { name: "escrow", type: "address" },
          { name: "chainId", type: "uint256" },
        ],
      };

      const message = {
        id: voucher.id,
        buyer: voucher.buyer,
        seller: voucher.seller,
        valueAggregate: BigInt(voucher.valueAggregate),
        asset: voucher.asset,
        timestamp: BigInt(voucher.timestamp),
        nonce: BigInt(voucher.nonce),
        escrow: voucher.escrow,
        chainId: BigInt(voucher.chainId),
      };

      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types,
        primaryType: "Voucher",
        message,
        signature,
      });

      return recoveredAddress;
    } catch (error) {
      logger.error("Error recovering voucher signer", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async isVoucherClaimed(voucherId: Hex, nonce: bigint): Promise<boolean> {
    try {
      const claimed = await this.publicClient.readContract({
        address: this.escrowAddress,
        abi: ESCROW_ABI,
        functionName: "voucherClaimed",
        args: [voucherId, nonce],
      });

      return claimed;
    } catch (error) {
      logger.error("Error checking voucher claimed status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private getVoucherKey(voucherId: Hex, nonce: bigint): string {
    return `${voucherId}-${nonce}`;
  }

  getEscrowAddress(): Address {
    return this.escrowAddress;
  }
}
