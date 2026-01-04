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

  /**
   * Convert CAIP-2 network format to legacy format
   * e.g., "eip155:43114" -> "avalanche"
   */
  private caip2ToLegacyNetwork(caip2: string): SupportedNetwork | null {
    const caip2Map: Record<string, SupportedNetwork> = {
      // Avalanche
      "eip155:43114": "avalanche",
      "eip155:43113": "avalanche-fuji",
      // Celo
      "eip155:42220": "celo",
      "eip155:11142220": "celo-sepolia",
      // Base
      "eip155:8453": "base",
      "eip155:84532": "base-sepolia",
      // Ethereum
      "eip155:1": "ethereum",
      "eip155:11155111": "sepolia",
      // Polygon
      "eip155:137": "polygon",
      "eip155:80002": "polygon-amoy",
      // Monad
      "eip155:10142": "monad",
      "eip155:10143": "monad-testnet",
      // Arbitrum
      "eip155:42161": "arbitrum",
      "eip155:421614": "arbitrum-sepolia",
      // Optimism
      "eip155:10": "optimism",
      "eip155:11155420": "optimism-sepolia",
    };
    return caip2Map[caip2] || null;
  }

  /**
   * Normalize network format (CAIP-2 or legacy) to legacy format
   */
  private normalizeNetwork(network: string): SupportedNetwork | null {
    // If already in legacy format, return as-is
    if (SUPPORTED_NETWORKS.includes(network as SupportedNetwork)) {
      return network as SupportedNetwork;
    }
    // If in CAIP-2 format, convert to legacy
    if (network.includes(":")) {
      return this.caip2ToLegacyNetwork(network);
    }
    return null;
  }

  private isValidNetwork(network: string): network is SupportedNetwork {
    // Accept both legacy format and CAIP-2 format
    return this.normalizeNetwork(network) !== null;
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

    // Validate versions - support both V1 and V2
    // V1: x402Version: 1, network: string (e.g., "base-sepolia")
    // V2: x402Version: 2, network: CAIP-2 (e.g., "eip155:84532")
    const isV1 = request.x402Version === 1 && paymentPayload.x402Version === 1;
    const isV2 = request.x402Version === 2 && paymentPayload.x402Version === 2;
    
    if (!isV1 && !isV2) {
      return {
        isValid: false,
        invalidReason: `Unsupported x402 version. Expected 1 or 2, got ${request.x402Version} (payload: ${paymentPayload.x402Version})`,
        payer: null,
      };
    }

    // Validate and normalize networks (support both legacy and CAIP-2)
    const normalizedPayloadNetwork = this.normalizeNetwork(paymentPayload.network);
    const normalizedRequirementsNetwork = this.normalizeNetwork(paymentRequirements.network);

    if (!normalizedPayloadNetwork) {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${paymentPayload.network}`,
        payer: null,
      };
    }

    if (!normalizedRequirementsNetwork) {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${paymentRequirements.network}`,
        payer: null,
      };
    }

    // Validate network consistency (compare normalized networks)
    if (normalizedPayloadNetwork !== normalizedRequirementsNetwork) {
      return {
        isValid: false,
        invalidReason: `Network mismatch between payload (${paymentPayload.network} -> ${normalizedPayloadNetwork}) and requirements (${paymentRequirements.network} -> ${normalizedRequirementsNetwork})`,
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

    // Use normalized network for scheme routing
    const network = normalizedPayloadNetwork;

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

    // Validate versions - support both V1 and V2
    // V1: x402Version: 1, network: string (e.g., "base-sepolia")
    // V2: x402Version: 2, network: CAIP-2 (e.g., "eip155:84532")
    const isV1 = request.x402Version === 1 && paymentPayload.x402Version === 1;
    const isV2 = request.x402Version === 2 && paymentPayload.x402Version === 2;
    
    if (!isV1 && !isV2) {
      return {
        success: false,
        errorReason: `Unsupported x402 version. Expected 1 or 2, got ${request.x402Version} (payload: ${paymentPayload.x402Version})`,
        payer: null,
        transaction: null,
        network: paymentPayload.network || config.defaultNetwork,
      };
    }

    // Validate and normalize networks (support both legacy and CAIP-2)
    const normalizedPayloadNetwork = this.normalizeNetwork(paymentPayload.network);
    const normalizedRequirementsNetwork = this.normalizeNetwork(paymentRequirements.network);

    if (!normalizedPayloadNetwork) {
      return {
        success: false,
        errorReason: `Unsupported network: ${paymentPayload.network}`,
        payer: null,
        transaction: null,
        network: paymentPayload.network || config.defaultNetwork,
      };
    }

    if (!normalizedRequirementsNetwork) {
      return {
        success: false,
        errorReason: `Unsupported network: ${paymentRequirements.network}`,
        payer: null,
        transaction: null,
        network: paymentPayload.network || config.defaultNetwork,
      };
    }

    // Validate network consistency (compare normalized networks to support mixed formats)
    if (normalizedPayloadNetwork !== normalizedRequirementsNetwork) {
      return {
        success: false,
        errorReason: `Network mismatch between payload (${paymentPayload.network} -> ${normalizedPayloadNetwork}) and requirements (${paymentRequirements.network} -> ${normalizedRequirementsNetwork})`,
        payer: null,
        transaction: null,
        network: normalizedPayloadNetwork,
      };
    }

    // Validate schemes match
    if (paymentPayload.scheme !== paymentRequirements.scheme) {
      return {
        success: false,
        errorReason: "Scheme mismatch",
        payer: null,
        transaction: null,
        network: normalizedPayloadNetwork,
      };
    }

    // Use normalized network for scheme routing
    const network = normalizedPayloadNetwork;

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
