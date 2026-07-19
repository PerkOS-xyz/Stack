import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = "force-dynamic";

const SCAN_API = "https://www.8004scan.io/api/v1/public";
const BAZAAR_EVM_CHAINS = new Set([8453, 84532]);

export async function OPTIONS() {
  return corsOptions();
}

interface ScanChain {
  chain_id: number;
  name: string;
  chain_key: string;
  enabled: boolean;
  provider_status?: string | null;
}

async function getScanChain(chainId: number): Promise<ScanChain | null> {
  try {
    const response = await fetch(`${SCAN_API}/chains`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const chains = payload?.data?.data?.chains;
    if (!Array.isArray(chains)) return null;
    return chains.find((chain: ScanChain) => chain.chain_id === chainId) || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/v2/agents/discovery?chainId=10143&agentId=42
 * Reports actual ERC-8004 index status plus eligibility for complementary
 * protocol discovery surfaces. It never treats a well-known file as proof of
 * an on-chain registration.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(`agent-discovery:${getClientIp(request)}`, 60, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  const params = request.nextUrl.searchParams;
  const chainId = Number(params.get("chainId"));
  const agentIdRaw = params.get("agentId");
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "chainId must be a positive integer" }, { status: 400, headers: corsHeaders });
  }
  if (agentIdRaw === null || !/^(0|[1-9]\d*)$/.test(agentIdRaw)) {
    return NextResponse.json({ error: "agentId must be a non-negative integer" }, { status: 400, headers: corsHeaders });
  }

  const [scanChain, agentResponse] = await Promise.all([
    getScanChain(chainId),
    fetch(`${SCAN_API}/agents/${chainId}/${agentIdRaw}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
    }).catch(() => null),
  ]);

  let indexedAgent: Record<string, unknown> | null = null;
  if (agentResponse?.ok) {
    const payload = await agentResponse.json().catch(() => null);
    indexedAgent = (payload?.data || null) as Record<string, unknown> | null;
  }

  const supportedProtocols = Array.isArray(indexedAgent?.supported_protocols)
    ? indexedAgent.supported_protocols
    : [];
  const scanUrl = scanChain?.chain_key
    ? `https://8004scan.io/agents/${scanChain.chain_key.replace(/_mainnet$/, "").replace(/_/g, "-")}/${agentIdRaw}`
    : `https://8004scan.io/agents/${chainId}/${agentIdRaw}`;

  return NextResponse.json(
    {
      success: true,
      identity: { chainId, agentId: agentIdRaw },
      erc8004scan: {
        supportedChain: Boolean(scanChain?.enabled),
        chain: scanChain,
        indexed: Boolean(indexedAgent),
        status: indexedAgent ? "indexed" : scanChain?.enabled ? "pending-or-not-found" : "unsupported-chain",
        url: scanUrl,
        agent: indexedAgent,
      },
      discovery: [
        {
          service: "8004scan",
          category: "ERC-8004 indexer",
          eligible: Boolean(scanChain?.enabled),
          automatic: true,
          requirement: "Mint in the official registry and expose a resolvable registration-v1 agentURI.",
        },
        {
          service: "A2A",
          category: "agent-to-agent protocol",
          eligible: supportedProtocols.includes("A2A"),
          automatic: false,
          requirement: "Serve a valid /.well-known/agent-card.json and a working declared transport endpoint.",
        },
        {
          service: "x402 Bazaar",
          category: "payable API and MCP discovery",
          eligible: BAZAAR_EVM_CHAINS.has(chainId),
          automatic: false,
          requirement: "Use a Bazaar-capable facilitator and include the bazaar extension with input/output schemas on each paid route.",
          note: BAZAAR_EVM_CHAINS.has(chainId)
            ? "The current official Bazaar documents Base and Base Sepolia for EVM resources."
            : "This EVM network is not currently listed by the official Bazaar documentation.",
        },
        {
          service: "Official MCP Registry",
          category: "MCP server registry",
          eligible: true,
          automatic: false,
          requirement: "Operate an MCP server, publish its package or remote server metadata, verify namespace ownership, and publish server.json.",
        },
        {
          service: "OASF metadata",
          category: "capability taxonomy",
          eligible: true,
          automatic: false,
          requirement: "Add an OASF service document to registration-v1 metadata; it improves machine-readable capabilities but is not itself a central index.",
        },
      ],
    },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } }
  );
}
