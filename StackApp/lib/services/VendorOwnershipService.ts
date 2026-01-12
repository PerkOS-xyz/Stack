/**
 * VendorOwnershipService
 *
 * Handles domain claiming, verification, and ownership management
 * for vendor services associated with user sponsor wallets.
 */

import { firebaseAdmin } from "@/lib/db/firebase";
import crypto from "crypto";
import type {
  UserVendorDomain,
  ClaimDomainRequest,
  ClaimDomainResponse,
  VerificationMethod,
  VerificationInstructions,
  VerifyDomainResponse,
} from "@/lib/types/vendor-analytics";

// Constants
const VERIFICATION_TOKEN_LENGTH = 32;
const VERIFICATION_EXPIRY_HOURS = 24;
const MAX_VERIFICATION_ATTEMPTS = 10;

export class VendorOwnershipService {
  /**
   * Claim a domain for a user's sponsor wallet
   */
  async claimDomain(
    userWalletAddress: string,
    request: ClaimDomainRequest
  ): Promise<ClaimDomainResponse> {
    const address = userWalletAddress.toLowerCase();
    const domainUrl = this.normalizeDomain(request.domain_url);

    // Check if domain is already claimed
    const { data: existing } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("domain_url", domainUrl)
      .single();

    if (existing) {
      if (existing.user_wallet_address === address) {
        // User already owns this domain, return existing
        return {
          success: true,
          domain: existing as UserVendorDomain,
          verification_instructions: this.generateVerificationInstructions(
            existing.verification_method || request.verification_method,
            existing.verification_token
          ),
        };
      } else {
        throw new Error("Domain is already claimed by another user");
      }
    }

    // Verify sponsor wallet belongs to user
    const { data: sponsorWallet } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .select("*")
      .eq("id", request.sponsor_wallet_id)
      .eq("user_wallet_address", address)
      .single();

    if (!sponsorWallet) {
      throw new Error("Sponsor wallet not found or does not belong to user");
    }

    // Check if there's a matching vendor in the registry
    const { data: vendor } = await firebaseAdmin
      .from("perkos_vendors")
      .select("id")
      .or(`url.ilike.%${domainUrl}%,discovery_url.ilike.%${domainUrl}%`)
      .limit(1)
      .single();

    // Generate verification token
    const verificationToken = this.generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

    // Create domain claim
    const { data: domain, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .insert({
        user_wallet_address: address,
        sponsor_wallet_id: request.sponsor_wallet_id,
        domain_url: domainUrl,
        vendor_id: vendor?.id || null,
        verification_status: "pending",
        verification_method: request.verification_method,
        verification_token: verificationToken,
        verification_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[VendorOwnership] Error claiming domain:", error);
      throw new Error("Failed to claim domain");
    }

    return {
      success: true,
      domain: domain as UserVendorDomain,
      verification_instructions: this.generateVerificationInstructions(
        request.verification_method,
        verificationToken
      ),
    };
  }

  /**
   * Verify domain ownership
   */
  async verifyDomain(
    userWalletAddress: string,
    domainId: string
  ): Promise<VerifyDomainResponse> {
    const address = userWalletAddress.toLowerCase();

    // Get domain claim
    const { data: domain, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("id", domainId)
      .eq("user_wallet_address", address)
      .single();

    if (error || !domain) {
      return {
        success: false,
        verified: false,
        message: "Domain claim not found",
      };
    }

    // Check if already verified
    if (domain.verification_status === "verified") {
      return {
        success: true,
        verified: true,
        message: "Domain is already verified",
        domain: domain as UserVendorDomain,
      };
    }

    // Check if expired
    if (
      domain.verification_expires_at &&
      new Date(domain.verification_expires_at) < new Date()
    ) {
      // Generate new token
      const newToken = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

      await firebaseAdmin
        .from("perkos_user_vendor_domains")
        .update({
          verification_token: newToken,
          verification_expires_at: expiresAt.toISOString(),
          verification_status: "pending",
        })
        .eq("id", domainId);

      return {
        success: false,
        verified: false,
        message:
          "Verification token expired. A new token has been generated. Please update your verification and try again.",
      };
    }

    // Check if max attempts exceeded
    if (domain.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return {
        success: false,
        verified: false,
        message:
          "Maximum verification attempts exceeded. Please contact support.",
      };
    }

    // Increment attempt count
    await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .update({
        verification_attempts: domain.verification_attempts + 1,
        last_verification_at: new Date().toISOString(),
      })
      .eq("id", domainId);

    // Perform verification based on method
    let verified = false;
    try {
      switch (domain.verification_method) {
        case "dns_txt":
          verified = await this.verifyDnsTxt(
            domain.domain_url,
            domain.verification_token
          );
          break;
        case "meta_tag":
          verified = await this.verifyMetaTag(
            domain.domain_url,
            domain.verification_token
          );
          break;
        case "file_upload":
          verified = await this.verifyFileUpload(
            domain.domain_url,
            domain.verification_token
          );
          break;
        default:
          return {
            success: false,
            verified: false,
            message: "Invalid verification method",
          };
      }
    } catch (err) {
      console.error("[VendorOwnership] Verification error:", err);
      return {
        success: false,
        verified: false,
        message: `Verification failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }

    if (verified) {
      // Update status to verified
      const { data: updatedDomain } = await firebaseAdmin
        .from("perkos_user_vendor_domains")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
        })
        .eq("id", domainId)
        .select()
        .single();

      return {
        success: true,
        verified: true,
        message: "Domain verified successfully",
        domain: updatedDomain as UserVendorDomain,
      };
    } else {
      // Update status to failed (can retry)
      await firebaseAdmin
        .from("perkos_user_vendor_domains")
        .update({
          verification_status: "failed",
        })
        .eq("id", domainId);

      return {
        success: false,
        verified: false,
        message:
          "Verification failed. Please ensure the verification token is correctly placed and try again.",
      };
    }
  }

  /**
   * Get all domains for a user
   */
  async getUserDomains(userWalletAddress: string): Promise<UserVendorDomain[]> {
    const address = userWalletAddress.toLowerCase();

    const { data, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("user_wallet_address", address)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[VendorOwnership] Error fetching domains:", error);
      return [];
    }

    return data as UserVendorDomain[];
  }

  /**
   * Get domains for a specific sponsor wallet
   */
  async getSponsorWalletDomains(
    sponsorWalletId: string
  ): Promise<UserVendorDomain[]> {
    const { data, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("sponsor_wallet_id", sponsorWalletId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "[VendorOwnership] Error fetching sponsor wallet domains:",
        error
      );
      return [];
    }

    return data as UserVendorDomain[];
  }

  /**
   * Get domain owner by domain URL
   */
  async getDomainOwner(domainUrl: string): Promise<UserVendorDomain | null> {
    const normalizedDomain = this.normalizeDomain(domainUrl);

    const { data, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .select("*")
      .eq("domain_url", normalizedDomain)
      .eq("verification_status", "verified")
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as UserVendorDomain;
  }

  /**
   * Remove domain claim
   */
  async removeDomain(
    userWalletAddress: string,
    domainId: string
  ): Promise<boolean> {
    const address = userWalletAddress.toLowerCase();

    const { error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .delete()
      .eq("id", domainId)
      .eq("user_wallet_address", address);

    if (error) {
      console.error("[VendorOwnership] Error removing domain:", error);
      return false;
    }

    return true;
  }

  /**
   * Update custom rate limits for a domain
   */
  async updateDomainRateLimits(
    userWalletAddress: string,
    domainId: string,
    limits: {
      requests_per_minute?: number | null;
      requests_per_hour?: number | null;
      requests_per_day?: number | null;
    }
  ): Promise<UserVendorDomain | null> {
    const address = userWalletAddress.toLowerCase();

    const { data, error } = await firebaseAdmin
      .from("perkos_user_vendor_domains")
      .update({
        custom_requests_per_minute: limits.requests_per_minute,
        custom_requests_per_hour: limits.requests_per_hour,
        custom_requests_per_day: limits.requests_per_day,
      })
      .eq("id", domainId)
      .eq("user_wallet_address", address)
      .select()
      .single();

    if (error) {
      console.error("[VendorOwnership] Error updating rate limits:", error);
      return null;
    }

    return data as UserVendorDomain;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private normalizeDomain(domain: string): string {
    // Remove protocol
    let normalized = domain.replace(/^https?:\/\//, "");
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, "");
    // Remove www prefix
    normalized = normalized.replace(/^www\./, "");
    // Lowercase
    return normalized.toLowerCase();
  }

  private generateVerificationToken(): string {
    return crypto.randomBytes(VERIFICATION_TOKEN_LENGTH).toString("hex");
  }

  private generateVerificationInstructions(
    method: VerificationMethod,
    token: string
  ): VerificationInstructions {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS);

    const instructions: VerificationInstructions = {
      method,
      token,
      expires_at: expiresAt.toISOString(),
    };

    switch (method) {
      case "dns_txt":
        instructions.dns_txt = {
          record_name: "_perkos-verify",
          record_value: token,
          example: `_perkos-verify.yourdomain.com TXT "${token}"`,
        };
        break;
      case "meta_tag":
        instructions.meta_tag = {
          tag_name: "perkos-verification",
          tag_content: token,
          example: `<meta name="perkos-verification" content="${token}">`,
        };
        break;
      case "file_upload":
        instructions.file_upload = {
          file_path: "/.well-known/perkos-verify.txt",
          file_content: token,
          example: `Create file at https://yourdomain.com/.well-known/perkos-verify.txt with content: ${token}`,
        };
        break;
    }

    return instructions;
  }

  /**
   * Verify DNS TXT record
   */
  private async verifyDnsTxt(
    domain: string,
    expectedToken: string
  ): Promise<boolean> {
    try {
      const dns = await import("dns").then((m) => m.promises);
      const records = await dns.resolveTxt(`_perkos-verify.${domain}`);

      // Records is array of arrays
      for (const record of records) {
        const value = record.join("");
        if (value === expectedToken) {
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error("[VendorOwnership] DNS verification error:", err);
      return false;
    }
  }

  /**
   * Verify meta tag on website
   */
  private async verifyMetaTag(
    domain: string,
    expectedToken: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`https://${domain}`, {
        headers: {
          "User-Agent": "PerkOS-Verification/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        return false;
      }

      const html = await response.text();

      // Look for meta tag with perkos-verification
      const metaRegex =
        /<meta\s+name=["']perkos-verification["']\s+content=["']([^"']+)["']/i;
      const match = html.match(metaRegex);

      if (match && match[1] === expectedToken) {
        return true;
      }

      // Also try alternate format
      const altRegex =
        /<meta\s+content=["']([^"']+)["']\s+name=["']perkos-verification["']/i;
      const altMatch = html.match(altRegex);

      return altMatch !== null && altMatch[1] === expectedToken;
    } catch (err) {
      console.error("[VendorOwnership] Meta tag verification error:", err);
      return false;
    }
  }

  /**
   * Verify file upload
   */
  private async verifyFileUpload(
    domain: string,
    expectedToken: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://${domain}/.well-known/perkos-verify.txt`,
        {
          headers: {
            "User-Agent": "PerkOS-Verification/1.0",
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );

      if (!response.ok) {
        return false;
      }

      const content = await response.text();
      return content.trim() === expectedToken;
    } catch (err) {
      console.error("[VendorOwnership] File verification error:", err);
      return false;
    }
  }
}

// Singleton instance
let vendorOwnershipService: VendorOwnershipService | null = null;

export function getVendorOwnershipService(): VendorOwnershipService {
  if (!vendorOwnershipService) {
    vendorOwnershipService = new VendorOwnershipService();
  }
  return vendorOwnershipService;
}
