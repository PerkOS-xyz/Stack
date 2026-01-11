import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";

export const dynamic = "force-dynamic";

// Admin wallets that can access this endpoint
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "").toLowerCase().split(",").filter(Boolean);

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

/**
 * GET /api/admin/subscriptions
 * List all subscriptions (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminAddress = searchParams.get("admin");

    if (!isAdmin(adminAddress)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query without order to avoid Firestore index requirements
    const { data, error } = await firebaseAdmin
      .from("perkos_subscriptions")
      .select("*");

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    // Sort client-side by created_at descending
    const sortedData = [...(data || [])].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    console.log(`[Admin] Found ${sortedData.length} subscriptions`);
    if (sortedData.length > 0) {
      console.log(`[Admin] First subscription:`, JSON.stringify(sortedData[0], null, 2));
    }

    // Group by wallet address to identify duplicates
    const byWallet: Record<string, typeof sortedData> = {};
    for (const sub of sortedData) {
      const wallet = sub.user_wallet_address?.toLowerCase();
      if (!byWallet[wallet]) {
        byWallet[wallet] = [];
      }
      byWallet[wallet].push(sub);
    }

    // Count duplicates
    const duplicateWallets = Object.entries(byWallet)
      .filter(([_, subs]) => subs.length > 1)
      .map(([wallet, subs]) => ({
        wallet,
        count: subs.length,
        subscriptions: subs,
      }));

    return NextResponse.json({
      success: true,
      total: sortedData.length,
      uniqueWallets: Object.keys(byWallet).length,
      duplicateWallets: duplicateWallets.length,
      duplicates: duplicateWallets,
      subscriptions: sortedData,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/subscriptions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/subscriptions
 * Clean up duplicate subscriptions (keep only the most recent per wallet)
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { adminAddress, action } = body;

    if (!isAdmin(adminAddress)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "cleanup-duplicates") {
      // Get all subscriptions
      const { data, error } = await firebaseAdmin
        .from("perkos_subscriptions")
        .select("*");

      if (error) {
        return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
      }

      // Sort client-side by created_at descending
      const sortedData = [...(data || [])].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      // Group by wallet address
      const byWallet: Record<string, typeof sortedData> = {};
      for (const sub of sortedData) {
        const wallet = sub.user_wallet_address?.toLowerCase();
        if (!byWallet[wallet]) {
          byWallet[wallet] = [];
        }
        byWallet[wallet].push(sub);
      }

      // Find duplicates (keep first one which is most recent due to ordering)
      const toDelete: string[] = [];
      for (const [wallet, subs] of Object.entries(byWallet)) {
        if (subs.length > 1) {
          // Keep the first (most recent), delete the rest
          for (let i = 1; i < subs.length; i++) {
            toDelete.push(subs[i].id);
          }
        }
      }

      // Delete duplicates
      let deleted = 0;
      for (const id of toDelete) {
        const { error: deleteError } = await firebaseAdmin
          .from("perkos_subscriptions")
          .delete()
          .eq("id", id);

        if (!deleteError) {
          deleted++;
        } else {
          console.error(`Failed to delete subscription ${id}:`, deleteError);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${deleted} duplicate subscriptions`,
        duplicatesFound: toDelete.length,
        deleted,
      });
    }

    if (action === "delete-all") {
      // This is dangerous - only for testing
      const { data } = await firebaseAdmin
        .from("perkos_subscriptions")
        .select("id");

      let deleted = 0;
      for (const sub of data || []) {
        const { error: deleteError } = await firebaseAdmin
          .from("perkos_subscriptions")
          .delete()
          .eq("id", sub.id);

        if (!deleteError) {
          deleted++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Deleted ${deleted} subscriptions`,
        deleted,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in DELETE /api/admin/subscriptions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
