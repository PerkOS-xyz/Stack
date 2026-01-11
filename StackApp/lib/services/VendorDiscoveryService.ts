import { firebaseAdmin } from "../db/firebase";
import { logger } from "../utils/logger";
import type { Database, Json } from "../db/types";

type Vendor = Database["public"]["Tables"]["perkos_vendors"]["Row"];
type VendorInsert = Database["public"]["Tables"]["perkos_vendors"]["Insert"];
type VendorUpdate = Database["public"]["Tables"]["perkos_vendors"]["Update"];
type VendorEndpoint = Database["public"]["Tables"]["perkos_vendor_endpoints"]["Row"];
type VendorEndpointInsert = Database["public"]["Tables"]["perkos_vendor_endpoints"]["Insert"];
type VendorVerificationInsert = Database["public"]["Tables"]["perkos_vendor_verifications"]["Insert"];

// X402 Discovery response structure (standard format per x402.gitbook.io spec)
interface X402AcceptEntry {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: {
    name?: string;
    description?: string;
    version?: string;
  };
  // Standard X402 inputSchema/outputSchema for endpoint definition
  inputSchema?: {
    method?: string;
    type?: string;
  };
  outputSchema?: object | null;
}

interface X402DiscoveryResponse {
  // Standard X402 format (required fields per spec)
  x402Version?: number;
  accepts?: X402AcceptEntry[];
  resource?: string;
  type?: string;
  lastUpdated?: string;

  // Payment routes (optional, for multi-endpoint services)
  paymentRoutes?: {
    [path: string]: {
      price: string;
      description?: string;
      method?: string;
      requestSchema?: object;
      responseSchema?: object;
    };
  };

  // Extended/alternative format (used by some vendors like Places API)
  version?: string;
  service?: string;
  payment?: {
    protocol?: string;
    price?: string;
    network?: string;
    gasless?: boolean;
    facilitator?: string;
    payTo?: string;
  };
  endpoints?: {
    [path: string]: {
      method?: string;
      description?: string;
      payment_required?: boolean;
      inputSchema?: object;
      outputSchema?: object;
      tags?: string[];
    };
  };
  metadata?: {
    contact?: {
      website?: string;
      documentation?: string;
    };
  };

  // Common extended metadata
  name?: string;
  description?: string;
  contact?: string;
  documentation?: string;
  icon?: string;
}

interface DiscoveryResult {
  success: boolean;
  data?: X402DiscoveryResponse;
  error?: string;
  responseTimeMs: number;
}

interface VendorRegistrationRequest {
  url: string;
  name?: string;
  description?: string;
  category?: Vendor["category"];
  tags?: string[];
  iconUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
}

/**
 * Direct registration request - vendor provides full definition
 */
interface VendorDirectRegistrationRequest extends VendorRegistrationRequest {
  walletAddress: string;
  network: string;
  priceUsd?: string;
  facilitatorUrl?: string;
  endpoints: EndpointDefinition[];
}

interface EndpointDefinition {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description?: string;
  priceUsd: string;
  inputSchema?: object;
  outputSchema?: object;
}

interface VendorRegistrationResult {
  success: boolean;
  vendor?: Vendor;
  error?: string;
}

export class VendorDiscoveryService {
  private readonly DISCOVERY_TIMEOUT_MS = 10000; // 10 seconds
  private readonly DISCOVERY_PATH = "/.well-known/x402";

  /**
   * Fetch and validate X402 discovery endpoint for a vendor
   */
  async discoverVendor(baseUrl: string): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const discoveryUrl = this.buildDiscoveryUrl(baseUrl);

    console.log("[VendorDiscovery] Fetching:", discoveryUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DISCOVERY_TIMEOUT_MS);

