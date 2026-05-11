import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { logger } from "../utils/logger";
import { StellarSwapService } from "./StellarSwapService";
import { StellarTransactionService } from "./StellarTransactionService";

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
const MIN_XLM_RESERVE = 1.5;
const MIN_SWAP_AMOUNT = 0.5; // Don't swap tiny amounts

interface WatchedWallet {
  walletId: string;
  userId: string;
  keypair: Keypair;
}

/**
 * Watches Stellar Horizon for incoming XLM deposits and auto-swaps to USDC.
 *
 * Uses Horizon streaming API (SSE) to get real-time payment notifications.
 * On deposit: auto-swap XLM→USDC via StellarSwapService (keeping 1.5 XLM reserve).
 */
export class StellarDepositWatcher {
  private server: Horizon.Server;
  private swapService: StellarSwapService;
  private txService: StellarTransactionService;
  private closeHandlers: Map<string, () => void> = new Map();

  constructor() {
    this.server = new Horizon.Server(HORIZON_URL);
    this.swapService = new StellarSwapService();
    this.txService = new StellarTransactionService();
  }

  /**
   * Start watching a wallet for incoming XLM deposits
   */
  watch(wallet: WatchedWallet): void {
    const { walletId, userId, keypair } = wallet;
    const publicKey = keypair.publicKey();

    if (this.closeHandlers.has(publicKey)) {
      logger.warn("Already watching wallet", { publicKey, walletId });
      return;
    }

    logger.info("Starting deposit watcher", { publicKey, walletId });

    const close = this.server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage: (payment: any) => {
          this.handlePayment(payment, wallet).catch((err) => {
            logger.error("Error handling payment", {
              error: err instanceof Error ? err.message : String(err),
              publicKey,
            });
          });
        },
        onerror: (error: any) => {
          logger.error("Deposit watcher stream error", {
            error: error instanceof Error ? error.message : String(error),
            publicKey,
          });
        },
      }) as unknown as () => void;

    this.closeHandlers.set(publicKey, close);
  }

  /**
   * Stop watching a wallet
   */
  unwatch(publicKey: string): void {
    const close = this.closeHandlers.get(publicKey);
    if (close) {
      close();
      this.closeHandlers.delete(publicKey);
      logger.info("Stopped deposit watcher", { publicKey });
    }
  }

  /**
   * Stop all watchers
   */
  unwatchAll(): void {
    for (const [publicKey, close] of this.closeHandlers) {
      close();
      logger.info("Stopped deposit watcher", { publicKey });
    }
    this.closeHandlers.clear();
  }

  private async handlePayment(
    payment: any,
    wallet: WatchedWallet,
  ): Promise<void> {
    const { walletId, userId, keypair } = wallet;
    const publicKey = keypair.publicKey();

    // Only handle incoming native (XLM) payments
    if (payment.type !== "payment" && payment.type !== "create_account") return;
    if (payment.to !== publicKey) return;

    const isXlm =
      payment.type === "create_account" ||
      (payment.asset_type === "native");

    if (!isXlm) return;

    const amount = payment.type === "create_account"
      ? payment.starting_balance
      : payment.amount;

    logger.info("XLM deposit detected", {
      publicKey,
      amount,
      from: payment.from || payment.source_account,
      txHash: payment.transaction_hash,
    });

    // Log the deposit
    await this.txService.log({
      walletId,
      userId,
      type: "deposit",
      amount,
      asset: "XLM",
      stellarTxHash: payment.transaction_hash,
      status: "confirmed",
    });

    // Check if we should auto-swap
    await this.tryAutoSwap(wallet);
  }

  private async tryAutoSwap(wallet: WatchedWallet): Promise<void> {
    const { walletId, userId, keypair } = wallet;
    const publicKey = keypair.publicKey();

    try {
      const balances = await this.swapService.getBalances(publicKey);
      const xlmBalance = parseFloat(balances.xlm);
      const swappable = xlmBalance - MIN_XLM_RESERVE;

      if (swappable < MIN_SWAP_AMOUNT) {
        logger.info("Not enough XLM to swap after reserve", {
          publicKey,
          xlmBalance,
          reserve: MIN_XLM_RESERVE,
          swappable,
        });
        return;
      }

      const swapAmount = swappable.toFixed(7);
      logger.info("Auto-swapping XLM to USDC", {
        publicKey,
        swapAmount,
      });

      // Ensure USDC trustline exists
      await this.swapService.ensureUsdcTrustline(keypair);

      const result = await this.swapService.swapXlmToUsdc(keypair, swapAmount);

      // Log the swap
      await this.txService.log({
        walletId,
        userId,
        type: "swap",
        amount: swapAmount,
        asset: "XLM",
        fromAsset: "XLM",
        fromAmount: swapAmount,
        toAsset: "USDC",
        toAmount: result.usdcReceived,
        stellarTxHash: result.txHash,
        status: "confirmed",
      });

      logger.info("Auto-swap completed", {
        publicKey,
        xlmSwapped: swapAmount,
        usdcReceived: result.usdcReceived,
        txHash: result.txHash,
      });
    } catch (error) {
      logger.error("Auto-swap failed", {
        error: error instanceof Error ? error.message : String(error),
        publicKey,
      });

      await this.txService.log({
        walletId,
        userId,
        type: "swap",
        amount: "0",
        asset: "XLM",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
