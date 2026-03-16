import {
  ExactStellarScheme,
} from "@x402/stellar/exact/facilitator";
import {
  createEd25519Signer,
  STELLAR_PUBNET_CAIP2,
} from "@x402/stellar";
import type {
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
} from "../types/x402";
import { logger } from "../utils/logger";

/**
 * Stellar Exact Scheme Service
 *
 * Wraps @x402/stellar ExactStellarScheme for verify/settle on Stellar network.
 * Analogous to ExactSchemeService.ts but for Stellar (not EVM).
 */
export class StellarExactSchemeService {
  private scheme: ExactStellarScheme;

  constructor() {
    const stellarSecret = process.env.STELLAR_FACILITATOR_SECRET;
    if (!stellarSecret) {
      throw new Error("STELLAR_FACILITATOR_SECRET env var is required for StellarExactSchemeService");
    }

    const rpcUrl = process.env.STELLAR_SOROBAN_RPC_URL;

    const signer = createEd25519Signer(stellarSecret, STELLAR_PUBNET_CAIP2);

    this.scheme = new ExactStellarScheme([signer], {
      rpcConfig: rpcUrl ? { url: rpcUrl } : undefined,
      areFeesSponsored: true,
    });

    logger.info("StellarExactSchemeService initialized", {
      network: STELLAR_PUBNET_CAIP2,
      signerAddress: signer.address,
    });
  }

  /**
   * Verify a Stellar x402 payment
   */
  async verify(
    payload: { x402Version: number; scheme: string; network: string; payload: unknown },
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      const result = await this.scheme.verify(
        payload as any,
        requirements as any,
      );

      logger.info("Stellar exact scheme verify result", {
        isValid: result.isValid,
        invalidReason: result.invalidReason,
        payer: result.payer,
      });

      return {
        isValid: result.isValid,
        invalidReason: result.invalidReason ?? null,
        payer: (result.payer as `0x${string}` | null) ?? null,
      };
    } catch (error) {
      logger.error("Stellar exact scheme verify error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : "Verification failed",
        payer: null,
      };
    }
  }

  /**
   * Settle a Stellar x402 payment on-chain
   */
  async settle(
    payload: { x402Version: number; scheme: string; network: string; payload: unknown },
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      const result = await this.scheme.settle(
        payload as any,
        requirements as any,
      );

      logger.info("Stellar exact scheme settle result", {
        success: result.success,
        transaction: result.transaction,
        network: result.network,
      });

      return {
        success: result.success,
        errorReason: result.errorReason ?? undefined,
        payer: (result.payer ?? null) as `0x${string}` | null,
        transaction: (result.transaction ?? null) as `0x${string}` | null,
        network: (result.network ?? STELLAR_PUBNET_CAIP2) as `0x${string}`,
      };
    } catch (error) {
      logger.error("Stellar exact scheme settle error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        errorReason: error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: STELLAR_PUBNET_CAIP2,
      };
    }
  }
}
