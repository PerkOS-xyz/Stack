import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsOptions();
}

type JsonRpcId = string | number | null;

function jsonRpcError(id: JsonRpcId, code: number, message: string, status = 400) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: corsHeaders }
  );
}

function extractRequest(message: Record<string, unknown>): { text: string; data: Record<string, unknown> } {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  let text = "";
  let data: Record<string, unknown> = {};
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const candidate = part as Record<string, unknown>;
    if (candidate.kind === "text" && typeof candidate.text === "string") text += `${candidate.text}\n`;
    if (candidate.kind === "data" && candidate.data && typeof candidate.data === "object") {
      data = candidate.data as Record<string, unknown>;
    }
  }
  return { text: text.trim(), data };
}

/** Minimal, stateless A2A v0.3 JSON-RPC endpoint for Stack's registration agent. */
export async function POST(request: NextRequest) {
  const limited = rateLimit(`a2a:${getClientIp(request)}`, 30, 60_000);
  if (!limited.allowed) return jsonRpcError(null, -32029, "Rate limit exceeded", 429);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const id = (body.id ?? null) as JsonRpcId;
  if (body.jsonrpc !== "2.0") return jsonRpcError(id, -32600, "Invalid Request");
  if (body.method !== "message/send") {
    return jsonRpcError(id, -32601, "Method not found. Stack currently supports message/send.");
  }

  const params = body.params as Record<string, unknown> | undefined;
  const incoming = params?.message as Record<string, unknown> | undefined;
  if (!incoming || !Array.isArray(incoming.parts)) {
    return jsonRpcError(id, -32602, "params.message.parts is required");
  }

  const { text, data } = extractRequest(incoming);
  const intent = String(data.action || data.intent || text).toLowerCase();
  const baseUrl = new URL(request.url).origin;

  let responseText: string;
  let responseData: Record<string, unknown>;
  if (intent.includes("discover") || intent.includes("8004scan") || intent.includes("index")) {
    responseText = "Use Stack's discovery check with chainId and agentId. A confirmed mint may take time to appear while 8004scan indexes the official registry and resolves agentURI.";
    responseData = {
      action: "check-discovery",
      method: "GET",
      endpoint: `${baseUrl}/api/v2/agents/discovery`,
      requiredQuery: ["chainId", "agentId"],
    };
  } else if (intent.includes("x402") || intent.includes("payment")) {
    responseText = "Read supported payment kinds, then use Stack's x402 v2 verify and settle endpoints. The onboarding endpoint returns a network-specific configuration.";
    responseData = {
      action: "configure-x402",
      supported: `${baseUrl}/api/v2/x402/supported`,
      verify: `${baseUrl}/api/v2/x402/verify`,
      settle: `${baseUrl}/api/v2/x402/settle`,
      onboard: `${baseUrl}/api/v2/agents/onboard`,
    };
  } else {
    responseText = "Send network and tokenURI to the onboarding endpoint to receive executable unsigned ERC-8004 registration calldata, or use the human registration wizard.";
    responseData = {
      action: "prepare-erc8004-registration",
      method: "POST",
      endpoint: `${baseUrl}/api/v2/agents/onboard`,
      requiredBody: ["network"],
      optionalBody: ["tokenURI", "metadata", "paymentReceiver", "agentId"],
      wizard: `${baseUrl}/agents/register`,
      identityApi: `${baseUrl}/api/erc8004/identity`,
    };
  }

  const contextId = typeof incoming.contextId === "string" ? incoming.contextId : crypto.randomUUID();
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      result: {
        kind: "message",
        messageId: crypto.randomUUID(),
        contextId,
        role: "agent",
        parts: [
          { kind: "text", text: responseText },
          { kind: "data", data: responseData },
        ],
      },
    },
    { headers: corsHeaders }
  );
}
