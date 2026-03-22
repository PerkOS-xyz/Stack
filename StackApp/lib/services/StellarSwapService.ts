import {
  Keypair,
  Networks,
  TransactionBuilder,
  Asset,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";
import { logger } from "../utils/logger";
import type { SwapQuote } from "../types/stellar";

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC_ASSET = new Asset("USDC", USDC_ISSUER);
const MIN_XLM_RESERVE = 1.5;

export class StellarSwapService {
  private server: Horizon.Server;

  constructor() {
    this.server = new Horizon.Server(HORIZON_URL);
  }

  async getQuote(xlmAmount: string): Promise<SwapQuote> {
    const amount = parseFloat(xlmAmount);
    if (amount <= 0) throw new Error("Amount must be positive");

    const paths = await this.server
      .strictSendPaths(Asset.native(), xlmAmount, [USDC_ASSET])
      .call();

    if (!paths.records.length) {
      throw new Error("No swap path available for XLM to USDC");
    }

    const bestPath = paths.records[0];
    const usdcEstimate = bestPath.destination_amount;
    const rate = (parseFloat(usdcEstimate) / amount).toFixed(6);
    const minUsdcOut = (parseFloat(usdcEstimate) * 0.99).toFixed(7);

    return { xlmAmount, usdcEstimate, rate, minUsdcOut };
  }

  async swapXlmToUsdc(
    keypair: Keypair,
    xlmAmount: string,
  ): Promise<{ txHash: string; usdcReceived: string }> {
    const account = await this.server.loadAccount(keypair.publicKey());

    const xlmBalance = parseFloat(
      account.balances.find((b: any) => b.asset_type === "native")?.balance || "0",
    );
    const swapAmount = parseFloat(xlmAmount);

    if (xlmBalance - swapAmount < MIN_XLM_RESERVE) {
      throw new Error(
        `Insufficient XLM. Must keep ${MIN_XLM_RESERVE} XLM reserve. ` +
        `Available: ${xlmBalance}, requested: ${swapAmount}`,
      );
    }

    const quote = await this.getQuote(xlmAmount);

    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: Asset.native(),
          sendAmount: xlmAmount,
          destination: keypair.publicKey(),
          destAsset: USDC_ASSET,
          destMin: quote.minUsdcOut,
        }),
      )
      .setTimeout(60)
      .build();

    tx.sign(keypair);
    const result = await this.server.submitTransaction(tx);

    const txHash = (result as any).hash || "";
    logger.info("XLM to USDC swap completed", {
      publicKey: keypair.publicKey(),
      xlmAmount,
      usdcReceived: quote.usdcEstimate,
      txHash,
    });

    return { txHash, usdcReceived: quote.usdcEstimate };
  }

  async getBalances(
    publicKey: string,
  ): Promise<{ xlm: string; usdc: string }> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const xlm = account.balances.find(
        (b: any) => b.asset_type === "native",
      )?.balance || "0";
      const usdc = account.balances.find(
        (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
      )?.balance || "0";
      return { xlm, usdc };
    } catch {
      return { xlm: "0", usdc: "0" };
    }
  }

  async ensureUsdcTrustline(keypair: Keypair): Promise<void> {
    const account = await this.server.loadAccount(keypair.publicKey());
    const hasTrustline = account.balances.some(
      (b: any) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
    );

    if (hasTrustline) return;

    const tx = new TransactionBuilder(account, {
      fee: "10000",
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    await this.server.submitTransaction(tx);
    logger.info("USDC trustline created", { publicKey: keypair.publicKey() });
  }
}
