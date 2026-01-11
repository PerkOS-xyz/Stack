import { NextRequest, NextResponse } from "next/server";
import { vendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";

export const dynamic = "force-dynamic";

/**
 * Endpoint definition schema for direct registration
 */
interface EndpointDefinition {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description?: string;
  priceUsd: string;
  inputSchema?: object;
  outputSchema?: object;
}

/**
 * POST /api/vendors/register
 * Register a new vendor - supports two modes:
 * 1. Discovery mode: provide URL, Stack discovers /.well-known/x402
 * 2. Direct mode: provide full definition with endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Vendor Registration] Received body:", JSON.stringify(body, null, 2));

    // Validate required field
    if (!body.url || typeof body.url !== "string") {
      console.error("[Vendor Registration] Missing URL in request body");
      return NextResponse.json(
        {
          success: false,
          error: "URL is required",
        },
        { status: 400 }
      );
    }

    // Validate category if provided
    const validCategories = ["api", "nft", "defi", "gaming", "dao", "ai", "data", "other"];
    if (body.category && !validCategories.includes(body.category)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if this is a direct registration (with endpoints defined)
    if (body.endpoints && Array.isArray(body.endpoints)) {
      // Direct registration mode - vendor provides full definition
      console.log("[Vendor Registration] Direct mode - endpoints count:", body.endpoints.length);
      const result = await vendorDiscoveryService.registerVendorDirect({
        url: body.url,
        name: body.name,
        description: body.description,
        category: body.category,
        tags: body.tags,
        iconUrl: body.iconUrl,
        websiteUrl: body.websiteUrl,
        docsUrl: body.docsUrl,
        // Direct registration fields
        walletAddress: body.walletAddress,
        network: body.network,
        priceUsd: body.priceUsd,
        facilitatorUrl: body.facilitatorUrl,
        endpoints: body.endpoints as EndpointDefinition[],
      });

      if (!result.success) {
        console.error("[Vendor Registration] Direct mode failed:", result.error);
        return NextResponse.json(
          {
            success: false,
            error: result.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        vendor: result.vendor,
        mode: "direct",
      });
    }

    // Discovery mode - Stack discovers /.well-known/x402
    console.log("[Vendor Registration] Discovery mode for URL:", body.url);
    const result = await vendorDiscoveryService.registerVendor({
      url: body.url,
      name: body.name,
      description: body.description,
      category: body.category,
      tags: body.tags,
      iconUrl: body.iconUrl,
      websiteUrl: body.websiteUrl,
      docsUrl: body.docsUrl,
    });

    if (!result.success) {
      console.error("[Vendor Registration] Failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      vendor: result.vendor,
      mode: "discovery",
    });
  } catch (error) {
    console.error("Vendor registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Registration failed",
      },
      { status: 500 }
    );
  }
}
