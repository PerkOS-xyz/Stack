import { generateRequestId } from "@/lib/utils/x402-headers";

// Wildcard CORS for public protocol endpoints (x402, erc8004)
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Id, X-API-Key, X-PAYMENT',
};

// Restricted CORS for admin and sponsor routes
const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://stack.perkos.xyz";

export const restrictedCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Allow-Credentials': 'true',
};

export function corsOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function restrictedCorsOptions() {
  return new Response(null, { status: 204, headers: restrictedCorsHeaders });
}

/**
 * Build standard response headers with CORS + rate limit info + request ID.
 */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...corsHeaders,
    'X-Request-Id': generateRequestId(),
    'X-RateLimit-Limit': '100',
    ...extra,
  };
}
