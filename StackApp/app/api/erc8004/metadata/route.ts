import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsHeaders, corsOptions } from "@/lib/utils/cors";
import { rateLimit, getClientIp } from "@/lib/middleware/rateLimit";

export const dynamic = "force-dynamic";

const serviceSchema = z.object({
  name: z.string().min(1).max(64),
  endpoint: z.string().min(1).max(2_048),
  version: z.string().max(32).optional(),
}).passthrough();

const registrationSchema = z.object({
  agentId: z.number().int().nonnegative(),
  agentRegistry: z.string().regex(/^eip155:\d+:0x[a-fA-F0-9]{40}$/),
});

const registrationFileSchema = z.object({
  type: z.literal("https://eips.ethereum.org/EIPS/eip-8004#registration-v1"),
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(4_000),
  image: z.string().url().max(2_048).optional(),
  services: z.array(serviceSchema).min(1).max(32),
  registrations: z.array(registrationSchema).max(64).default([]),
  supportedTrust: z.array(z.string().max(64)).max(16).optional(),
  x402Support: z.boolean().optional(),
  active: z.boolean().default(true),
}).passthrough();

export async function OPTIONS() {
  return corsOptions();
}

function encodeMetadata(metadata: unknown): string {
  return Buffer.from(JSON.stringify(metadata), "utf8").toString("base64url");
}

function responseForMetadata(metadata: unknown) {
  return NextResponse.json(metadata, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-ERC8004-Spec": "registration-v1",
    },
  });
}

/** Resolve immutable, URL-encoded registration-v1 metadata. */
export async function GET(request: NextRequest) {
  const encoded = request.nextUrl.searchParams.get("data");
  if (!encoded || encoded.length > 32_768 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return NextResponse.json({ error: "Valid data parameter required" }, { status: 400, headers: corsHeaders });
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const parsed = registrationFileSchema.safeParse(decoded);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration-v1 metadata" }, { status: 400, headers: corsHeaders });
    }
    return responseForMetadata(parsed.data);
  } catch {
    return NextResponse.json({ error: "Malformed metadata payload" }, { status: 400, headers: corsHeaders });
  }
}

/** Validate metadata and return a public, immutable HTTPS agentURI. */
export async function POST(request: NextRequest) {
  const limited = rateLimit(`erc8004-metadata:${getClientIp(request)}`, 30, 60_000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const parsed = registrationFileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration-v1 metadata", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders }
      );
    }
    const encoded = encodeMetadata(parsed.data);
    if (encoded.length > 32_768) {
      return NextResponse.json({ error: "Metadata is too large" }, { status: 413, headers: corsHeaders });
    }
    const agentURI = `${new URL(request.url).origin}/api/erc8004/metadata?data=${encoded}`;
    return NextResponse.json({ success: true, agentURI, metadata: parsed.data }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }
}
