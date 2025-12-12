import type {
  X402VerifyRequest,
  X402SettleRequest,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
  PaymentPayload,
} from "../types/x402";
import { ExactSchemeService } from "./ExactSchemeService";
import { DeferredSchemeService } from "./DeferredSchemeService";
import { config, type SupportedNetwork } from "../utils/config";
import { SUPPORTED_NETWORKS } from "../utils/chains";
import { logger } from "../utils/logger";

export class X402Service {
  private exactSchemes: Map<SupportedNetwork, ExactSchemeService> = new Map();
  private deferredSchemes: Map<SupportedNetwork, DeferredSchemeService> = new Map();

  constructor() {
    // Initialize exact scheme for all networks
    for (const network of SUPPORTED_NETWORKS) {
      this.exactSchemes.set(network, new ExactSchemeService(network));
    }

    // Initialize deferred scheme for networks with escrow configured
    if (config.deferredEnabled) {
      for (const network of SUPPORTED_NETWORKS) {
        const escrowAddress = config.deferredEscrowAddresses[network];
        if (escrowAddress) {
          try {
            this.deferredSchemes.set(network, new DeferredSchemeService(network));
            logger.info("Deferred scheme enabled", {
              network,
              escrowAddress,
            });
          } catch (error) {
            logger.warn(`Failed to initialize deferred scheme for ${network}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  private isValidNetwork(network: string): network is SupportedNetwork {
    return SUPPORTED_NETWORKS.includes(network as SupportedNetwork);
  }

  private getExactScheme(network: SupportedNetwork): ExactSchemeService {
    const service = this.exactSchemes.get(network);
    if (!service) {
      throw new Error(`Exact scheme not initialized for network: ${network}`);
    }
    return service;
  }

  private getDeferredSchemeForNetwork(network: SupportedNetwork): DeferredSchemeService | null {
    return this.deferredSchemes.get(network) || null;
  }

  /**
   * Verify payment payload
   */
  async verify(request: X402VerifyRequest): Promise<VerifyResponse> {
    const { paymentPayload, paymentRequirements } = request;

    // Validate versions
    if (request.x402Version !== 1 || paymentPayload.x402Version !== 1) {
      return {
        isValid: false,
        invalidReason: "Unsupported x402 version",
        payer: null,
      };
    }

    // Validate network
    if (!this.isValidNetwork(paymentPayload.network)) {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${paymentPayload.network}`,
        payer: null,
      };
    }

    // Validate network consistency
    if (paymentPayload.network !== paymentRequirements.network) {
      return {
        isValid: false,
        invalidReason: "Network mismatch between payload and requirements",
        payer: null,
      };
    }

    // Validate schemes match
    if (paymentPayload.scheme !== paymentRequirements.scheme) {
      return {
        isValid: false,
        invalidReason: "Scheme mismatch",
        payer: null,
      };
    }

    const network = paymentPayload.network;

    // Route to appropriate scheme
    if (paymentPayload.scheme === "exact") {
      const exactScheme = this.getExactScheme(network);
      return exactScheme.verify(
        paymentPayload.payload as any,
        paymentRequirements
      );
    } else if (paymentPayload.scheme === "deferred") {
      const deferredScheme = this.getDeferredSchemeForNetwork(network);
      if (!deferredScheme) {
        return {
          isValid: false,
          invalidReason: `Deferred scheme not enabled for network: ${network}`,
          payer: null,
        };
      }

      return deferredScheme.verify(
        paymentPayload.payload as any,
        paymentRequirements
      );
    } else {
      return {
        isValid: false,
        invalidReason: "Unsupported scheme",
        payer: null,
      };
    }
  }

  /**
   * Settle payment
   */
  async settle(request: X402SettleRequest): Promise<SettleResponse> {
    const { paymentPayload, paymentRequirements } = request;

    // Validate versions
    if (request.x402Version !== 1 || paymentPayload.x402Version !== 1) {
      return {
        success: false,
        errorReason: "Unsupported x402 version",
        payer: null,
        transaction: null,
        network: paymentPayload.network || config.defaultNetwork,
      };
    }

    // Validate network
    if (!this.isValidNetwork(paymentPayload.network)) {
      return {
        success: false,
        errorReason: `Unsupported network: ${paymentPayload.network}`,
        payer: null,
        transaction: null,
        network: paymentPayload.network || config.defaultNetwork,
      };
    }

    // Validate network consistency
    if (paymentPayload.network !== paymentRequirements.network) {
      return {
        success: false,
        errorReason: "Network mismatch between payload and requirements",
        payer: null,
        transaction: null,
        network: paymentPayload.network,
      };
    }

    // Validate schemes match
    if (paymentPayload.scheme !== paymentRequirements.scheme) {
      return {
        success: false,
        errorReason: "Scheme mismatch",
        payer: null,
        transaction: null,
        network: paymentPayload.network,
      };
    }

    const network = paymentPayload.network;

    // Route to appropriate scheme
    if (paymentPayload.scheme === "exact") {
      const exactScheme = this.getExactScheme(network);
      return exactScheme.settle(
        paymentPayload.payload as any,
        paymentRequirements
      );
    } else if (paymentPayload.scheme === "deferred") {
      const deferredScheme = this.getDeferredSchemeForNetwork(network);
      if (!deferredScheme) {
        return {
          success: false,
          errorReason: `Deferred scheme not enabled for network: ${network}`,
          payer: null,
          transaction: null,
          network,
        };
      }

      return deferredScheme.settle(
        paymentPayload.payload as any,
        paymentRequirements
      );
    } else {
      return {
        success: false,
        errorReason: "Unsupported scheme",
        payer: null,
        transaction: null,
        network,
      };
    }
  }

  /**
   * Get supported schemes/networks
   */
  getSupported(): SupportedResponse {
    const kinds: SupportedResponse["kinds"] = [];

    // Add exact scheme for all networks
    for (const network of SUPPORTED_NETWORKS) {
      kinds.push({ scheme: "exact", network });
    }

    // Add deferred scheme for networks with escrow configured
    if (config.deferredEnabled) {
      for (const [network, deferredScheme] of this.deferredSchemes.entries()) {
        if (deferredScheme) {
          kinds.push({ scheme: "deferred", network });
        }
      }
    }

    return { kinds };
  }

  /**
   * Get all deferred scheme services
   */
  getAllDeferredSchemes(): Map<SupportedNetwork, DeferredSchemeService> {
    return new Map(this.deferredSchemes);
  }

  /**
   * Get deferred scheme service for specific network
   */
  getDeferredScheme(network: SupportedNetwork): DeferredSchemeService | null {
    return this.getDeferredSchemeForNetwork(network);
  }
}
