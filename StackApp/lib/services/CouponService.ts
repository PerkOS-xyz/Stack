/**
 * CouponService - Manages coupons, redemptions, and invoice history
 *
 * Features:
 * - Create, update, and manage coupons (admin)
 * - Validate coupons for users
 * - Track coupon redemptions
 * - Generate and retrieve invoices
 *
 * Firebase Collections:
 * - perkos_coupons: Coupon definitions
 * - perkos_coupon_redemptions: Usage tracking
 * - perkos_invoices: Payment history
 */

import { firebaseAdmin, AdminTimestamp } from "../db/firebase";

// ============================================
// Types
// ============================================

export type DiscountType = "percentage" | "fixed";
export type BillingCycle = "monthly" | "yearly";
export type PaymentStatus = "pending" | "completed" | "failed";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;

  // Discount configuration
  discount_type: DiscountType;
  discount_value: number; // 0-100 for percentage, dollar amount for fixed

  // Assignment: null = open coupon (anyone), address = user-specific
  assigned_wallet: string | null;

  // Usage limits: -1 = unlimited, positive number = max uses
  max_redemptions: number;
  current_redemptions: number;

  // Tier restrictions: null = all tiers, array = specific tiers only
  applicable_tiers: string[] | null;

  // Minimum purchase amount for fixed discounts
  min_amount: number;

  // Validity period
  starts_at: string;
  expires_at: string;

  // Status
  enabled: boolean;

  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  coupon_code: string;
  user_wallet: string;
  subscription_tier: string;
  billing_cycle: BillingCycle;

  // Amount tracking
  original_amount: number;
  discount_amount: number;
  final_amount: number;

  redeemed_at: string;
}

export interface Invoice {
  id: string;
  user_wallet: string;

  // Link to subscription record
  subscription_id: string | null;

  // Subscription details
  subscription_tier: string;
  billing_cycle: BillingCycle;

  // Amount breakdown
  original_amount: number;
  discount_amount: number;
  final_amount: number;

  // Coupon info (if used)
  coupon_code: string | null;
  coupon_id: string | null;

  // Payment details
  network: string;
  transaction_hash: string | null;
  payment_status: PaymentStatus;

  created_at: string;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon: Coupon | null;
  error: string | null;
  discount_amount: number;
  final_amount: number;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  assigned_wallet?: string | null;
  max_redemptions?: number;
  applicable_tiers?: string[] | null;
  min_amount?: number;
  starts_at: string;
  expires_at: string;
  enabled?: boolean;
  created_by: string;
}

export interface UpdateCouponInput {
  code?: string;
  description?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  assigned_wallet?: string | null;
  max_redemptions?: number;
  applicable_tiers?: string[] | null;
  min_amount?: number;
  starts_at?: string;
  expires_at?: string;
  enabled?: boolean;
}

export interface CreateInvoiceInput {
  user_wallet: string;
  subscription_id?: string | null;
  subscription_tier: string;
  billing_cycle: BillingCycle;
  original_amount: number;
  discount_amount?: number;
  final_amount: number;
  coupon_code?: string | null;
  coupon_id?: string | null;
  network: string;
  transaction_hash?: string | null;
  payment_status?: PaymentStatus;
}

// ============================================
// CouponService Class
// ============================================

export class CouponService {
  // ========================================
  // Coupon CRUD Operations
  // ========================================

