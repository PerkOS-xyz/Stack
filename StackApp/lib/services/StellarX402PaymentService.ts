import { StellarWalletService } from "./StellarWalletService";
import { StellarSwapService } from "./StellarSwapService";
import { StellarTransactionService } from "./StellarTransactionService";
import { logger } from "../utils/logger";
import type { X402PaymentResult } from "../types/stellar";

const FACILITATOR_URL =
  process.env.STELLAR_FACILITATOR_URL ||
  "https://stellar-relayer.perkos.xyz/api/v1/plugins/x402-facilitator/call";
const FACILITATOR_API_KEY = process.env.STELLAR_FACILITATOR_API_KEY || "";

export class StellarX402PaymentService {
  private walletService: StellarWalletService;
  private swapService: StellarSwapService;
  private txService: StellarTransactionService;

  constructor() {
    this.walletService = new StellarWalletService();
    this.swapService = new StellarSwapService();
    this.txService = new StellarTransactionService();
  }

  async executePayment(
    userId: string,
    targetUrl: string,
    method: string = "GET",
  ): Promise<X402PaymentResult> {
    const wallet = await this.walletService.getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, error: "No wallet found for this user" };
    }

    if (wallet.status !== "active") {
      return { success: false, error: "Wallet is frozen or closed" };
    }

    // Step 1: Call the target endpoint to get 402 requirements
    const initialRes = await fetch(targetUrl, { method });
    if (initialRes.status !== 402) {
      if (initialRes.ok) {
        const data = await initialRes.json().catch(() => null);
        return { success: true, response: data };
      }
      return {
        success: false,
        error: `Unexpected status ${initialRes.status} from target`,
      };
    }

    // Step 2: Parse payment requirements from 402 response
    const requirements = await initialRes.json();
    const payReq = requirements.accepts || requirements;
    const price = payReq.maxAmountRequired || payReq.price || "0";
    const priceUsd = this.parsePrice(price);

    // Step 3: Check spending limit
    const canSpend = await this.walletService.canSpend(wallet.id, priceUsd);
    if (!canSpend) {
      return { success: false, error: "Spending limit exceeded" };
    }

    // Step 4: Check USDC balance
    const balances = await this.swapService.getBalances(wallet.publicKey);
    if (parseFloat(balances.usdc) < parseFloat(priceUsd)) {
      return {
        success: false,
        error: `Insufficient USDC balance. Have: ${balances.usdc}, need: ${priceUsd}`,
      };
    }

    // Step 5: Build and sign x402 payment using @x402/stellar
    const keypair = await this.walletService.getKeypair(wallet.id);
    const stellarSdk = await import("@stellar/stellar-sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ExactStellarScheme: any, x402Client: any, wrapFetchWithPayment: any;
    try {
      ({ ExactStellarScheme } = await import("@x402/stellar/exact/client"));
      ({ x402Client, wrapFetchWithPayment } = await import("@x402/fetch"));
    } catch {
      return { success: false, error: "x402 Stellar client packages not installed" };
    }

    const signer = {
      address: keypair.publicKey(),
      signAuthEntry: async (
        authEntry: string,
        opts?: { networkPassphrase?: string; address?: string },
      ) => {
        const entry = stellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(
          authEntry,
          "base64",
        );
        const signed = await stellarSdk.authorizeEntry(
          entry,
          keypair,
          0,
          opts?.networkPassphrase || stellarSdk.Networks.PUBLIC,
        );
        return {
          signedAuthEntry: signed.toXDR("base64"),
          signerAddress: keypair.publicKey(),
        };
      },
    };

    const client = new x402Client().register(
      "stellar:pubnet",
      new ExactStellarScheme(signer, {
        url: process.env.STELLAR_RPC_URL || "https://mainnet.sorobanrpc.com",
      }),
    );
    const paidFetch = wrapFetchWithPayment(fetch, client);

    // Step 6: Execute paid request
    const paidRes = await paidFetch(targetUrl, { method });
    const data = await paidRes.json().catch(() => null);

    if (!paidRes.ok) {
      return {
        success: false,
        error: `Payment failed with status ${paidRes.status}`,
      };
    }

    // Step 7: Record transaction
    await this.walletService.recordSpending(wallet.id, priceUsd);
    await this.txService.log({
      walletId: wallet.id,
      userId,
      type: "x402_payment",
      amount: priceUsd,
      asset: "USDC",
      x402Endpoint: targetUrl,
      status: "confirmed",
    });

    // Refresh balances
    const newBalances = await this.swapService.getBalances(wallet.publicKey);
    await this.walletService.updateBalance(
      wallet.id,
      newBalances.xlm,
      newBalances.usdc,
    );

    logger.info("x402 payment completed", {
      userId,
      targetUrl,
      usdcCharged: priceUsd,
    });

    return {
      success: true,
      usdcCharged: priceUsd,
      response: data,
    };
  }

  private parsePrice(price: string): string {
    const cleaned = price.replace("$", "").trim();
    return cleaned;
  }
}
