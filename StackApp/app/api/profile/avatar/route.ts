/**
 * API Route: /api/profile/avatar
 * Handle avatar/logo upload for user profiles
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

// Avatar storage bucket name (from environment variable)
const AVATAR_BUCKET = process.env.NEXT_PUBLIC_AVATAR_BUCKET || "avatars";

// Maximum file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/**
 * POST /api/profile/avatar
 * Upload an avatar image
 *
 * Request: FormData with:
 * - file: The image file
 * - walletAddress: User's wallet address
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const walletAddress = formData.get("walletAddress") as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const extension = file.name.split(".").pop() || "png";
    const filename = `${walletAddress.toLowerCase()}-${Date.now()}.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error("Error uploading avatar:", uploadError);

      // Check if bucket doesn't exist
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          {
            error: `Storage bucket '${AVATAR_BUCKET}' not found. Please create it in Supabase Dashboard > Storage`,
            details: `Run: INSERT INTO storage.buckets (id, name, public) VALUES ('${AVATAR_BUCKET}', '${AVATAR_BUCKET}', true);`
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filename);

    const avatarUrl = urlData.publicUrl;

    // Update user profile with new avatar URL
    const { error: updateError } = await supabaseAdmin
      .from("perkos_user_profiles")
      .update({ avatar_url: avatarUrl })
      .eq("wallet_address", walletAddress.toLowerCase());

    // Note: If profile doesn't exist yet, the update won't error but won't update anything
    // The avatar URL is still returned so it can be saved when creating the profile

    if (updateError) {
      console.warn("Could not update profile with avatar URL:", updateError);
      // Don't fail - user can still use the uploaded URL
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
      filename,
      message: "Avatar uploaded successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/profile/avatar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar?address=0x...
 * Delete an avatar image
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

    // Get current avatar URL
    const { data: profile } = await supabaseAdmin
      .from("perkos_user_profiles")
      .select("avatar_url")
      .eq("wallet_address", address.toLowerCase())
      .single();

    if (profile?.avatar_url) {
      // Extract filename from URL
      const urlParts = profile.avatar_url.split("/");
      const filename = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error: deleteError } = await supabaseAdmin.storage
        .from(AVATAR_BUCKET)
        .remove([filename]);

      if (deleteError) {
        console.warn("Could not delete avatar from storage:", deleteError);
      }
    }

    // Clear avatar URL in profile
    const { error: updateError } = await supabaseAdmin
      .from("perkos_user_profiles")
      .update({ avatar_url: null })
      .eq("wallet_address", address.toLowerCase());

    if (updateError) {
      console.error("Error clearing avatar URL:", updateError);
      return NextResponse.json(
        { error: "Failed to clear avatar" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/profile/avatar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