  /**
   * Create a new coupon
   */
  async createCoupon(input: CreateCouponInput): Promise<Coupon> {
    const now = new Date().toISOString();

    // Validate discount value
    if (input.discount_type === "percentage" && (input.discount_value <= 0 || input.discount_value > 100)) {
      throw new Error("Percentage discount must be between 1 and 100");
    }
    if (input.discount_type === "fixed" && input.discount_value <= 0) {
      throw new Error("Fixed discount must be greater than 0");
    }

    // Validate dates
    if (new Date(input.expires_at) <= new Date(input.starts_at)) {
      throw new Error("Expiration date must be after start date");
    }

    const couponData = {
      code: input.code.toUpperCase().trim(),
      description: input.description || null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      assigned_wallet: input.assigned_wallet?.toLowerCase() || null,
      max_redemptions: input.max_redemptions ?? 1,
      current_redemptions: 0,
      applicable_tiers: input.applicable_tiers || null,
      min_amount: input.min_amount ?? 0,
      starts_at: input.starts_at,
      expires_at: input.expires_at,
      enabled: input.enabled ?? true,
      created_by: input.created_by.toLowerCase(),
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await firebaseAdmin
      .from("perkos_coupons")
      .insert(couponData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * Get a coupon by ID
   */
  async getCouponById(id: string): Promise<Coupon | null> {
    const { data, error } = await firebaseAdmin
      .from("perkos_coupons")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Coupon;
  }

  /**
   * Get a coupon by code (case-insensitive)
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const { data, error } = await firebaseAdmin
      .from("perkos_coupons")
      .select("*")
      .eq("code", code.toUpperCase().trim())
      .single();

    if (error || !data) {
      return null;
    }

    return data as Coupon;
  }

  /**
   * Get all coupons (with optional filters)
   */
  async getCoupons(options?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ coupons: Coupon[]; total: number }> {
    let query = firebaseAdmin.from("perkos_coupons").select("*");

    if (options?.enabled !== undefined) {
      query = query.eq("enabled", options.enabled);
    }

    query = query.order("created_at", { ascending: false });

    if (options?.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch coupons: ${error.message}`);
    }

    // Get total count
    const { count: totalCount } = await firebaseAdmin
      .from("perkos_coupons")
      .select("*", { count: "exact", head: true });

    return {
      coupons: (data || []) as Coupon[],
      total: totalCount || 0,
    };
  }

  /**
   * Update a coupon
   */
  async updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon> {
    // Validate discount value if provided
    if (input.discount_type === "percentage" && input.discount_value !== undefined) {
      if (input.discount_value <= 0 || input.discount_value > 100) {
        throw new Error("Percentage discount must be between 1 and 100");
      }
    }
    if (input.discount_type === "fixed" && input.discount_value !== undefined) {
      if (input.discount_value <= 0) {
        throw new Error("Fixed discount must be greater than 0");
      }
    }

    // Validate dates if both provided
    if (input.starts_at && input.expires_at) {
      if (new Date(input.expires_at) <= new Date(input.starts_at)) {
        throw new Error("Expiration date must be after start date");
      }
    }

    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    // Normalize code if provided
    if (input.code) {
      updateData.code = input.code.toUpperCase().trim();
    }

    // Normalize wallet if provided
    if (input.assigned_wallet !== undefined) {
      updateData.assigned_wallet = input.assigned_wallet?.toLowerCase() || null;
    }

    const { data, error } = await firebaseAdmin
      .from("perkos_coupons")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update coupon: ${error.message}`);
    }

    return data as Coupon;
  }

  /**
   * Delete a coupon
   */
  async deleteCoupon(id: string): Promise<void> {
    const { error } = await firebaseAdmin
      .from("perkos_coupons")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete coupon: ${error.message}`);
    }
  }

  // ========================================
  // Coupon Validation
  // ========================================

  /**
   * Validate a coupon for a specific user and purchase
   */
  async validateCoupon(
    code: string,
    userWallet: string,
    tier: string,
    originalAmount: number
  ): Promise<CouponValidationResult> {
    const coupon = await this.getCouponByCode(code);

    // Check if coupon exists
    if (!coupon) {
      return {
        valid: false,
        coupon: null,
        error: "Invalid coupon code",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    // Check if coupon is enabled
    if (!coupon.enabled) {
      return {
        valid: false,
        coupon: null,
        error: "This coupon is no longer active",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    const now = new Date();

    // Check start date
    if (new Date(coupon.starts_at) > now) {
      return {
        valid: false,
        coupon: null,
        error: "This coupon is not yet active",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    // Check expiration
    if (new Date(coupon.expires_at) < now) {
      return {
        valid: false,
        coupon: null,
        error: "This coupon has expired",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    // Check redemption limit
    if (coupon.max_redemptions !== -1 && coupon.current_redemptions >= coupon.max_redemptions) {
      return {
        valid: false,
        coupon: null,
        error: "This coupon has reached its usage limit",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    // Check user assignment
    if (coupon.assigned_wallet && coupon.assigned_wallet.toLowerCase() !== userWallet.toLowerCase()) {
      return {
        valid: false,
        coupon: null,
        error: "This coupon is assigned to a different user",
        discount_amount: 0,
        final_amount: originalAmount,
      };
    }

    // Check tier restriction
    if (coupon.applicable_tiers && coupon.applicable_tiers.length > 0) {
      if (!coupon.applicable_tiers.includes(tier.toLowerCase())) {
        return {
          valid: false,
          coupon: null,
          error: "This coupon is not valid for the selected plan",
          discount_amount: 0,
          final_amount: originalAmount,
        };
      }
    }

    // Check minimum amount for fixed discounts
    if (coupon.discount_type === "fixed" && coupon.min_amount > 0) {
      if (originalAmount < coupon.min_amount) {
        return {
          valid: false,
          coupon: null,
          error: `Minimum purchase of $${coupon.min_amount.toFixed(2)} required for this coupon`,
          discount_amount: 0,
          final_amount: originalAmount,
        };
      }
    }

    // Calculate discount
    const discountAmount = this.calculateDiscount(coupon, originalAmount);
    const finalAmount = Math.max(0, originalAmount - discountAmount);

    return {
      valid: true,
      coupon,
      error: null,
      discount_amount: discountAmount,
      final_amount: finalAmount,
    };
  }

  /**
   * Calculate discount amount based on coupon type
   */
  calculateDiscount(coupon: Coupon, originalAmount: number): number {
    if (coupon.discount_type === "percentage") {
      return Math.round((originalAmount * coupon.discount_value / 100) * 100) / 100;
    } else {
      // Fixed discount - cannot exceed original amount
      return Math.min(coupon.discount_value, originalAmount);
    }
  }

  // ========================================
  // Coupon Redemption
  // ========================================

  /**
   * Record a coupon redemption
   */
  async redeemCoupon(
    couponId: string,
    userWallet: string,
    tier: string,
    billingCycle: BillingCycle,
    originalAmount: number,
    discountAmount: number,
    finalAmount: number
  ): Promise<CouponRedemption> {
    const coupon = await this.getCouponById(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    const now = new Date().toISOString();

    const redemptionData = {
      coupon_id: couponId,
      coupon_code: coupon.code,
      user_wallet: userWallet.toLowerCase(),
      subscription_tier: tier,
      billing_cycle: billingCycle,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      redeemed_at: now,
    };

    // Insert redemption record
    const { data, error } = await firebaseAdmin
      .from("perkos_coupon_redemptions")
      .insert(redemptionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record redemption: ${error.message}`);
    }

    // Increment coupon redemption count
    await firebaseAdmin
      .from("perkos_coupons")
      .update({
        current_redemptions: coupon.current_redemptions + 1,
        updated_at: now,
      })
      .eq("id", couponId);

    return data as CouponRedemption;
  }

