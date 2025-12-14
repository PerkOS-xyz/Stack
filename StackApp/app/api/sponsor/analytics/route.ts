/**
 * API Route: GET /api/sponsor/analytics
 * Fetch gas payment transaction history for analytics dashboard
 *
 * Query Parameters:
 * - wallet_id: Filter by sponsor wallet ID (optional)
 * - period: Time period filter (24h, week, 3months, all) (default: all)
 * - chain_id: Filter by chain ID (optional)
 * - limit: Number of transactions to return (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
      case '3months':
        timeFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        timeFilter = null;
        break;
    }

    // Build base query
    let query = supabase
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

    const { data: transactions, error, count } = await query;

    console.log('[Analytics API] Results:', {
      count,
      error: error?.message,
      sampleChainIds: transactions?.slice(0, 3).map(t => ({ chain_id: t.chain_id, type: typeof t.chain_id }))
    });

    if (error) {
      console.error('Error fetching analytics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data', details: error.message },
        { status: 500 }
      );
    }

    // Calculate spending summary
    let summaryQuery = supabase
      .from('perkos_sponsor_spending')
      .select('amount_wei');

    if (walletId) {
      summaryQuery = summaryQuery.eq('sponsor_wallet_id', walletId);
    }

    if (timeFilter) {
      summaryQuery = summaryQuery.gte('spent_at', timeFilter.toISOString());
    }

    if (chainId) {
      // chain_id column is TEXT type, compare as string
      summaryQuery = summaryQuery.eq('chain_id', String(chainId));
    }

    const { data: allTransactions } = await summaryQuery;

    // Calculate totals
    const totalGasPaidWei = allTransactions?.reduce((sum, tx) => {
      return sum + BigInt(tx.amount_wei || '0');
    }, BigInt(0)) || BigInt(0);

    return NextResponse.json({
      transactions: transactions || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (offset + limit) < (count || 0)
      },
      summary: {
        totalGasPaidWei: totalGasPaidWei.toString(),
        totalTransactions: allTransactions?.length || 0,
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
