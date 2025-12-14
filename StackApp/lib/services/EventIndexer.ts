import { createPublicClient, http, type PublicClient, parseAbiItem } from 'viem';
import { supabaseAdmin } from '../db/supabase';
import { SUPPORTED_NETWORKS } from '../utils/chains';
import type { Address } from '../types/x402';

/**
 * Event Indexer Service
 * Listens to blockchain events and indexes them to Supabase for analytics
 */

interface IndexerConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  contracts: {
    token?: Address;
    escrow?: Address;
  };
  startBlock: bigint | 'latest';
}

export class EventIndexer {
  private clients: Map<string, PublicClient> = new Map();
  private isRunning = false;
  private intervalIds: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize public clients for each supported network
    for (const [networkKey, networkConfig] of Object.entries(SUPPORTED_NETWORKS)) {
      if (networkConfig.rpcUrl) {
        const client = createPublicClient({
          transport: http(networkConfig.rpcUrl),
        });
        this.clients.set(networkKey, client);
      }
    }
  }

  /**
   * Start indexing events from all networks
   */
  async start() {
    if (this.isRunning) {
      console.log('Event indexer already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting event indexer...');

    // Start indexing for each network
    for (const [networkKey, client] of this.clients) {
      this.startNetworkIndexer(networkKey, client);
    }
  }

  /**
   * Stop all indexers
   */
  stop() {
    console.log('⏹️  Stopping event indexer...');
    this.isRunning = false;

    for (const [network, intervalId] of this.intervalIds) {
      clearInterval(intervalId);
      console.log(`Stopped indexer for ${network}`);
    }

    this.intervalIds.clear();
  }

  /**
   * Start indexing for a specific network
   */
  private startNetworkIndexer(network: string, client: PublicClient) {
    const networkConfig = SUPPORTED_NETWORKS[network];
    if (!networkConfig) return;

    console.log(`📡 Starting indexer for ${network} (Chain ID: ${networkConfig.chainId})`);

    // Get the latest indexed block from database or use configured start block
    this.getLastIndexedBlock(network).then((lastBlock) => {
      let currentBlock = lastBlock;

      // Poll for new blocks
      const intervalId = setInterval(async () => {
        try {
          const latestBlock = await client.getBlockNumber();

          if (latestBlock > currentBlock) {
            await this.indexBlockRange(
              network,
              networkConfig.chainId,
              client,
              currentBlock + 1n,
              latestBlock
            );
            currentBlock = latestBlock;
          }
        } catch (error) {
          console.error(`Error indexing ${network}:`, error);
        }
      }, Number(process.env.EVENT_INDEXING_INTERVAL) || 12000);

      this.intervalIds.set(network, intervalId);
    });
  }

  /**
   * Index events from a range of blocks
   */
  private async indexBlockRange(
    network: string,
    chainId: number,
    client: PublicClient,
    fromBlock: bigint,
    toBlock: bigint
  ) {
    console.log(`📊 Indexing ${network} blocks ${fromBlock} to ${toBlock}`);

    try {
      // Index EIP-3009 TransferWithAuthorization events
      await this.indexTransferWithAuthEvents(network, chainId, client, fromBlock, toBlock);

      // Index EIP-712 Voucher events (if escrow contract is deployed)
      await this.indexVoucherEvents(network, chainId, client, fromBlock, toBlock);

      // Update network stats
      await this.updateNetworkStats(network, chainId);

      console.log(`✅ Indexed ${network} up to block ${toBlock}`);
    } catch (error) {
      console.error(`❌ Error indexing ${network}:`, error);
    }
  }

  /**
   * Index EIP-3009 TransferWithAuthorization events
   */
  private async indexTransferWithAuthEvents(
    network: string,
    chainId: number,
    client: PublicClient,
    fromBlock: bigint,
    toBlock: bigint
  ) {
    const tokenAddress = this.getTokenAddress(network);
    if (!tokenAddress) return;

    try {
      // TransferWithAuthorization event signature
      const logs = await client.getLogs({
        address: tokenAddress,
        event: parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'),
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const tx = await client.getTransaction({ hash: log.transactionHash });
        const receipt = await client.getTransactionReceipt({ hash: log.transactionHash });

        // Parse transaction data to extract transfer details
        // This is simplified - you'll need to decode the actual function call
        await this.saveTransaction({
          hash: log.transactionHash,
          network,
          chainId,
          scheme: 'exact',
          payer: tx.from,
          payee: tx.to || tokenAddress,
          amount: '0', // Extract from tx data
          asset: tokenAddress,
          status: receipt.status === 'success' ? 'settled' : 'failed',
          blockNumber: Number(log.blockNumber),
        });
      }
    } catch (error) {
      console.error(`Error indexing TransferWithAuth events:`, error);
    }
  }

  /**
   * Index voucher-related events (deferred payments)
   */
  private async indexVoucherEvents(
    network: string,
    chainId: number,
    client: PublicClient,
    fromBlock: bigint,
    toBlock: bigint
  ) {
    const escrowAddress = this.getEscrowAddress(network);
    if (!escrowAddress) return;

    try {
      // VoucherDeposited event (example - adjust based on your escrow contract)
      const logs = await client.getLogs({
        address: escrowAddress,
        event: parseAbiItem('event VoucherDeposited(bytes32 indexed voucherId, address indexed buyer, address indexed seller, uint256 amount)'),
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const { args } = log;
        if (!args) continue;

        // Save voucher to database
        await this.saveVoucher({
          voucherId: args.voucherId as string,
          buyer: args.buyer as Address,
          seller: args.seller as Address,
          valueAggregate: args.amount?.toString() || '0',
          network,
          chainId,
        });
      }
    } catch (error) {
      console.error(`Error indexing voucher events:`, error);
    }
  }

  /**
   * Save transaction to database
   */
  private async saveTransaction(data: {
    hash: string;
    network: string;
    chainId: number;
    scheme: 'exact' | 'deferred';
    payer: string;
    payee: string;
    amount: string;
    asset: string;
    status: 'pending' | 'verified' | 'settled' | 'failed';
    blockNumber: number;
  }) {
    const { error } = await supabaseAdmin.from('perkos_transactions').upsert(
      {
        hash: data.hash,
        network: data.network,
        chain_id: data.chainId,
        scheme: data.scheme,
        payer: data.payer,
        payee: data.payee,
        amount: data.amount,
        asset: data.asset,
        status: data.status,
        block_number: data.blockNumber,
      },
      { onConflict: 'hash' }
    );

    if (error) {
      console.error('Error saving transaction:', error);
    }
  }

  /**
   * Save voucher to database
   */
  private async saveVoucher(data: {
    voucherId: string;
    buyer: Address;
    seller: Address;
    valueAggregate: string;
    network: string;
    chainId: number;
  }) {
    const { error } = await supabaseAdmin.from('perkos_vouchers').upsert(
      {
        voucher_id: data.voucherId,
        buyer: data.buyer,
        seller: data.seller,
        value_aggregate: data.valueAggregate,
        asset: this.getTokenAddress(data.network) || '',
        timestamp: Date.now().toString(),
        nonce: '0',
        escrow: this.getEscrowAddress(data.network) || '',
        chain_id: data.chainId.toString(),
        signature: '',
        settled: false,
      },
      { onConflict: 'voucher_id' }
    );

    if (error) {
      console.error('Error saving voucher:', error);
    }
  }

  /**
   * Update aggregated network statistics
   */
  private async updateNetworkStats(network: string, chainId: number) {
    const today = new Date().toISOString().split('T')[0];

    // Get today's transaction stats
    const { data: transactions } = await supabaseAdmin
      .from('perkos_transactions')
      .select('amount, payer')
      .eq('network', network)
      .gte('created_at', `${today}T00:00:00`)
      .eq('status', 'settled');

    if (!transactions || transactions.length === 0) return;

    const totalVolume = transactions
      .reduce((sum, tx) => sum + BigInt(tx.amount || '0'), 0n)
      .toString();

    const uniqueUsers = new Set(transactions.map((tx) => tx.payer)).size;
    const averageTxValue = (BigInt(totalVolume) / BigInt(transactions.length)).toString();

    // Upsert network stats
    await supabaseAdmin.from('perkos_network_stats').upsert(
      {
        network,
        chain_id: chainId,
        date: today,
        total_transactions: transactions.length,
        total_volume: totalVolume,
        unique_users: uniqueUsers,
        average_tx_value: averageTxValue,
      },
      { onConflict: 'network,date' }
    );
  }

  /**
   * Get the last indexed block for a network
   */
  private async getLastIndexedBlock(network: string): Promise<bigint> {
    const { data } = await supabaseAdmin
      .from('perkos_transactions')
      .select('block_number')
      .eq('network', network)
      .order('block_number', { ascending: false })
      .limit(1)
      .single();

    if (data?.block_number) {
      return BigInt(data.block_number);
    }

    // If no data, start from configured block or latest
    const startBlock = process.env.EVENT_INDEXING_START_BLOCK || 'latest';
    if (startBlock === 'latest') {
      const client = this.clients.get(network);
      if (client) {
        return await client.getBlockNumber();
      }
    }

    return BigInt(startBlock);
  }

  /**
   * Get token address for network
   */
  private getTokenAddress(network: string): Address | null {
    const envVar = `NEXT_PUBLIC_${network.toUpperCase()}_PAYMENT_TOKEN`;
    return (process.env[envVar] as Address) || null;
  }

  /**
   * Get escrow address for network
   */
  private getEscrowAddress(network: string): Address | null {
    const envVar = `NEXT_PUBLIC_${network.toUpperCase()}_ESCROW_ADDRESS`;
    return (process.env[envVar] as Address) || null;
  }
}

// Singleton instance
let indexer: EventIndexer | null = null;

export function getEventIndexer(): EventIndexer {
  if (!indexer) {
    indexer = new EventIndexer();
  }
  return indexer;
}

// Auto-start if enabled
if (process.env.ENABLE_EVENT_INDEXING === 'true' && typeof window === 'undefined') {
  getEventIndexer().start();
}