      const response = await fetch(discoveryUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - startTime;
      console.log("[VendorDiscovery] Response status:", response.status, "in", responseTimeMs, "ms");

      if (!response.ok) {
        console.error("[VendorDiscovery] Non-OK response:", response.status, response.statusText);
        return {
          success: false,
          error: `Discovery endpoint returned ${response.status}: ${response.statusText}`,
          responseTimeMs,
        };
      }

      const data = (await response.json()) as X402DiscoveryResponse;
      console.log("[VendorDiscovery] Response data:", JSON.stringify(data, null, 2));

      // Check for standard X402 format (x402Version + accepts)
      const hasStandardFormat = data.x402Version && data.accepts && Array.isArray(data.accepts);

      // Check for extended format (payment object with network/price)
      const hasExtendedFormat = data.payment && (data.payment.network || data.payment.price);

      // Check for simple version format
      const hasVersionFormat = data.version && (data.endpoints || data.payment);

      console.log("[VendorDiscovery] Format check - standard:", hasStandardFormat, "extended:", hasExtendedFormat, "version:", hasVersionFormat);

      if (!hasStandardFormat && !hasExtendedFormat && !hasVersionFormat) {
        console.error("[VendorDiscovery] Invalid format - no matching X402 structure found");
        return {
          success: false,
          error: "Invalid X402 discovery response: missing required fields (needs x402Version+accepts OR payment object)",
          responseTimeMs,
        };
      }

      // Validate standard format if present
      if (hasStandardFormat) {
        if (data.accepts!.length === 0) {
          return {
            success: false,
            error: "Invalid X402 discovery response: no payment accepts defined",
            responseTimeMs,
          };
        }

        // Validate each accept entry has required fields
        for (const accept of data.accepts!) {
          if (!accept.scheme || !accept.network || !accept.payTo) {
            return {
              success: false,
              error: "Invalid X402 discovery response: accepts entry missing required fields",
              responseTimeMs,
            };
          }
        }
      }

      // Validate extended format if present (without standard format)
      if (!hasStandardFormat && hasExtendedFormat) {
        if (!data.payment?.network) {
          return {
            success: false,
            error: "Invalid X402 discovery response: payment.network is required",
            responseTimeMs,
          };
        }
      }

      return {
        success: true,
        data,
        responseTimeMs,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Discovery request timed out"
            : error.message
          : "Unknown error during discovery";

      return {
        success: false,
        error: errorMessage,
        responseTimeMs,
      };
    }
  }

  /**
   * Register a new vendor from their base URL
   */
  async registerVendor(request: VendorRegistrationRequest): Promise<VendorRegistrationResult> {
    const { url, name, description, category, tags, iconUrl, websiteUrl, docsUrl } = request;

    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);
    const discoveryUrl = this.buildDiscoveryUrl(normalizedUrl);

    // Check if vendor already exists
    console.log("[VendorRegistration] Checking if vendor exists:", normalizedUrl);
    const { data: existingVendor } = await firebaseAdmin
      .from("perkos_vendors")
      .select("id")
      .eq("url", normalizedUrl)
      .single();

    if (existingVendor) {
      console.log("[VendorRegistration] Vendor already exists with ID:", existingVendor.id);
      return {
        success: false,
        error: "Vendor with this URL is already registered",
      };
    }

    // Discover vendor's X402 endpoint
    console.log("[VendorRegistration] Starting discovery for:", normalizedUrl);
    const discovery = await this.discoverVendor(normalizedUrl);

    if (!discovery.success || !discovery.data) {
      return {
        success: false,
        error: discovery.error || "Failed to discover vendor X402 endpoint",
      };
    }

    const discoveryData = discovery.data;

    // Extract payment info from either standard or extended format
    const hasStandardFormat = discoveryData.accepts && discoveryData.accepts.length > 0;
    const primaryAccept = hasStandardFormat ? discoveryData.accepts![0] : null;

    // Get wallet address - from standard accepts or need to fetch from elsewhere
    // For extended format, wallet is typically not in discovery (server handles it)
    const walletAddress = primaryAccept?.payTo || discoveryData.payment?.payTo || "0x0000000000000000000000000000000000000000";

    // Get network from either format
    const network = primaryAccept?.network || discoveryData.payment?.network || "base";

    // Get price from either format
    const priceUsd = primaryAccept?.maxAmountRequired ||
      discoveryData.payment?.price?.replace(/^\$/, "") ||
      null;

