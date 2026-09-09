/**
 * GET /.well-known/oauth-authorization-server and /.well-known/openid-configuration
 *
 * A signpost, not a copy. RFC 8414 requires the metadata's `issuer` to match
 * the origin it was fetched from, so serving the issuer's document from here
 * would either carry a foreign issuer (which correct clients reject) or claim
 * this origin is the issuer, which it is not. A 308 says where to look and the
 * document arrives from the origin that owns it. Same choice as perkos.xyz.
 */
import { NextResponse } from "next/server";
import { OAUTH_ISSUER } from "@/lib/agents/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.redirect(`${OAUTH_ISSUER}/.well-known/oauth-authorization-server`, {
    status: 308,
    headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
