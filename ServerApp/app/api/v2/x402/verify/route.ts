import { NextRequest, NextResponse } from "next/server";
import type { X402VerifyRequest } from "@/lib/types/x402";
import { X402Service } from "@/lib/services/X402Service";

const x402Service = new X402Service();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as X402VerifyRequest;
    const result = await x402Service.verify(body);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        isValid: false,
        invalidReason: error instanceof Error ? error.message : "Verification failed",
        payer: null,
      },
      { status: 400 }
    );
  }
}
