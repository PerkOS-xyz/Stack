/**
 * API Route: GET /api/sponsor/analytics
 * Fetch gas payment transaction history with x402 payment details for analytics dashboard
 *
 * Query Parameters:
 * - wallet_id: Filter by sponsor wallet ID (optional)
 * - period: Time period filter (24h, week, 30d, 3months, all) (default: all)
 * - chain_id: Filter by chain ID (optional)
 * - limit: Number of transactions to return (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from "@/lib/db/firebase";

// Extended transaction type that combines sponsor spending + x402 transaction data
interface EnrichedTransaction {
  id: string;
  // Sponsor spending data (gas fees)
  gas_fee_wei: string;
  agent_address: string | null;
  transaction_hash: string | null;
  server_domain: string | null;
  server_endpoint: string | null;
  chain_id: string | null;
  network_name: string | null;
  spent_at: string;
  sponsor_wallet_id: string;
  // x402 transaction data (payment details)
  payment_amount_wei?: string;
  payment_amount_usd?: number;
  payer_address?: string;
  recipient_address?: string;
  asset_symbol?: string;
  scheme?: string;
  status?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('wallet_id');
    const period = searchParams.get('period') || 'all';
    const chainId = searchParams.get('chain_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('[Analytics API] Query params:', { walletId, period, chainId, limit, offset });

    // Calculate time filter based on period
    let timeFilter: Date | null = null;
    const now = new Date();

    switch (period) {
      case '24h':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        timeFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        timeFilter = null;
        break;
    }

    // Build base query for sponsor spending (gas fees)
    let query = firebaseAdmin
      .from('perkos_sponsor_spending')
      .select(`
        id,
        amount_wei,
        agent_address,
        transaction_hash,
        server_domain,
        server_endpoint,
        chain_id,
        network_name,
        spent_at,
        sponsor_wallet_id
      `, { count: 'exact' })
      .order('spent_at', { ascending: false });

    // Apply filters
    if (walletId) {
      query = query.eq('sponsor_wallet_id', walletId);
    }

    if (timeFilter) {
      query = query.gte('spent_at', timeFilter.toISOString());
    }

    if (chainId) {
      // chain_id column is TEXT type, compare as string
      query = query.eq('chain_id', String(chainId));
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: sponsorTransactions, error, count } = await query;

    if (error) {
      console.error('Error fetching sponsor spending:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data', details: error.message },
        { status: 500 }
      );
    }

    // Get transaction hashes to look up x402 payment details
    const txHashes = (sponsorTransactions || [])
      .map(tx => tx.transaction_hash)
      .filter((hash): hash is string => !!hash);

    // Fetch corresponding x402 transaction details
    let x402Transactions: Record<string, any> = {};
    if (txHashes.length > 0) {
      const { data: x402Data, error: x402Error } = await firebaseAdmin
        .from('perkos_x402_transactions')
        .select(`
          transaction_hash,
          amount_wei,
          amount_usd,
          payer_address,
          recipient_address,
          asset_symbol,
          scheme,
          status,
          gas_fee_wei,
          gas_fee_usd
        `)
        .in('transaction_hash', txHashes);

      if (!x402Error && x402Data) {
        // Create lookup map by transaction hash
        x402Transactions = x402Data.reduce((acc, tx) => {
          if (tx.transaction_hash) {
            acc[tx.transaction_hash.toLowerCase()] = tx;
          }
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Merge sponsor spending with x402 transaction data
    const enrichedTransactions: EnrichedTransaction[] = (sponsorTransactions || []).map(tx => {
      const x402Data = tx.transaction_hash
        ? x402Transactions[tx.transaction_hash.toLowerCase()]
        : null;

      return {
        id: tx.id,
        // Gas fee data (from sponsor spending)
        gas_fee_wei: tx.amount_wei,
        agent_address: tx.agent_address,
        transaction_hash: tx.transaction_hash,
        server_domain: tx.server_domain,
        server_endpoint: tx.server_endpoint,
        chain_id: tx.chain_id,
        network_name: tx.network_name,
        spent_at: tx.spent_at,
        sponsor_wallet_id: tx.sponsor_wallet_id,
        // Payment data (from x402 transactions)
        payment_amount_wei: x402Data?.amount_wei,
        payment_amount_usd: x402Data?.amount_usd,
        payer_address: x402Data?.payer_address || tx.agent_address,
        recipient_address: x402Data?.recipient_address,
        asset_symbol: x402Data?.asset_symbol || 'USDC',
        scheme: x402Data?.scheme,
        status: x402Data?.status || 'success',
      };
    });

    console.log('[Analytics API] Results:', {
      count,
      enrichedCount: enrichedTransactions.length,
      x402Matched: Object.keys(x402Transactions).length,
      sampleTx: enrichedTransactions[0] ? {
        hash: enrichedTransactions[0].transaction_hash?.slice(0, 10),
        payment: enrichedTransactions[0].payment_amount_wei,
        recipient: enrichedTransactions[0].recipient_address?.slice(0, 10),
      } : null
    });

    // Calculate spending summary
    let summaryQuery = firebaseAdmin
      .from('perkos_sponsor_spending')
      .select('amount_wei, transaction_hash');

    if (walletId) {
      summaryQuery = summaryQuery.eq('sponsor_wallet_id', walletId);
    }

    if (timeFilter) {
      summaryQuery = summaryQuery.gte('spent_at', timeFilter.toISOString());
    }

    if (chainId) {
      summaryQuery = summaryQuery.eq('chain_id', String(chainId));
    }

    const { data: allSponsorTxs } = await summaryQuery;

    // Calculate totals
    const totalGasPaidWei = (allSponsorTxs || []).reduce((sum, tx) => {
      return sum + BigInt(tx.amount_wei || '0');
    }, BigInt(0));

    // Get total payment volume from x402 transactions
    const allTxHashes = (allSponsorTxs || [])
      .map(tx => tx.transaction_hash)
      .filter((hash): hash is string => !!hash);

    let totalPaymentVolumeWei = BigInt(0);
    let totalPaymentVolumeUsd = 0;

    if (allTxHashes.length > 0) {
      const { data: x402Summary } = await firebaseAdmin
        .from('perkos_x402_transactions')
        .select('amount_wei, amount_usd')
        .in('transaction_hash', allTxHashes);

      if (x402Summary) {
        totalPaymentVolumeWei = x402Summary.reduce((sum, tx) => {
          return sum + BigInt(tx.amount_wei || '0');
        }, BigInt(0));

        totalPaymentVolumeUsd = x402Summary.reduce((sum, tx) => {
          return sum + (tx.amount_usd || 0);
        }, 0);
      }
    }

    return NextResponse.json({
      transactions: enrichedTransactions,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      },
      summary: {
        totalGasPaidWei: totalGasPaidWei.toString(),
        totalPaymentVolumeWei: totalPaymentVolumeWei.toString(),
        totalPaymentVolumeUsd,
        totalTransactions: allSponsorTxs?.length || 0,
        period,
        chainId: chainId || 'all'
      }
    });

  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
