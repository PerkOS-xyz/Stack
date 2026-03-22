import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { logApiPerformance } from "@/lib/utils/withApiPerformance";
import { verifyAdminRequest } from "@/lib/middleware/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns all user profiles (admin only)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");

    const offset = page * limit;

    // Fetch users with pagination
    const { data: users, error, count } = await firebaseAdmin
      .from("perkos_user_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    logApiPerformance("/api/admin/users", "GET", startTime, 200);
    return NextResponse.json({
      users: users || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    logApiPerformance("/api/admin/users", "GET", startTime, 500);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Delete a user and all associated data (admin only)
 * Body: { address: string, userId: string }
 */
export async function DELETE(req: NextRequest) {
  const startTime = Date.now();
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { userId, walletAddress } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    // First, get the user to find their wallet address
    const { data: user, error: userError } = await firebaseAdmin
      .from("perkos_user_profiles")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userWalletAddress = walletAddress || user.wallet_address;

    // Delete associated data in order:
    // 1. Delete sponsor wallets owned by this user
    const { error: walletsError } = await firebaseAdmin
      .from("perkos_sponsor_wallets")
      .delete()
      .eq("user_wallet_address", userWalletAddress);

    if (walletsError) {
      console.error("Error deleting user wallets:", walletsError);
    }

    // 2. Delete subscriptions for this user
    const { error: subscriptionsError } = await firebaseAdmin
      .from("perkos_subscriptions")
      .delete()
      .eq("wallet_address", userWalletAddress);

    if (subscriptionsError) {
      console.error("Error deleting user subscriptions:", subscriptionsError);
    }

    // 3. Delete vendors owned by this user
    const { error: vendorsError } = await firebaseAdmin
      .from("perkos_vendors")
      .delete()
      .eq("wallet_address", userWalletAddress);

    if (vendorsError) {
      console.error("Error deleting user vendors:", vendorsError);
    }

    // 4. Delete agent records for this user
    const { error: agentsError } = await firebaseAdmin
      .from("perkos_agents")
      .delete()
      .eq("wallet_address", userWalletAddress);

    if (agentsError) {
      console.error("Error deleting user agents:", agentsError);
    }

    // 5. Finally, delete the user profile
    const { error: deleteError } = await firebaseAdmin
      .from("perkos_user_profiles")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("Error deleting user profile:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete user profile" },
        { status: 500 }
      );
    }

    console.log(`[Admin] User deleted: ${userId} (${userWalletAddress})`);

    logApiPerformance("/api/admin/users", "DELETE", startTime, 200);
    return NextResponse.json({
      success: true,
      message: "User and associated data deleted successfully",
      deletedUserId: userId,
      deletedWalletAddress: userWalletAddress,
    });
  } catch (error) {
    console.error("Error in DELETE /api/admin/users:", error);
    logApiPerformance("/api/admin/users", "DELETE", startTime, 500);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Update user visibility (is_public) (admin only)
 * Body: { address: string, userId: string, is_public: boolean }
 */
export async function PATCH(req: NextRequest) {
  const startTime = Date.now();
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { userId, is_public } = body;

    if (!userId || typeof is_public !== "boolean") {
      return NextResponse.json(
        { error: "userId and is_public parameters required" },
        { status: 400 }
      );
    }

    // Update user visibility
    const { data, error } = await firebaseAdmin
      .from("perkos_user_profiles")
      .update({ is_public })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user visibility:", error);
      return NextResponse.json(
        { error: "Failed to update user visibility" },
        { status: 500 }
      );
    }

    console.log(`[Admin] User visibility updated: ${userId} -> is_public: ${is_public}`);

    logApiPerformance("/api/admin/users", "PATCH", startTime, 200);
    return NextResponse.json({
      success: true,
      message: `User visibility updated to ${is_public ? "public" : "private"}`,
      user: data,
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/users:", error);
    logApiPerformance("/api/admin/users", "PATCH", startTime, 500);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
