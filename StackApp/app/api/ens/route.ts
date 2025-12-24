import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

export const dynamic = "force-dynamic";

// Create a client for ENS resolution (mainnet only)
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_MAINNET_RPC || "https://eth.llamarpc.com"),
});

/**
 * GET /api/ens?address=0x...
 * Returns cached ENS name or resolves and caches it
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

    const normalizedAddress = address.toLowerCase();

    // Check cache first
    const { data: cached, error: cacheError } = await supabase
      .from("perkos_ens_cache")
      .select("ens_name, expires_at")
      .eq("wallet_address", normalizedAddress)
      .single();

    if (!cacheError && cached) {
      // Check if cache is still valid
      const expiresAt = new Date(cached.expires_at);
      if (expiresAt > new Date()) {
        return NextResponse.json({
          address: normalizedAddress,
          ensName: cached.ens_name,
          cached: true,
        });
      }
    }

    // Cache miss or expired - resolve ENS name
    let ensName: string | null = null;
    try {
      ensName = await publicClient.getEnsName({
        address: address as `0x${string}`,
      });
    } catch (error) {
      console.error("Error resolving ENS name:", error);
      // Continue with null ENS name
    }

    // Upsert cache entry
    const { error: upsertError } = await supabase
      .from("perkos_ens_cache")
      .upsert(
        {
          wallet_address: normalizedAddress,
          ens_name: ensName,
          resolved_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        },
        { onConflict: "wallet_address" }
      );

    if (upsertError) {
      console.error("Error caching ENS name:", upsertError);
    }

    return NextResponse.json({
      address: normalizedAddress,
      ensName,
      cached: false,
    });
  } catch (error) {
    console.error("Error in GET /api/ens:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ens/batch
 * Batch resolve multiple addresses
 */
export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json();

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "Addresses array required" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (addresses.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 addresses per batch" },
        { status: 400 }
      );
    }

    const normalizedAddresses = addresses.map((a) => a.toLowerCase());

    // Check cache for all addresses
    const { data: cached, error: cacheError } = await supabase
      .from("perkos_ens_cache")
      .select("wallet_address, ens_name, expires_at")
      .in("wallet_address", normalizedAddresses);

    const results: Record<string, string | null> = {};
    const toResolve: string[] = [];
    const now = new Date();

    // Process cached entries
    if (!cacheError && cached) {
      for (const entry of cached) {
        const expiresAt = new Date(entry.expires_at);
        if (expiresAt > now) {
          results[entry.wallet_address] = entry.ens_name;
        } else {
          toResolve.push(entry.wallet_address);
        }
      }
    }

    // Find addresses not in cache
    for (const addr of normalizedAddresses) {
      if (!(addr in results) && !toResolve.includes(addr)) {
        toResolve.push(addr);
      }
    }

    // Resolve missing/expired addresses (with rate limiting)
    const resolvePromises = toResolve.slice(0, 10).map(async (addr) => {
      try {
        const ensName = await publicClient.getEnsName({
          address: addr as `0x${string}`,
        });
        results[addr] = ensName;

        // Cache the result
        await supabase
          .from("perkos_ens_cache")
          .upsert(
            {
              wallet_address: addr,
              ens_name: ensName,
              resolved_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "wallet_address" }
          );
      } catch (error) {
        console.error(`Error resolving ENS for ${addr}:`, error);
        results[addr] = null;
      }
    });

    await Promise.all(resolvePromises);

    // For remaining addresses that we didn't resolve (rate limited), set to null
    for (const addr of toResolve.slice(10)) {
      if (!(addr in results)) {
        results[addr] = null;
      }
    }

    return NextResponse.json({
      results,
      resolved: toResolve.slice(0, 10).length,
      cached: normalizedAddresses.length - toResolve.length,
      pending: Math.max(0, toResolve.length - 10),
    });
  } catch (error) {
    console.error("Error in POST /api/ens:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
