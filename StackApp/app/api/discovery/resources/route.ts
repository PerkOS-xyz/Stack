import { NextRequest, NextResponse } from "next/server";
import { VendorDiscoveryService } from "@/lib/services/VendorDiscoveryService";
import { firebaseAdmin } from "@/lib/db/firebase";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";
import { getBaseHeaders, networkToCAIP2 } from "@/lib/utils/x402-headers";
import { getPaymentTokenSymbol } from "@/lib/utils/x402-payment";
import { config } from "@/lib/utils/config";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * x402 v2 Discovery API — `GET /discovery/resources`.
 *
 * Lists the paid resources this facilitator knows about so other facilitators
 * and agents can index them. Distinct from `/.well-known/x402-discovery.json`,
 * which is PerkOS metadata about the facilitator itself rather than a
 * spec-defined resource listing.
 *
 * Query parameters (per spec):
 *   limit  — page size, 1..100 (default 20)
 *   offset — zero-based offset (default 0)
 *   type   — optional resource type filter (currently only "http")
 *
 * Non-spec conveniences, ignored by compliant clients:
 *   network  — restrict to one network
 *   category — restrict to one vendor category
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const RESOURCE_TYPE = "http";

interface VendorEndpointRow {
  vendor_id: string;
  path: string | null;
  method: string | null;
  description: string | null;
  price_usd: string | null;
  is_active: boolean | null;
}

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(request.url);

  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  const type = searchParams.get("type");
  const network = searchParams.get("network") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  // The only resource type Stack exposes is plain HTTP. An explicit filter for
  // anything else is a valid request with an empty result, not an error.
  if (type && type !== RESOURCE_TYPE) {
    return NextResponse.json(
      { x402Version: 2, items: [], pagination: { limit, offset, total: 0 } },
      { headers: { ...corsHeaders, ...getBaseHeaders() } }
    );
  }

  try {
    const vendorService = new VendorDiscoveryService();
    const { vendors, total } = await vendorService.getActiveVendors({
      network,
      category,
      limit,
      offset,
    });

    // One batched read for the whole page rather than a query per vendor.
    const vendorIds = vendors.map((vendor) => vendor.id);
    const endpointsByVendor = new Map<string, VendorEndpointRow[]>();

    if (vendorIds.length > 0) {
      const { data: endpointRows } = await firebaseAdmin
        .from("perkos_vendor_endpoints")
        .select("*")
        .in("vendor_id", vendorIds)
        .eq("is_active", true);

      for (const row of (endpointRows as VendorEndpointRow[] | null) ?? []) {
        const list = endpointsByVendor.get(row.vendor_id) ?? [];
        list.push(row);
        endpointsByVendor.set(row.vendor_id, list);
      }
    }

    const items = vendors.map((vendor) => {
      const vendorNetwork = vendor.network ?? config.defaultNetwork;
      const endpoints = endpointsByVendor.get(vendor.id) ?? [];

      return {
        type: RESOURCE_TYPE,
        resource: vendor.url,
        name: vendor.name ?? undefined,
        description: vendor.description ?? undefined,
        category: vendor.category ?? undefined,
        lastUpdated: vendor.updated_at ?? vendor.created_at ?? undefined,
        // Payment methods this resource accepts, in v2 shape.
        accepts: [
          {
            scheme: "exact",
            network: networkToCAIP2(vendorNetwork) ?? vendorNetwork,
            asset: vendor.asset ?? undefined,
            assetSymbol:
              typeof vendor.chain_id === "number"
                ? getPaymentTokenSymbol(vendor.chain_id)
                : undefined,
            payTo: vendor.wallet_address ?? undefined,
          },
        ],
        endpoints: endpoints.map((endpoint) => ({
          path: endpoint.path ?? "/",
          method: endpoint.method ?? "GET",
          description: endpoint.description ?? undefined,
          priceUsd: endpoint.price_usd ?? undefined,
        })),
      };
    });

    return NextResponse.json(
      {
        x402Version: 2,
        items,
        pagination: {
          limit,
          offset,
          total,
        },
      },
      { headers: { ...corsHeaders, ...getBaseHeaders() } }
    );
  } catch (error) {
    logger.error("Discovery resources listing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list resources" },
      { status: 500, headers: { ...corsHeaders } }
    );
  }
}