  /**
   * Get redemptions for a coupon
   */
  async getCouponRedemptions(couponId: string): Promise<CouponRedemption[]> {
    const { data, error } = await firebaseAdmin
      .from("perkos_coupon_redemptions")
      .select("*")
      .eq("coupon_id", couponId)
      .order("redeemed_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch redemptions: ${error.message}`);
    }

    return (data || []) as CouponRedemption[];
  }

  // ========================================
  // Invoice Management
  // ========================================

  /**
   * Create an invoice record
   */
  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const now = new Date().toISOString();

    const invoiceData = {
      user_wallet: input.user_wallet.toLowerCase(),
      subscription_id: input.subscription_id || null,
      subscription_tier: input.subscription_tier,
      billing_cycle: input.billing_cycle,
      original_amount: input.original_amount,
      discount_amount: input.discount_amount ?? 0,
      final_amount: input.final_amount,
      coupon_code: input.coupon_code || null,
      coupon_id: input.coupon_id || null,
      network: input.network,
      transaction_hash: input.transaction_hash || null,
      payment_status: input.payment_status || "pending",
      created_at: now,
    };

    const { data, error } = await firebaseAdmin
      .from("perkos_invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }

    return data as Invoice;
  }

  /**
   * Update invoice status (e.g., when payment completes)
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: PaymentStatus,
    transactionHash?: string
  ): Promise<Invoice> {
    const updateData: Record<string, unknown> = {
      payment_status: status,
    };

    if (transactionHash) {
      updateData.transaction_hash = transactionHash;
    }

    const { data, error } = await firebaseAdmin
      .from("perkos_invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }

    return data as Invoice;
  }

  /**
   * Get invoices for a user
   */
  async getUserInvoices(
    userWallet: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: PaymentStatus;
    }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    let query = firebaseAdmin
      .from("perkos_invoices")
      .select("*")
      .eq("user_wallet", userWallet.toLowerCase());

