/**
 * API Route: /api/contributors
 * Fetch public user profiles for the Contributors directory
 */

import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountType = searchParams.get("type"); // personal, community, organization, vendor
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query for public profiles only
    let query = firebaseAdmin
      .from("perkos_user_profiles")
      .select("*", { count: "exact" })
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    // Filter by account type if specified
    if (accountType && ["personal", "community", "organization", "vendor"].includes(accountType)) {
      query = query.eq("account_type", accountType);
    }

    // Search by display name if provided
    if (search) {
      query = query.ilike("display_name", `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: profiles, error, count } = await query;

    if (error) {
      console.error("Error fetching contributors:", error);
      return NextResponse.json(
        { error: "Failed to fetch contributors" },
        { status: 500 }
      );
    }

    // Get all wallet addresses for the profiles to fetch their public sponsor wallets
    const walletAddresses = (profiles || []).map((p) => p.wallet_address.toLowerCase());

    // Fetch public sponsor wallets for all contributors in one query
    let sponsorWalletsMap: Record<string, string> = {};
    if (walletAddresses.length > 0) {
      const { data: sponsorWallets } = await firebaseAdmin
        .from("perkos_sponsor_wallets")
        .select("user_wallet_address, sponsor_address")
        .in("user_wallet_address", walletAddresses)
        .eq("is_public", true);

      // Create a map of user wallet -> sponsor wallet address
      if (sponsorWallets) {
        sponsorWallets.forEach((sw) => {
          // Only use the first public sponsor wallet for each user
          if (!sponsorWalletsMap[sw.user_wallet_address]) {
            sponsorWalletsMap[sw.user_wallet_address] = sw.sponsor_address;
          }
        });
      }
    }

    // Format profiles for display
    const formattedProfiles = (profiles || []).map((profile) => {
      const userWalletLower = profile.wallet_address.toLowerCase();
      // Use sponsor wallet address if available, otherwise fall back to user wallet
      const donationAddress = sponsorWalletsMap[userWalletLower] || profile.wallet_address;

      return {
        id: profile.id,
        walletAddress: donationAddress, // This is now the sponsor wallet (for donations)
        userWalletAddress: profile.wallet_address, // Keep the original user wallet for reference
        displayAddress: formatAddress(donationAddress),
        accountType: profile.account_type,
        displayName: profile.display_name,
        description: profile.description,
        website: profile.website,
        avatarUrl: profile.avatar_url,
        isVerified: profile.is_verified,
        hasSponsorWallet: !!sponsorWalletsMap[userWalletLower],
        // Social links
        socials: {
          twitter: profile.twitter_handle,
          github: profile.github_handle,
          discord: profile.discord_handle,
          farcaster: profile.farcaster_handle,
          telegram: profile.telegram_handle,
          instagram: profile.instagram_handle,
          tiktok: profile.tiktok_handle,
          twitch: profile.twitch_handle,
          kick: profile.kick_handle,
        },
        // Vendor info (if applicable)
        companyName: profile.company_name,
        createdAt: profile.created_at,
      };
    });

    // Calculate stats - these should always reflect the TOTAL counts, not filtered counts
    const stats = {
      total: 0,
      personal: 0,
      community: 0,
      organization: 0,
      vendor: 0,
    };

    // Get counts by type (always unfiltered to show true totals)
    const { data: typeCounts } = await firebaseAdmin
      .from("perkos_user_profiles")
      .select("account_type")
      .eq("is_public", true);

    if (typeCounts) {
      typeCounts.forEach((p) => {
        const type = p.account_type as keyof typeof stats;
        if (type in stats) {
          stats[type]++;
        }
      });
      // Total is the sum of all type counts
      stats.total = typeCounts.length;
    }

    return NextResponse.json({
      contributors: formattedProfiles,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      },
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/contributors:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
