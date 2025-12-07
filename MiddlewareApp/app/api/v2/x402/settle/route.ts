import { NextRequest, NextResponse } from "next/server";
import type { X402SettleRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";

const x402Service = new X402Service();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as X402SettleRequest;
    const result = await x402Service.settle(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Settlement failed",
        payer: null,
        transaction: null,
        network: "avalanche",
      },
      { status: 400 }
    );
  }
}
