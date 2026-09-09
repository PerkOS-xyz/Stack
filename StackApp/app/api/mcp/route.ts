/**
 * MCP server, Streamable HTTP transport (single POST endpoint, JSON responses).
 * Public path: /mcp (next.config rewrite). Tools run against Stack's own HTTP
 * API on the same origin, so they stay in sync with the REST endpoints.
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";
import { facilitatorInfo, MCP_TOOLS, type McpToolName } from "@/lib/agents/readiness";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Allow-Methods": "POST, OPTIONS, DELETE",
};

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const text = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  isError,
});

async function call(origin: string, name: McpToolName, args: Record<string, unknown>, passthrough: Record<string, string>) {
  const json = async (r: Response) => {
    const t = await r.text();
    try {
      return { status: r.status, body: JSON.parse(t) };
    } catch {
      return { status: r.status, body: t };
    }
  };
  const get = (path: string) => fetch(`${origin}${path}`, { headers: passthrough });
  const post = (path: string, body: unknown) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { ...passthrough, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  switch (name) {
    case "x402_supported_kinds": {
      const r = await json(await get("/api/v2/x402/supported"));
      return text(r.body, r.status >= 400);
    }
    case "x402_verify_payment": {
      const body = { x402Version: args.x402Version ?? 2, paymentPayload: args.paymentPayload, paymentRequirements: args.paymentRequirements };
      const r = await json(await post("/api/v2/x402/verify", body));
      return text(r.body, r.status >= 400);
    }
    case "prepare_erc8004_registration": {
      const body: Record<string, unknown> = { network: args.network };
      if (args.tokenURI) body.tokenURI = args.tokenURI;
      if (args.paymentReceiver) body.paymentReceiver = args.paymentReceiver;
      const r = await json(await post("/api/v2/agents/onboard", body));
      return text(r.body, r.status >= 400);
    }
    case "check_agent_discovery": {
      const q = new URLSearchParams({ chainId: String(args.chainId ?? ""), agentId: String(args.agentId ?? "") });
      const r = await json(await get(`/api/v2/agents/discovery?${q}`));
      return text(r.body, r.status >= 400);
    }
    case "facilitator_info":
      return text(facilitatorInfo());
  }
}

/** Headers to carry into same-origin calls: Vercel's deployment-protection bypass on previews. */
function passthroughHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  const bypass = req.headers.get("x-vercel-protection-bypass");
  if (bypass) out["x-vercel-protection-bypass"] = bypass;
  return out;
}

async function handle(origin: string, m: Rpc, passthrough: Record<string, string>) {
  switch (m.method) {
    case "initialize":
      return ok(m.id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "stack.perkos.xyz", version: "1.0.0" },
        instructions:
          "PerkOS Stack: x402 facilitator and ERC-8004 registration. Tools are read-only or verification-only; settlement and authenticated agent endpoints stay on the REST API (see facilitator_info). No authentication.",
      });
    case "ping":
      return ok(m.id, {});
    case "tools/list":
      return ok(m.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = m.params?.name as string | undefined;
      const args = (m.params?.arguments as Record<string, unknown>) || {};
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return err(m.id, -32602, `unknown tool: ${name}`);
      try {
        return ok(m.id, await call(origin, tool.name, args, passthrough));
      } catch (e) {
        return ok(m.id, text(`tool failed: ${(e as Error).message}`, true));
      }
    }
    default:
      if (m.method?.startsWith("notifications/")) return null;
      return err(m.id, -32601, `method not found: ${m.method}`);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export async function DELETE() {
  return new Response(null, { status: 200, headers: HEADERS });
}

export async function GET() {
  return NextResponse.json({ error: "POST JSON-RPC 2.0 to this endpoint", card: "/.well-known/mcp/server-card.json" }, { status: 405, headers: HEADERS });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(`mcp:${getClientIp(req)}`, 60, 60_000);
  if (!limited.allowed) return NextResponse.json(err(null, -32029, "Rate limit exceeded"), { status: 429, headers: HEADERS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err(null, -32700, "parse error"), { status: 400, headers: HEADERS });
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];
  if (!msgs.every((m) => m && m.jsonrpc === "2.0" && typeof m.method === "string")) {
    return NextResponse.json(err(null, -32600, "invalid request"), { status: 400, headers: HEADERS });
  }
  const origin = new URL(req.url).origin;
  const passthrough = passthroughHeaders(req);
  const out = (await Promise.all(msgs.map((m) => handle(origin, m, passthrough)))).filter(Boolean);
  if (out.length === 0) return new Response(null, { status: 202, headers: HEADERS });
  return NextResponse.json(batch ? out : out[0], { status: 200, headers: HEADERS });
}
