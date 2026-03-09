/** POST /api/v2/agents/register — Agent self-registration with signature verification. */

import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { registerAgent } from "@/lib/services/AgentService";

export const dynamic = "force-dynamic";

const REGISTRATION_MESSAGE = "Register as PerkOS Stack Agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      name,
      description,
      agentCardUrl,
      erc8004AgentId,
      network,
      signature,
    } = body;

    if (!walletAddress || !name || !signature) {
      return NextResponse.json(
        { error: "walletAddress, name, and signature are required" },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    try {
      const isValid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message: REGISTRATION_MESSAGE,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    const result = await registerAgent({
      walletAddress,
      name,
      description,
      agentCardUrl,
      erc8004AgentId,
      network,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json(
      {
        agent: result.agent,
        apiKey: result.apiKey,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/v2/agents/register:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
