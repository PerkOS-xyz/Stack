/**
 * Markdown for Agents. Reached by `GET /` with `Accept: text/markdown`
 * (middleware rewrite) and by `GET /index.md` (next.config rewrite).
 */
import { NextResponse } from "next/server";
import { X402Service } from "@/lib/services/X402Service";
import { estimateTokens, stackMarkdown } from "@/lib/agents/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const kinds = new X402Service().getSupported().kinds;
  const body = stackMarkdown(kinds);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokens(body)),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
