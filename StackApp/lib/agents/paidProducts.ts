/**
 * What the paid API actually delivers. Each builder returns the product or
 * throws; the route settles only after a successful build.
 */
import { firebaseAdmin } from "@/lib/db/firebase";
import { caip2ToNetwork } from "@/lib/utils/x402-headers";
import { toIso } from "./paidApi";

async function getJson(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: r.status, ok: r.ok, body };
}

/** ERC-8004 agent report: identity + reputation + validation + 8004scan indexing. */
export async function agentReport(origin: string, chainId: number, agentId: string, headers: Record<string, string>) {
  const network = caip2ToNetwork(`eip155:${chainId}`);
  if (!network) throw new Error(`chainId ${chainId} is not a network Stack supports`);
  const q = `network=${encodeURIComponent(network)}&agentId=${encodeURIComponent(agentId)}`;
  const [identity, reputation, validation, discovery] = await Promise.all([
    getJson(`${origin}/api/erc8004/identity?${q}`, headers),
    getJson(`${origin}/api/erc8004/reputation?${q}`, headers),
    getJson(`${origin}/api/erc8004/validation?${q}`, headers),
    getJson(`${origin}/api/v2/agents/discovery?chainId=${chainId}&agentId=${encodeURIComponent(agentId)}`, headers),
  ]);
  if (!identity.ok) {
    const reason = (identity.body as { error?: string })?.error || `identity lookup returned ${identity.status}`;
    throw new Error(reason);
  }
  return {
    product: "agent-report",
    generatedAt: new Date().toISOString(),
    agent: { chainId, caip2: `eip155:${chainId}`, network, agentId: String(agentId) },
    identity: identity.body,
    reputation: reputation.ok ? reputation.body : { unavailable: true, status: reputation.status },
    validation: validation.ok ? validation.body : { unavailable: true, status: validation.status },
    discovery: discovery.ok ? discovery.body : { unavailable: true, status: discovery.status },
    source: "https://stack.perkos.xyz",
  };
}

interface TxRow {
  transaction_hash?: string;
  recipient_address?: string;
  amount_usd?: number;
  network?: string;
  chain_id?: number;
  status?: string;
  created_at?: unknown;
  sponsor_address?: string;
  vendor_domain?: string;
}

/** x402 payer trust profile from Stack's own settlement history. */
export async function payerTrust(origin: string, address: string, headers: Record<string, string>) {
  const payer = address.toLowerCase();
  const { data, error } = await firebaseAdmin
    .from<TxRow>("perkos_x402_transactions")
    .select("transaction_hash, recipient_address, amount_usd, network, chain_id, status, created_at, sponsor_address, vendor_domain")
    .eq("payer_address", payer);
  if (error) throw new Error(`settlement history unavailable: ${error.message}`);
  const rows = (data || []) as TxRow[];
  const ok = rows.filter((r) => r.status === "success");
  const dates = rows.map((r) => toIso(r.created_at)).filter((d): d is string => Boolean(d)).sort();
  const networks = [...new Set(rows.map((r) => r.network).filter(Boolean))] as string[];
  const recipients = new Set(ok.map((r) => r.recipient_address).filter(Boolean));
  const domains = [...new Set(ok.map((r) => r.vendor_domain).filter(Boolean))] as string[];
  const volumeUsd = ok.reduce((s, r) => s + (Number(r.amount_usd) || 0), 0);

  // ERC-8004 identities this wallet owns on Base (mainnet), when the registry answers.
  let identities: unknown = { unavailable: true };
  try {
    const r = await getJson(`${origin}/api/erc8004/identity?network=base&owner=${payer}`, headers);
    if (r.ok) identities = r.body;
  } catch {
    // leave unavailable
  }

  return {
    product: "payer-trust",
    generatedAt: new Date().toISOString(),
    wallet: payer,
    settlements: {
      total: rows.length,
      successful: ok.length,
      failed: rows.length - ok.length,
      successRate: rows.length ? Math.round((ok.length / rows.length) * 1000) / 10 : null,
      volumeUsd: Math.round(volumeUsd * 100) / 100,
      distinctRecipients: recipients.size,
      vendorDomains: domains,
      networks,
      firstSeen: dates[0] ?? null,
      lastSeen: dates[dates.length - 1] ?? null,
      sponsored: ok.filter((r) => r.sponsor_address).length,
    },
    erc8004: { network: "base", ownedIdentities: identities },
    disclaimer: "Counts only payments this facilitator verified or settled. Absence of history is not evidence of anything.",
    source: "https://stack.perkos.xyz",
  };
}