    // Get facilitator URL from extended format
    const facilitatorUrl = discoveryData.payment?.facilitator || null;

    // Extract vendor info from discovery or use provided values
    const vendorInsert: VendorInsert = {
      name: name || discoveryData.name || discoveryData.service || primaryAccept?.extra?.name || this.extractNameFromUrl(normalizedUrl),
      description: description || discoveryData.description || primaryAccept?.extra?.description || null,
      url: normalizedUrl,
      discovery_url: discoveryUrl,
      wallet_address: walletAddress,
      network: network,
      chain_id: this.getChainIdFromNetwork(network),
      price_usd: priceUsd,
      asset: primaryAccept?.asset || "USDC",
      facilitator_url: facilitatorUrl,
      category: category || "api",
      tags: tags || [],
      status: "pending",
      verification_status: "verified",
      last_verified_at: new Date().toISOString(),
      icon_url: iconUrl || discoveryData.icon || null,
      website_url: websiteUrl || discoveryData.metadata?.contact?.website || null,
      docs_url: docsUrl || discoveryData.documentation || discoveryData.metadata?.contact?.documentation || null,
      discovery_metadata: discoveryData as unknown as Database["public"]["Tables"]["perkos_vendors"]["Insert"]["discovery_metadata"],
      // Initialize stats fields (Firestore doesn't have schema defaults)
      total_transactions: 0,
      successful_transactions: 0,
      total_volume: "0",
      average_response_time_ms: 0,
    };

    // Insert vendor - use type assertion for Supabase client
    const { data: vendorData, error: vendorError } = await firebaseAdmin
      .from("perkos_vendors")
      .insert(vendorInsert as never)
      .select()
      .single();

    const vendor = vendorData as Vendor | null;

    if (vendorError || !vendor) {
      logger.error("Failed to insert vendor", { error: vendorError });
      return {
        success: false,
        error: vendorError?.message || "Failed to create vendor record",
      };
    }

    // Insert endpoints if available in discovery (from paymentRoutes, endpoints, or accepts)
    const endpointsToInsert: VendorEndpointInsert[] = [];

    // Standard format: paymentRoutes
    if (discoveryData.paymentRoutes) {
      for (const [path, route] of Object.entries(discoveryData.paymentRoutes)) {
        endpointsToInsert.push({
          vendor_id: vendor.id,
          path,
          method: route.method || "GET",
          description: route.description || null,
          price_usd: route.price,
          request_schema: (route.requestSchema as Json) || null,
          response_schema: (route.responseSchema as Json) || null,
          is_active: true,
        });
      }
    }

    // Standard X402 format: accepts array with resource endpoints
    if (discoveryData.accepts && discoveryData.accepts.length > 0) {
      for (const accept of discoveryData.accepts) {
        // Extract path from resource URL
        let endpointPath = "/";
        try {
          const resourceUrl = new URL(accept.resource);
          endpointPath = resourceUrl.pathname;
        } catch {
          endpointPath = accept.resource || "/";
        }

        // Skip if we already have this endpoint
        if (endpointsToInsert.some(e => e.path === endpointPath)) continue;

        endpointsToInsert.push({
          vendor_id: vendor.id,
          path: endpointPath,
          method: accept.inputSchema?.method || "GET",
          description: accept.description || accept.extra?.description || null,
          price_usd: accept.maxAmountRequired || "0",
          request_schema: (accept.inputSchema as Json) || null,
          response_schema: (accept.outputSchema as Json) || null,
          is_active: true,
        });
      }
    }

    // Extended format: endpoints
    if (discoveryData.endpoints) {
      for (const [path, endpoint] of Object.entries(discoveryData.endpoints)) {
        // Skip if we already have this endpoint from paymentRoutes or accepts
        if (endpointsToInsert.some(e => e.path === path)) continue;

        endpointsToInsert.push({
          vendor_id: vendor.id,
          path,
          method: endpoint.method || "GET",
          description: endpoint.description || null,
          price_usd: priceUsd || "0", // Use vendor-level price
          request_schema: (endpoint.inputSchema as Json) || null,
          response_schema: (endpoint.outputSchema as Json) || null,
          is_active: true,
        });
      }
    }

