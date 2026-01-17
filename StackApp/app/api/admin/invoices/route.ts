import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { logApiPerformance } from "@/lib/utils/withApiPerformance";

export const dynamic = "force-dynamic";

// Helper to verify admin access
function isAdminWallet(address: string): boolean {
  const adminWallets = process.env.ADMIN_WALLETS || "";
  const adminList = adminWallets
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  return adminList.includes(address.toLowerCase());
}

/**
 * GET /api/admin/invoices?address=0x...&page=0&limit=20&status=completed
 * Returns all invoices (admin only)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    if (!isAdminWallet(address)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    const offset = page * limit;

    // Build query
    let query = firebaseAdmin
      .from("perkos_invoices")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filter by status if specified
    if (status && ["pending", "completed", "failed"].includes(status)) {
      query = query.eq("payment_status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const allInvoicesQuery = await firebaseAdmin
      .from("perkos_invoices")
      .select("final_amount, payment_status");

    const allInvoices = allInvoicesQuery.data || [];
    const totalRevenue = allInvoices
      .filter((inv) => inv.payment_status === "completed")
      .reduce((sum, inv) => sum + (inv.final_amount || 0), 0);

    const pendingRevenue = allInvoices
      .filter((inv) => inv.payment_status === "pending")
      .reduce((sum, inv) => sum + (inv.final_amount || 0), 0);

    logApiPerformance("/api/admin/invoices", "GET", startTime, 200);
    return NextResponse.json({
      invoices: invoices || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      stats: {
        totalInvoices: allInvoices.length,
        completedCount: allInvoices.filter((inv) => inv.payment_status === "completed").length,
        pendingCount: allInvoices.filter((inv) => inv.payment_status === "pending").length,
        failedCount: allInvoices.filter((inv) => inv.payment_status === "failed").length,
        totalRevenue,
        pendingRevenue,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/invoices:", error);
    logApiPerformance("/api/admin/invoices", "GET", startTime, 500);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/invoices
 * Update invoice status (admin only)
 * Body: { address: string, invoiceId: string, payment_status: string }
 */
export async function PATCH(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { address, invoiceId, payment_status, transaction_hash } = body;

    if (!address || !invoiceId || !payment_status) {
      return NextResponse.json(
        { error: "Address, invoiceId, and payment_status parameters required" },
        { status: 400 }
      );
    }

    if (!isAdminWallet(address)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required" },
        { status: 403 }
      );
    }

    if (!["pending", "completed", "failed"].includes(payment_status)) {
      return NextResponse.json(
        { error: "Invalid payment_status. Must be pending, completed, or failed" },
        { status: 400 }
      );
    }

    // Update invoice
    const updateData: Record<string, unknown> = {
      payment_status,
    };

    if (transaction_hash) {
      updateData.transaction_hash = transaction_hash;
    }

    const { data, error } = await firebaseAdmin
      .from("perkos_invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) {
      console.error("Error updating invoice:", error);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    console.log(`[Admin] Invoice status updated: ${invoiceId} -> ${payment_status}`);

    logApiPerformance("/api/admin/invoices", "PATCH", startTime, 200);
    return NextResponse.json({
      success: true,
      message: `Invoice status updated to ${payment_status}`,
      invoice: data,
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/invoices:", error);
    logApiPerformance("/api/admin/invoices", "PATCH", startTime, 500);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
