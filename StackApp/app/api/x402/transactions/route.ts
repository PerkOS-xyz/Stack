/**
 * API Route: GET /api/x402/transactions
 * Fetch x402 payment transactions for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";
import { getNativeTokenSymbol, weiToNativeToken } from "@/lib/utils/chains";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const network = searchParams.get("network");
    const scheme = searchParams.get("scheme");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate time filter
    let timeFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case "24h":
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = null;
    }

    // Build query - Note: gas_fee_wei column may not exist yet in older databases
    let query = firebaseAdmin
      .from("perkos_x402_transactions")
      .select(
        `
        id,
        transaction_hash,
        payer_address,
        recipient_address,
        sponsor_address,
        amount_wei,
        amount_usd,
        asset_symbol,
        network,
        chain_id,
        scheme,
        vendor_domain,
        status,
        created_at,
        gas_fee_wei
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (timeFilter) {
      query = query.gte("created_at", timeFilter.toISOString());
    }

    if (network && network !== "all") {
      query = query.eq("network", network);
    }

    if (scheme && scheme !== "all") {
      query = query.eq("scheme", scheme);
    }

    // Apply search filter (searches transaction_hash, payer_address, recipient_address)
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      query = query.or(
        `transaction_hash.ilike.%${searchTerm}%,payer_address.ilike.%${searchTerm}%,recipient_address.ilike.%${searchTerm}%`
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json(
        { error: "Failed to fetch transactions", details: error.message },
        { status: 500 }
      );
    }

    // Get summary stats
    let statsQuery = firebaseAdmin
      .from("perkos_x402_transactions")
      .select("amount_usd, status, transaction_hash, payer_address, recipient_address");

    if (timeFilter) {
      statsQuery = statsQuery.gte("created_at", timeFilter.toISOString());
    }

    if (network && network !== "all") {
      statsQuery = statsQuery.eq("network", network);
    }

    if (scheme && scheme !== "all") {
      statsQuery = statsQuery.eq("scheme", scheme);
    }

    // Apply search filter to stats query as well
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      statsQuery = statsQuery.or(
        `transaction_hash.ilike.%${searchTerm}%,payer_address.ilike.%${searchTerm}%,recipient_address.ilike.%${searchTerm}%`
      );
    }

    const { data: statsData } = await statsQuery;

    // Calculate statistics
    const totalTransactions = statsData?.length || 0;
    const successfulTransactions =
      statsData?.filter((tx) => tx.status === "success").length || 0;
    const totalVolumeUsd =
      statsData?.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0) || 0;
    const avgTransactionUsd =
      totalTransactions > 0 ? totalVolumeUsd / totalTransactions : 0;
    const successRate =
      totalTransactions > 0
        ? ((successfulTransactions / totalTransactions) * 100).toFixed(1)
        : "0";

    // Format transactions for frontend
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTransactions = transactions?.map((tx: any) => {
      const nativeSymbol = getNativeTokenSymbol(tx.network);
      const gasFeeNative = tx.gas_fee_wei
        ? weiToNativeToken(tx.gas_fee_wei, tx.network)
        : null;

      // Format amount with token symbol (usually USDC)
      const tokenSymbol = tx.asset_symbol || "USDC";
      const amountFormatted = tx.amount_usd
        ? `${tx.amount_usd.toFixed(3)} ${tokenSymbol}`
        : `0.000 ${tokenSymbol}`;

      return {
        hash: truncateAddress(tx.transaction_hash),
        fullHash: tx.transaction_hash,
        from: truncateAddress(tx.payer_address),
        fullFrom: tx.payer_address,
        to: truncateAddress(tx.recipient_address),
        fullTo: tx.recipient_address,
        amount: amountFormatted,
        amountRaw: tx.amount_usd || 0,
        assetSymbol: tokenSymbol,
        gasFee: gasFeeNative ? `${gasFeeNative} ${nativeSymbol}` : "-",
        gasFeeWei: tx.gas_fee_wei || null,
        gasFeeNativeSymbol: nativeSymbol,
        scheme: tx.scheme,
        network: tx.network,
        status: tx.status,
        timestamp: formatTimeAgo(new Date(tx.created_at)),
        datetime: formatDateTime(new Date(tx.created_at)),
        datetimeRaw: tx.created_at,
      };
    });

    return NextResponse.json({
      transactions: formattedTransactions || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      stats: {
        totalTransactions: formatNumber(totalTransactions),
        totalVolume: formatCurrency(totalVolumeUsd),
        avgTransaction: formatCurrency(avgTransactionUsd),
        successRate: `${successRate}%`,
      },
    });
  } catch (error) {
    console.error("Error in transactions API:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDateTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  return date.toLocaleString("en-US", options);
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
