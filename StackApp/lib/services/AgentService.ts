/**
 * Agent Service
 * 
 * CRUD operations for agent profiles, API keys, wallets, and services.
 * Uses Firebase admin for all DB operations.
 */

import { firebaseAdmin } from "@/lib/db/firebase";
import { generateApiKey, hashApiKey, type ApiKeyScope } from "@/lib/middleware/apiKeyAuth";

export interface AgentProfile {
  id: string;
  wallet_address: string;
  name: string;
  description: string | null;
  agent_card_url: string | null;
  erc8004_agent_id: string | null;
  network: string;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface AgentCreateInput {
  walletAddress: string;
  name: string;
  description?: string;
  agentCardUrl?: string;
  erc8004AgentId?: string;
  network?: string;
}

/**
 * Register a new agent and return an API key
 */
export async function registerAgent(
  input: AgentCreateInput
): Promise<{ agent: AgentProfile; apiKey: string } | { error: string }> {
  const walletAddress = input.walletAddress.toLowerCase();

  // Check if agent already exists
  const { data: existing } = await firebaseAdmin
    .from("perkos_agents")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    return { error: "Agent already registered with this wallet address" };
  }

  // Create agent profile
  const { data: agent, error: agentError } = await firebaseAdmin
    .from<AgentProfile>("perkos_agents")
    .insert({
      wallet_address: walletAddress,
      name: input.name,
      description: input.description || null,
      agent_card_url: input.agentCardUrl || null,
      erc8004_agent_id: input.erc8004AgentId || null,
      network: input.network || "base",
      status: "active",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (agentError || !agent) {
    return { error: agentError?.message || "Failed to create agent profile" };
  }

  // Generate API key
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);

  const { error: keyError } = await firebaseAdmin
    .from("perkos_api_keys")
    .insert({
      key_hash: keyHash,
      wallet_address: walletAddress,
      agent_id: agent.id,
      scopes: ["read", "write"] as ApiKeyScope[],
      is_active: true,
      last_used_at: null,
      requests_count: 0,
      rate_limit_per_minute: 60,
      created_at: new Date().toISOString(),
    });

  if (keyError) {
    // Cleanup agent if key creation fails
    await firebaseAdmin.from("perkos_agents").delete().eq("id", agent.id);
    return { error: "Failed to create API key" };
  }

  return { agent, apiKey: rawKey };
}

/**
 * Get agent profile by wallet address
 */
export async function getAgentByWallet(
  walletAddress: string
): Promise<AgentProfile | null> {
  const { data } = await firebaseAdmin
    .from<AgentProfile>("perkos_agents")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .maybeSingle();

  return data;
}

/**
 * Get agent profile by ID
 */
export async function getAgentById(
  agentId: string
): Promise<AgentProfile | null> {
  const { data } = await firebaseAdmin
    .from<AgentProfile>("perkos_agents")
    .select("*")
    .eq("id", agentId)
    .maybeSingle();

  return data;
}

/**
 * Get agent wallets
 */
export async function getAgentWallets(walletAddress: string) {
  const { data, error } = await firebaseAdmin
    .from("perkos_sponsor_wallets")
    .select("*")
    .eq("user_wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Get agent's registered services (vendors)
 */
export async function getAgentServices(walletAddress: string) {
  const { data, error } = await firebaseAdmin
    .from("perkos_vendors")
    .select("*")
    .eq("wallet_address", walletAddress.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}
