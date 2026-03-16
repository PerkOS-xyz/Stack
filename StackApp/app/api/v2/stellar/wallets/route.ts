import { NextRequest, NextResponse } from "next/server";
import { StellarWalletService } from "@/lib/services/StellarWalletService";
import { StellarSwapService } from "@/lib/services/StellarSwapService";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const walletService = new StellarWalletService();
const swapService = new StellarSwapService();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    const wallet = await walletService.createWallet(userId);

    // Create USDC trustline on the new wallet
    try {
      const keypair = await walletService.getKeypair(wallet.id);
      await swapService.ensureUsdcTrustline(keypair);
    } catch (err) {
      logger.warn("Failed to create USDC trustline (wallet may need XLM first)", {
        walletId: wallet.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      id: wallet.id,
      publicKey: wallet.publicKey,
      status: wallet.status,
      depositAddress: wallet.publicKey,
      createdAt: wallet.createdAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Failed to create stellar wallet", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { error: "userId query param required" },
        { status: 400 },
      );
    }

    const wallet = await walletService.getWalletByUserId(userId);
    if (!wallet) {
      return NextResponse.json(
        { error: "No wallet found for this user" },
        { status: 404 },
      );
    }

    // Refresh balances from chain
    const balances = await swapService.getBalances(wallet.publicKey);
    await walletService.updateBalance(wallet.id, balances.xlm, balances.usdc);

    return NextResponse.json({
      id: wallet.id,
      publicKey: wallet.publicKey,
      status: wallet.status,
      xlmBalance: balances.xlm,
      usdcBalance: balances.usdc,
      spendingLimit: wallet.spendingLimit,
      spent24h: wallet.spent24h,
      autoSwap: wallet.autoSwap,
      createdAt: wallet.createdAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Failed to get stellar wallet", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
