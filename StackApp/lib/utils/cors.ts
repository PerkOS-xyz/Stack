export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Id, X-API-Key, X-PAYMENT',
};

export function corsOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
