import { NextRequest, NextResponse } from "next/server";
import { StellarTransactionService } from "@/lib/services/StellarTransactionService";

export const dynamic = "force-dynamic";

const txService = new StellarTransactionService();

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (!userId) {
      return NextResponse.json(
        { error: "userId query param required" },
        { status: 400 },
      );
    }

    const transactions = await txService.getByUser(userId, limit);
    return NextResponse.json({ transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
