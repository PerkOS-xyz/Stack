/**
 * API Route: /api/profile
 * Manage user profile information
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

// Valid account types
const VALID_ACCOUNT_TYPES = ["personal", "community", "organization", "vendor"] as const;
type AccountType = (typeof VALID_ACCOUNT_TYPES)[number];

interface UserProfile {
  id: string;
  wallet_address: string;
  account_type: AccountType;
  display_name: string | null;
  description: string | null;
  website: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  github_handle: string | null;
  discord_handle: string | null;
  farcaster_handle: string | null;
  telegram_handle: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  twitch_handle: string | null;
  kick_handle: string | null;
  company_name: string | null;
  company_registration_number: string | null;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/profile?address=0x...
 * Returns the profile for a wallet address
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabaseAdmin
      .from("perkos_user_profiles")
      .select("*")
      .eq("wallet_address", address.toLowerCase())
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error fetching profile:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    // Return null if no profile exists (user hasn't created one yet)
    return NextResponse.json({
      profile: profile || null,
      exists: !!profile,
    });
  } catch (error) {
    console.error("Error in GET /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * Creates or updates a user profile
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      accountType = "personal",
      displayName,
      description,
      website,
      avatarUrl,
      twitterHandle,
      githubHandle,
      discordHandle,
      farcasterHandle,
      telegramHandle,
      instagramHandle,
      tiktokHandle,
      twitchHandle,
      kickHandle,
      companyName,
      companyRegistrationNumber,
      isPublic = true,
    } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    // Validate account type
    if (!VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json(
        {
          error: `Invalid accountType. Must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate website URL if provided
    if (website && !isValidUrl(website)) {
      return NextResponse.json(
        { error: "Invalid website URL" },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const { data: existing } = await supabaseAdmin
      .from("perkos_user_profiles")
      .select("id")
      .eq("wallet_address", walletAddress.toLowerCase())
      .single();

    const profileData = {
      wallet_address: walletAddress.toLowerCase(),
      account_type: accountType,
      display_name: displayName?.trim() || null,
      description: description?.trim() || null,
      website: website?.trim() || null,
      avatar_url: avatarUrl?.trim() || null,
      twitter_handle: sanitizeHandle(twitterHandle),
      github_handle: sanitizeHandle(githubHandle),
      discord_handle: discordHandle?.trim() || null,
      farcaster_handle: sanitizeHandle(farcasterHandle),
      telegram_handle: sanitizeHandle(telegramHandle),
      instagram_handle: sanitizeHandle(instagramHandle),
      tiktok_handle: sanitizeHandle(tiktokHandle),
      twitch_handle: twitchHandle?.trim() || null,
      kick_handle: kickHandle?.trim() || null,
      company_name: accountType === "vendor" ? companyName?.trim() || null : null,
      company_registration_number:
        accountType === "vendor" ? companyRegistrationNumber?.trim() || null : null,
      is_public: isPublic,
    };

    let result;

    if (existing) {
      // Update existing profile
      const { data, error } = await supabaseAdmin
        .from("perkos_user_profiles")
        .update(profileData)
        .eq("wallet_address", walletAddress.toLowerCase())
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabaseAdmin
        .from("perkos_user_profiles")
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error("Error creating profile:", error);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({
      profile: result,
      message: existing ? "Profile updated successfully" : "Profile created successfully",
      created: !existing,
    });
  } catch (error) {
    console.error("Error in POST /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile?address=0x...
 * Deletes a user profile
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("perkos_user_profiles")
      .delete()
      .eq("wallet_address", address.toLowerCase());

    if (error) {
      console.error("Error deleting profile:", error);
      return NextResponse.json(
        { error: "Failed to delete profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

function sanitizeHandle(handle: string | undefined | null): string | null {
  if (!handle) return null;
  // Remove @ prefix if present
  return handle.trim().replace(/^@/, "") || null;
}