    if (options?.status) {
      query = query.eq("payment_status", options.status);
    }

    query = query.order("created_at", { ascending: false });

    if (options?.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    // Get total count
    let countQuery = firebaseAdmin
      .from("perkos_invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_wallet", userWallet.toLowerCase());

    if (options?.status) {
      countQuery = countQuery.eq("payment_status", options.status);
    }

    const { count: totalCount } = await countQuery;

    return {
      invoices: (data || []) as Invoice[],
      total: totalCount || 0,
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string): Promise<Invoice | null> {
    const { data, error } = await firebaseAdmin
      .from("perkos_invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Invoice;
  }

  // ========================================
  // Admin Helpers
  // ========================================

  /**
   * Get coupon statistics
   */
  async getCouponStats(couponId: string): Promise<{
    totalRedemptions: number;
    totalDiscountGiven: number;
    uniqueUsers: number;
  }> {
    const redemptions = await this.getCouponRedemptions(couponId);

    const uniqueWallets = new Set(redemptions.map((r) => r.user_wallet.toLowerCase()));
    const totalDiscount = redemptions.reduce((sum, r) => sum + r.discount_amount, 0);

    return {
      totalRedemptions: redemptions.length,
      totalDiscountGiven: totalDiscount,
      uniqueUsers: uniqueWallets.size,
    };
  }

  /**
   * Get all coupons available for a user (open + assigned)
   */
  async getAvailableCouponsForUser(
    userWallet: string,
    tier: string,
    amount: number
  ): Promise<Coupon[]> {
    const now = new Date();
    const { data, error } = await firebaseAdmin
      .from("perkos_coupons")
      .select("*")
      .eq("enabled", true)
      .lte("starts_at", now.toISOString())
      .gte("expires_at", now.toISOString());

    if (error || !data) {
      return [];
    }

    // Filter coupons that are available to this user
    const coupons = (data as Coupon[]).filter((coupon) => {
      // Check if open or assigned to this user
      if (coupon.assigned_wallet && coupon.assigned_wallet.toLowerCase() !== userWallet.toLowerCase()) {
        return false;
      }

      // Check redemption limit
      if (coupon.max_redemptions !== -1 && coupon.current_redemptions >= coupon.max_redemptions) {
        return false;
      }

      // Check tier restriction
      if (coupon.applicable_tiers && coupon.applicable_tiers.length > 0) {
        if (!coupon.applicable_tiers.includes(tier.toLowerCase())) {
          return false;
        }
      }

      // Check minimum amount
      if (coupon.discount_type === "fixed" && coupon.min_amount > 0 && amount < coupon.min_amount) {
        return false;
      }

      return true;
    });

    return coupons;
  }
}

// ============================================
// Singleton Instance
// ============================================

let couponService: CouponService | null = null;

/**
 * Get the coupon service singleton
 */
export function getCouponService(): CouponService {
  if (!couponService) {
    couponService = new CouponService();
  }
  return couponService;
}