    if (endpointsToInsert.length > 0) {
      const { error: endpointError } = await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .insert(endpointsToInsert as never);

      if (endpointError) {
        logger.warn("Failed to insert vendor endpoints", { error: endpointError });
      }
    }

    // Record verification
    const verificationInsert: VendorVerificationInsert = {
      vendor_id: vendor.id,
      success: true,
      response_time_ms: discovery.responseTimeMs,
      discovery_data: discoveryData as Json,
    };
    await firebaseAdmin.from("perkos_vendor_verifications").insert(verificationInsert as never);

    // Activate vendor
    await firebaseAdmin
      .from("perkos_vendors")
      .update({ status: "active" } as never)
      .eq("id", vendor.id);

    logger.info("Vendor registered successfully", {
      vendorId: vendor.id,
      name: vendor.name,
      url: vendor.url,
      network: vendor.network,
    });

    return {
      success: true,
      vendor: { ...vendor, status: "active" as const },
    };
  }

  /**
   * Register a vendor directly with provided definition (no discovery needed)
   */
  async registerVendorDirect(request: VendorDirectRegistrationRequest): Promise<VendorRegistrationResult> {
    console.log("[VendorDirectRegistration] Starting direct registration");

    const {
      url,
      name,
      description,
      category,
      tags,
      iconUrl,
      websiteUrl,
      docsUrl,
      walletAddress,
      network,
      priceUsd,
      facilitatorUrl,
      endpoints,
    } = request;

    console.log("[VendorDirectRegistration] Request:", {
      url,
      name,
      walletAddress,
      network,
      endpointCount: endpoints?.length,
    });

    // Validate required fields
    if (!walletAddress) {
      console.error("[VendorDirectRegistration] Missing walletAddress");
      return { success: false, error: "Wallet address is required for direct registration" };
    }
    if (!network) {
      console.error("[VendorDirectRegistration] Missing network");
      return { success: false, error: "Network is required for direct registration" };
    }
    if (!endpoints || endpoints.length === 0) {
      console.error("[VendorDirectRegistration] Missing endpoints");
      return { success: false, error: "At least one endpoint is required for direct registration" };
    }

    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);
    const discoveryUrl = this.buildDiscoveryUrl(normalizedUrl);
    console.log("[VendorDirectRegistration] Normalized URL:", normalizedUrl);

    // Check if vendor already exists
    console.log("[VendorDirectRegistration] Checking for existing vendor...");
    const { data: existingVendor } = await firebaseAdmin
      .from("perkos_vendors")
      .select("id, total_transactions, successful_transactions, total_volume, average_response_time_ms")
      .eq("url", normalizedUrl)
      .single();

    let vendor: Vendor | null = null;
    let isUpdate = false;

    if (existingVendor) {
      // Re-registration: Update existing vendor
      isUpdate = true;
      console.log("[VendorDirectRegistration] Vendor exists, updating registration:", existingVendor.id);

      const vendorUpdate: VendorUpdate = {
        name: name || this.extractNameFromUrl(normalizedUrl),
        description: description || null,
        wallet_address: walletAddress,
        network: network,
        chain_id: this.getChainIdFromNetwork(network),
        price_usd: priceUsd || endpoints[0]?.priceUsd || null,
        asset: "USDC",
        facilitator_url: facilitatorUrl || null,
        category: category || "api",
        tags: tags || [],
        status: "active",
        verification_status: "verified",
        last_verified_at: new Date().toISOString(),
        icon_url: iconUrl || null,
        website_url: websiteUrl || null,
        docs_url: docsUrl || null,
        discovery_metadata: { direct_registration: true, endpoints } as unknown as Json,
      };

      const { data: updatedData, error: updateError } = await firebaseAdmin
        .from("perkos_vendors")
        .update(vendorUpdate as never)
        .eq("id", existingVendor.id)
        .select()
        .single();

      if (updateError || !updatedData) {
        console.error("[VendorDirectRegistration] Failed to update vendor:", updateError);
        return { success: false, error: updateError?.message || "Failed to update vendor" };
      }

      vendor = updatedData as Vendor;

      // Delete old endpoints before inserting new ones
      console.log("[VendorDirectRegistration] Deleting old endpoints...");
      await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .delete()
        .eq("vendor_id", existingVendor.id);

    } else {
      // New registration: Insert new vendor
      console.log("[VendorDirectRegistration] Creating new vendor registration");

      const vendorInsert: VendorInsert = {
        name: name || this.extractNameFromUrl(normalizedUrl),
        description: description || null,
        url: normalizedUrl,
        discovery_url: discoveryUrl,
        wallet_address: walletAddress,
        network: network,
        chain_id: this.getChainIdFromNetwork(network),
        price_usd: priceUsd || endpoints[0]?.priceUsd || null,
        asset: "USDC",
        facilitator_url: facilitatorUrl || null,
        category: category || "api",
        tags: tags || [],
        status: "active",
        verification_status: "verified",
        last_verified_at: new Date().toISOString(),
        icon_url: iconUrl || null,
        website_url: websiteUrl || null,
        docs_url: docsUrl || null,
        discovery_metadata: { direct_registration: true, endpoints } as unknown as Json,
        // Initialize stats fields (Firestore doesn't have schema defaults)
        total_transactions: 0,
        successful_transactions: 0,
        total_volume: "0",
        average_response_time_ms: 0,
      };

      const { data: vendorData, error: vendorError } = await firebaseAdmin
        .from("perkos_vendors")
        .insert(vendorInsert as never)
        .select()
        .single();

      if (vendorError || !vendorData) {
        console.error("[VendorDirectRegistration] Failed to insert vendor:", vendorError);
        logger.error("Failed to insert vendor (direct)", { error: vendorError });
        return {
          success: false,
          error: vendorError?.message || "Failed to create vendor record",
        };
      }

      vendor = vendorData as Vendor;
    }

    console.log(`[VendorDirectRegistration] Vendor ${isUpdate ? 'updated' : 'inserted'} successfully with ID:`, vendor.id);

    // Insert endpoints
    const endpointsToInsert: VendorEndpointInsert[] = endpoints.map((ep) => ({
      vendor_id: vendor!.id,
      path: ep.path,
      method: ep.method || "GET",
      description: ep.description || null,
      price_usd: ep.priceUsd,
      request_schema: (ep.inputSchema as Json) || null,
      response_schema: (ep.outputSchema as Json) || null,
      is_active: true,
    }));

    if (endpointsToInsert.length > 0) {
      console.log("[VendorDirectRegistration] Inserting", endpointsToInsert.length, "endpoints...");
      const { error: endpointError } = await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .insert(endpointsToInsert as never);

      if (endpointError) {
        console.error("[VendorDirectRegistration] Failed to insert endpoints:", endpointError);
        logger.warn("Failed to insert vendor endpoints (direct)", { error: endpointError });
      } else {
        console.log("[VendorDirectRegistration] Endpoints inserted successfully");
      }
    }

    // Record verification (direct registration)
    console.log("[VendorDirectRegistration] Recording verification...");
    const verificationInsert: VendorVerificationInsert = {
      vendor_id: vendor.id,
      success: true,
      response_time_ms: 0,
      discovery_data: { direct_registration: true } as Json,
    };
    await firebaseAdmin.from("perkos_vendor_verifications").insert(verificationInsert as never);

    console.log("[VendorDirectRegistration] Registration complete for vendor:", vendor.id);
    logger.info("Vendor registered directly", {
      vendorId: vendor.id,
      name: vendor.name,
      url: vendor.url,
      network: vendor.network,
      endpointCount: endpoints.length,
    });

    return {
      success: true,
      vendor,
    };
  }

  /**
   * Re-verify an existing vendor's discovery endpoint
   */
  async verifyVendor(vendorId: string): Promise<{ success: boolean; error?: string }> {
    const { data: vendorData, error: fetchError } = await firebaseAdmin
      .from("perkos_vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    const vendor = vendorData as Vendor | null;

    if (fetchError || !vendor) {
      return { success: false, error: "Vendor not found" };
    }

    const discovery = await this.discoverVendor(vendor.url);

    // Record verification attempt
    const verificationInsert: VendorVerificationInsert = {
      vendor_id: vendorId,
      success: discovery.success,
      response_time_ms: discovery.responseTimeMs,
      error_message: discovery.error || null,
      discovery_data: (discovery.data as Json) || null,
    };
    await firebaseAdmin.from("perkos_vendor_verifications").insert(verificationInsert as never);

    // Update vendor status
    const updateData: VendorUpdate = {
      last_verified_at: new Date().toISOString(),
      verification_status: discovery.success ? "verified" : "failed",
      last_error: discovery.error || null,
    };

    if (discovery.success && discovery.data) {
      updateData.discovery_metadata = discovery.data as Json;
      updateData.status = "active";

      // Update wallet if changed - check both standard and extended formats
      const primaryAccept = discovery.data.accepts?.[0];
      const payToAddress = primaryAccept?.payTo || discovery.data.payment?.payTo;
      if (payToAddress && payToAddress !== vendor.wallet_address) {
        updateData.wallet_address = payToAddress;
      }
    } else {
      // Mark as inactive after failed verification
      updateData.status = "inactive";
    }

    await firebaseAdmin.from("perkos_vendors").update(updateData as never).eq("id", vendorId);

    return {
      success: discovery.success,
      error: discovery.error,
    };
  }

  /**
   * Get all active vendors
   */
  async getActiveVendors(options?: {
    network?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ vendors: Vendor[]; total: number }> {
    let query = firebaseAdmin
      .from("perkos_vendors")
      .select("*", { count: "exact" })
      .eq("status", "active");

    if (options?.network) {
      query = query.eq("network", options.network);
    }
    if (options?.category) {
      query = query.eq("category", options.category);
    }

    query = query.order("total_transactions", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      logger.error("Failed to fetch vendors", { error });
      return { vendors: [], total: 0 };
    }

    return {
      vendors: (data as Vendor[]) || [],
      total: count || 0,
    };
  }

  /**
   * Get vendor by ID with endpoints
   */
  async getVendorWithEndpoints(vendorId: string): Promise<{
    vendor: Vendor | null;
    endpoints: VendorEndpoint[];
  }> {
    const { data: vendorData } = await firebaseAdmin
      .from("perkos_vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    const { data: endpointsData } = await firebaseAdmin
      .from("perkos_vendor_endpoints")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("is_active", true);

    return {
      vendor: vendorData ? (vendorData as Vendor) : null,
      endpoints: endpointsData ? (endpointsData as VendorEndpoint[]) : [],
    };
  }

  /**
   * Update vendor details
   */
  async updateVendor(
    vendorId: string,
    updates: Partial<Pick<Vendor, "name" | "description" | "category" | "tags" | "icon_url" | "website_url" | "docs_url">>
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await firebaseAdmin
      .from("perkos_vendors")
      .update(updates as never)
      .eq("id", vendorId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Suspend or reactivate vendor
   */
  async setVendorStatus(
    vendorId: string,
    status: "active" | "suspended"
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await firebaseAdmin
      .from("perkos_vendors")
      .update({ status } as never)
      .eq("id", vendorId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Delete vendor and related data
   */
  async deleteVendor(vendorId: string): Promise<{ success: boolean; error?: string; deletedEndpoints?: number }> {
    console.log(`[VendorDelete] Starting cascade delete for vendor: ${vendorId}`);

    // Count endpoints before delete
    const { data: endpointsBefore } = await firebaseAdmin
      .from("perkos_vendor_endpoints")
      .select("id")
      .eq("vendor_id", vendorId);
    const endpointCount = endpointsBefore?.length || 0;
    console.log(`[VendorDelete] Found ${endpointCount} endpoints to delete`);

    // Delete endpoints first (Firestore doesn't have cascade delete)
    const { error: endpointError } = await firebaseAdmin
      .from("perkos_vendor_endpoints")
      .delete()
      .eq("vendor_id", vendorId);
    if (endpointError) {
      console.error(`[VendorDelete] Error deleting endpoints:`, endpointError);
    } else {
      console.log(`[VendorDelete] Deleted ${endpointCount} endpoints`);
    }

    // Delete verifications
    const { error: verificationError } = await firebaseAdmin
      .from("perkos_vendor_verifications")
      .delete()
      .eq("vendor_id", vendorId);
    if (verificationError) {
      console.error(`[VendorDelete] Error deleting verifications:`, verificationError);
    }

    // Delete vendor
    const { error } = await firebaseAdmin.from("perkos_vendors").delete().eq("id", vendorId);

    if (error) {
      console.error(`[VendorDelete] Error deleting vendor:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[VendorDelete] Successfully deleted vendor ${vendorId} and ${endpointCount} endpoints`);
    return { success: true, deletedEndpoints: endpointCount };
  }

  /**
   * Clean up orphaned endpoints (endpoints without a valid vendor)
   */
  async cleanupOrphanedEndpoints(): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    console.log(`[OrphanCleanup] Starting orphaned endpoints cleanup...`);

    // Get all vendor IDs
    const { data: vendors, error: vendorError } = await firebaseAdmin
      .from("perkos_vendors")
      .select("id");

    if (vendorError) {
      console.error(`[OrphanCleanup] Error fetching vendors:`, vendorError);
      return { success: false, deletedCount: 0, error: vendorError.message };
    }

    const validVendorIds = new Set((vendors || []).map((v) => v.id));
    console.log(`[OrphanCleanup] Found ${validVendorIds.size} valid vendors`);

    // Get all endpoints
    const { data: endpoints, error: endpointError } = await firebaseAdmin
      .from("perkos_vendor_endpoints")
      .select("id, vendor_id");

    if (endpointError) {
      console.error(`[OrphanCleanup] Error fetching endpoints:`, endpointError);
      return { success: false, deletedCount: 0, error: endpointError.message };
    }

    // Find orphaned endpoints
    const orphanedEndpoints = (endpoints || []).filter(
      (ep) => !validVendorIds.has(ep.vendor_id)
    );
    console.log(`[OrphanCleanup] Found ${orphanedEndpoints.length} orphaned endpoints out of ${endpoints?.length || 0} total`);

    if (orphanedEndpoints.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Delete orphaned endpoints
    let deletedCount = 0;
    for (const endpoint of orphanedEndpoints) {
      const { error: deleteError } = await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .delete()
        .eq("id", endpoint.id);

      if (!deleteError) {
        deletedCount++;
      } else {
        console.error(`[OrphanCleanup] Error deleting endpoint ${endpoint.id}:`, deleteError);
      }
    }

    console.log(`[OrphanCleanup] Successfully deleted ${deletedCount} orphaned endpoints`);
    return { success: true, deletedCount };
  }

  // Helper methods

  private buildDiscoveryUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.pathname = this.DISCOVERY_PATH;
    return url.toString();
  }

  private normalizeUrl(url: string): string {
    // Ensure https and remove trailing slash
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }
    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, "");
    return normalized;
  }

  private extractNameFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      // Remove common prefixes and suffixes
      return hostname
        .replace(/^(www\.|api\.|app\.)/, "")
        .replace(/\.(com|io|xyz|org|net)$/, "")
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    } catch {
      return "Unknown Vendor";
    }
  }

  private getChainIdFromNetwork(network: string): number | null {
    const chainIds: Record<string, number> = {
      avalanche: 43114,
      "avalanche-fuji": 43113,
      base: 8453,
      "base-sepolia": 84532,
      celo: 42220,
      "celo-sepolia": 11142220,
    };
    return chainIds[network] || null;
  }
}

// Export singleton instance
export const vendorDiscoveryService = new VendorDiscoveryService();
