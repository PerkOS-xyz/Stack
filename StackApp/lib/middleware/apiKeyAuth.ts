/**
 * API Key Authentication Middleware
 * 
 * Validates X-API-Key header against perkos_api_keys collection.
 * Each key is linked to a wallet address and has scopes (read, write, admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/lib/db/firebase";

export type ApiKeyScope = "read" | "write" | "admin";

export interface ApiKeyRecord {
  id: string;
  key_hash: string;
  wallet_address: string;
  agent_id: string;
  scopes: ApiKeyScope[];
  is_active: boolean;
  last_used_at: string | null;
  requests_count: number;
  rate_limit_per_minute: number;
  created_at: string;
  updated_at: string;
}

export interface AuthenticatedAgent {
  walletAddress: string;
  agentId: string;
  scopes: ApiKeyScope[];
  apiKeyId: string;
}

// In-memory rate limit for API keys
const apiKeyRateLimit = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiKeyRateLimit.entries()) {
    if (value.resetAt <= now) apiKeyRateLimit.delete(key);
  }
}, 60_000);

/**
 * Hash an API key for storage comparison (SHA-256)
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a new API key (prefix + random bytes)
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_perkos_${hex}`;
}

/**
 * Authenticate a request via X-API-Key header.
 * Returns the agent info or null if invalid.
 */
export async function authenticateApiKey(
  req: NextRequest
): Promise<{ agent: AuthenticatedAgent | null; error?: string }> {
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

  if (!apiKey) {
    return { agent: null, error: "Missing X-API-Key header" };
  }

  if (!apiKey.startsWith("sk_perkos_")) {
    return { agent: null, error: "Invalid API key format" };
  }

  const keyHash = await hashApiKey(apiKey);

  const { data: keyRecord, error } = await firebaseAdmin
    .from<ApiKeyRecord>("perkos_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error || !keyRecord) {
    return { agent: null, error: "Invalid API key" };
  }

  if (!keyRecord.is_active) {
    return { agent: null, error: "API key is deactivated" };
  }

  // Rate limiting per API key
  const now = Date.now();
  const rateKey = `apikey:${keyRecord.id}`;
  let record = apiKeyRateLimit.get(rateKey);

  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + 60_000 };
    apiKeyRateLimit.set(rateKey, record);
  }

  if (record.count >= keyRecord.rate_limit_per_minute) {
    return { agent: null, error: "Rate limit exceeded" };
  }

  record.count++;

  // Update last_used_at (fire and forget)
  firebaseAdmin
    .from("perkos_api_keys")
    .update({
      last_used_at: new Date().toISOString(),
      requests_count: (keyRecord.requests_count || 0) + 1,
    })
    .eq("id", keyRecord.id)
    .then(() => {});

  return {
    agent: {
      walletAddress: keyRecord.wallet_address,
      agentId: keyRecord.agent_id,
      scopes: keyRecord.scopes,
      apiKeyId: keyRecord.id,
    },
  };
}

/**
 * Require API key auth with specific scopes.
 * Returns NextResponse error if unauthorized, or the agent info.
 */
export async function requireApiKey(
  req: NextRequest,
  requiredScopes: ApiKeyScope[] = ["read"]
): Promise<
  | { agent: AuthenticatedAgent; response?: never }
  | { agent?: never; response: NextResponse }
> {
  const { agent, error } = await authenticateApiKey(req);

  if (!agent) {
    return {
      response: NextResponse.json(
        { error: error || "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // Check scopes - admin has all access
  if (!agent.scopes.includes("admin")) {
    const hasScope = requiredScopes.every((s) => agent.scopes.includes(s));
    if (!hasScope) {
      return {
        response: NextResponse.json(
          { error: `Insufficient permissions. Required: ${requiredScopes.join(", ")}` },
          { status: 403 }
        ),
      };
    }
  }

  return { agent };
}
