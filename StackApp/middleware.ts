import { NextResponse, type NextRequest } from "next/server";
import { verifyMessage } from "viem";

/**
 * Root middleware — centralized, defense-in-depth gate for admin routes (M2).
 *
 * Every request to `/api/admin/*` must carry a valid, fresh EIP-191 signature
 * before it reaches any handler. This runs on the edge runtime, so it does NOT
 * perform the admin allowlist lookup (Firestore `admin_users` is Node-only) —
 * the per-route `verifyAdminRequest` remains the authoritative allowlist check.
 * Because this layer never checks the allowlist, it can't regress Firestore-only
 * admins; it only blocks anonymous/replayed requests at the edge and makes new
 * admin routes fail-closed by default.
 *
 * Mirrors the message format + freshness window of `lib/middleware/adminAuth.ts`.
 *
 * Sponsor routes are intentionally NOT gated here: their authorization is
 * per-resource (signer must own a specific wallet) and some reads are public
 * (donation wallets), so it stays in-route.
 */
export const config = {
  matcher: ["/api/admin/:path*"],
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function unauthorized(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 401 });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // Let CORS preflight through — it carries no auth headers by design.
  if (req.method === "OPTIONS") {
    return NextResponse.next();
  }

  const signature = req.headers.get("X-Admin-Signature");
  const timestamp = req.headers.get("X-Admin-Timestamp");
  const address = req.headers.get("X-Admin-Address");

  if (!signature || !timestamp || !address) {
    return unauthorized(
      "Missing auth headers: X-Admin-Signature, X-Admin-Timestamp, X-Admin-Address"
    );
  }

  // Replay protection: reject stale or malformed timestamps.
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > FIVE_MINUTES_MS) {
    return unauthorized("Timestamp expired or invalid");
  }

  // Verify the EIP-191 signature over "PerkOS Admin {timestamp}".
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message: `PerkOS Admin ${timestamp}`,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return unauthorized("Invalid signature");
    }
  } catch {
    return unauthorized("Signature verification failed");
  }

  // Signature is valid + fresh. The route's verifyAdminRequest still enforces
  // the authoritative admin allowlist (Firestore + env).
  return NextResponse.next();
}
