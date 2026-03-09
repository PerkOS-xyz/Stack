import { generateRequestId } from "@/lib/utils/x402-headers";

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Id, X-API-Key, X-PAYMENT',
};

export function corsOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
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
