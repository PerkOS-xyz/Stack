/**
 * GET /.well-known/ucp — the UCP business profile (rewritten here by next.config).
 * See lib/agents/ucp.ts for what it declares and why.
 */
import { NextResponse } from "next/server";
import { OAUTH_RESOURCE } from "@/lib/agents/oauth";
import { offerNetworks } from "@/lib/agents/paidApiGate";
import { ucpProfile } from "@/lib/agents/ucp";

export const dynamic = "force-dynamic";

export async function GET() {
  const networks = offerNetworks().map((n) => n.key);
  return new NextResponse(JSON.stringify(ucpProfile(OAUTH_RESOURCE, networks), null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
  });
}
