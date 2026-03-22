import { NextRequest, NextResponse } from "next/server";
import { StellarWalletService } from "@/lib/services/StellarWalletService";
import { StellarSwapService } from "@/lib/services/StellarSwapService";
import { StellarTransactionService } from "@/lib/services/StellarTransactionService";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const walletService = new StellarWalletService();
const swapService = new StellarSwapService();
const txService = new StellarTransactionService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, xlmAmount } = body;

    if (!userId || !xlmAmount) {
      return NextResponse.json(
        { error: "userId and xlmAmount are required" },
        { status: 400 },
      );
    }

    const wallet = await walletService.getWalletByUserId(userId);
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    if (wallet.status !== "active") {
      return NextResponse.json({ error: "Wallet is not active" }, { status: 403 });
    }

    const keypair = await walletService.getKeypair(wallet.id);
    await swapService.ensureUsdcTrustline(keypair);

    const result = await swapService.swapXlmToUsdc(keypair, xlmAmount);

    await txService.log({
      walletId: wallet.id,
      userId,
      type: "swap",
      amount: result.usdcReceived,
      asset: "USDC",
      fromAsset: "XLM",
      fromAmount: xlmAmount,
      toAsset: "USDC",
      toAmount: result.usdcReceived,
      stellarTxHash: result.txHash,
      status: "confirmed",
    });

    // Refresh balances
    const balances = await swapService.getBalances(wallet.publicKey);
    await walletService.updateBalance(wallet.id, balances.xlm, balances.usdc);

    return NextResponse.json({
      txHash: result.txHash,
      xlmSent: xlmAmount,
      usdcReceived: result.usdcReceived,
      newBalance: balances,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swap failed";
    logger.error("Stellar swap failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const xlmAmount = req.nextUrl.searchParams.get("xlmAmount");
    if (!xlmAmount) {
      return NextResponse.json(
        { error: "xlmAmount query param required" },
        { status: 400 },
      );
    }

    const quote = await swapService.getQuote(xlmAmount);
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
