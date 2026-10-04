import { ExactSvmScheme } from "@x402/svm/exact/facilitator";
import { toFacilitatorSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import bs58 from "bs58";
import type {
  VerifyResponse,
  SettleResponse,
  PaymentRequirements,
} from "../types/x402";
import { logger } from "../utils/logger";

/** Solana mainnet CAIP-2 (genesis hash). */
export const SOLANA_MAINNET_CAIP2 =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

/** Solana devnet CAIP-2. */
export const SOLANA_DEVNET_CAIP2 =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

function decodeSecretKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length < 32) {
      throw new Error("SOLANA_FACILITATOR_SECRET_KEY JSON array must be key bytes");
    }
    return Uint8Array.from(arr);
  }
  return bs58.decode(trimmed);
}

export function configuredSolanaNetworks(): string[] {
  const raw = process.env.SOLANA_X402_NETWORKS?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [SOLANA_MAINNET_CAIP2, SOLANA_DEVNET_CAIP2];
}

/**
 * Solana Exact Scheme Service
 *
 * Wraps @x402/svm ExactSvmScheme for verify/settle on Solana networks.
 * Analogous to StellarExactSchemeService.ts (non-EVM path).
 *
 * Use `SolanaExactSchemeService.create()` — kit signer creation is async.
 */
export class SolanaExactSchemeService {
  private scheme: ExactSvmScheme;
  readonly networks: readonly string[];
  readonly feePayer: string;

  private constructor(scheme: ExactSvmScheme, networks: string[], feePayer: string) {
    this.scheme = scheme;
    this.networks = networks;
    this.feePayer = feePayer;
  }

  static async create(): Promise<SolanaExactSchemeService> {
    const secret = process.env.SOLANA_FACILITATOR_SECRET_KEY;
    if (!secret) {
      throw new Error(
        "SOLANA_FACILITATOR_SECRET_KEY env var is required for SolanaExactSchemeService",
      );
    }

    const networks = configuredSolanaNetworks();
    const secretBytes = decodeSecretKey(secret);
    const keypair = await createKeyPairSignerFromBytes(secretBytes);

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      process.env.SOLANA_DEVNET_RPC_URL ||
      undefined;

    const facilitatorSigner = toFacilitatorSvmSigner(
      keypair,
      rpcUrl ? { url: rpcUrl } : undefined,
    );

    const scheme = new ExactSvmScheme(facilitatorSigner);
    logger.info("SolanaExactSchemeService initialized", {
      networks,
      feePayer: keypair.address,
      rpcConfigured: Boolean(rpcUrl),
    });

    return new SolanaExactSchemeService(scheme, networks, String(keypair.address));
  }

  supportsNetwork(network: string): boolean {
    return this.networks.includes(network) || network.startsWith("solana:");
  }

  async verify(
    payload: { x402Version: number; scheme: string; network: string; payload: unknown },
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      const result = await this.scheme.verify(payload as any, requirements as any);
      logger.info("Solana exact scheme verify result", {
        isValid: result.isValid,
        invalidReason: result.invalidReason,
        payer: result.payer,
        network: payload.network,
      });
      return {
        isValid: result.isValid,
        invalidReason: result.invalidReason ?? null,
        payer: (result.payer as `0x${string}` | null) ?? null,
      };
    } catch (error) {
      logger.error("Solana exact scheme verify error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : "Verification failed",
        payer: null,
      };
    }
  }

  async settle(
    payload: { x402Version: number; scheme: string; network: string; payload: unknown },
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      const result = await this.scheme.settle(payload as any, requirements as any);
      logger.info("Solana exact scheme settle result", {
        success: result.success,
        transaction: result.transaction,
        network: result.network,
      });
      return {
        success: result.success,
        errorReason: result.errorReason ?? undefined,
        payer: (result.payer ?? null) as `0x${string}` | null,
        transaction: (result.transaction ?? null) as `0x${string}` | null,
        network: (result.network ?? payload.network) as `0x${string}`,
      };
    } catch (error) {
      logger.error("Solana exact scheme settle error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        errorReason: error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: payload.network as `0x${string}`,
      };
    }
  }
}

/** Module-level lazy singleton so per-request `new X402Service()` can share init. */
let solanaSchemePromise: Promise<SolanaExactSchemeService | null> | null = null;

export function getSolanaExactScheme(): Promise<SolanaExactSchemeService | null> {
  if (!process.env.SOLANA_FACILITATOR_SECRET_KEY) {
    return Promise.resolve(null);
  }
  if (!solanaSchemePromise) {
    solanaSchemePromise = SolanaExactSchemeService.create().catch((error) => {
      logger.warn("Failed to initialize Solana exact scheme", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
  }
  return solanaSchemePromise;
}
