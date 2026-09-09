/**
 * POST /api/v2/agents/keys/rotate
 *
 * Issues a new API key for a registered agent and revokes the previous ones.
 * Keys are stored hashed and cannot be recovered, so a lost key is replaced here.
 *
 * Auth: EIP-191 signature from the agent's wallet over a timestamped message
 * (see lib/agents/rotationMessage.ts), valid for five minutes. Unlike
 * registration, the message is not static, so a captured signature cannot be
 * replayed later.
 *
 * Body: { walletAddress, timestamp, signature }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { rotateAgentApiKey } from "@/lib/services/AgentService";
import { buildRotationMessage, ROTATION_WINDOW_MS } from "@/lib/agents/rotationMessage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const walletAddress: unknown = body?.walletAddress;
    const signature: unknown = body?.signature;
    const timestamp = Number(body?.timestamp);

    if (typeof walletAddress !== "string" || typeof signature !== "string" || !Number.isFinite(timestamp)) {
      return NextResponse.json(
        { error: "walletAddress, timestamp, and signature are required" },
        { status: 400 }
      );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
    }
    if (Math.abs(Date.now() - timestamp) > ROTATION_WINDOW_MS) {
      return NextResponse.json({ error: "Timestamp outside the allowed window" }, { status: 401 });
    }

    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: buildRotationMessage(walletAddress, timestamp),
        signature: signature as `0x${string}`,
      });
    } catch {
      isValid = false;
    }
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const result = await rotateAgentApiKey(walletAddress);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      agent: result.agent,
      apiKey: result.apiKey,
      revokedKeys: result.revoked,
      message:
        "API key rotated. Store it securely; it will not be shown again. Previous keys no longer work.",
    });
  } catch (error) {
    console.error("Error in POST /api/v2/agents/keys/rotate:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
