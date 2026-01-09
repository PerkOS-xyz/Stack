/**
 * Stack API Middleware
 *
 * Provides basic validation for API routes.
 *
 * x402 endpoints use wallet-based authentication via the payment payload.
 * Users authenticate by connecting their wallet - no API keys required.
 * Rate limiting and subscription checks happen at the route level.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routes that use wallet-based authentication (via payment payload)
 * These routes check subscription at the handler level
 */
const WALLET_AUTH_PATTERNS = [
  "/api/v2/x402/verify",
  "/api/v2/x402/settle",
];

/**
 * Routes that are always public (no auth required)
 */
const PUBLIC_API_PATTERNS = [
  "/api/v2/x402/supported",
  "/api/v2/x402/config",
  "/api/v2/x402/health",
  "/api/v2/access/plans",
  "/api/v2/access/register",
  "/api/v2/access/status",
  "/api/.well-known",
  "/api/dashboard/stats",
  "/api/deferred/info",
];

/**
 * Routes that require API key authentication (for external integrations)
 * These are non-x402 routes that still need API key auth
 */
const API_KEY_PROTECTED_PATTERNS = [
  "/api/v2/pricing/calculate",
  "/api/v2/pricing/config",
  "/api/v2/agents",
  "/api/v2/deferred/vouchers",
  "/api/v2/deferred/settle",
  "/api/erc8004",
];

/**
 * Check if a path matches any pattern in the list
 */
function matchesPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("*")) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern || path.startsWith(pattern + "/");
  });
}

/**
 * Extract API key from request
 */
function getApiKey(request: NextRequest): string | null {
  // Check X-API-Key header
  const headerKey = request.headers.get("X-API-Key");
  if (headerKey) return headerKey;

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer sk_")) {
    return authHeader.substring(7);
  }

  // Check query parameter (for GET requests only)
  if (request.method === "GET") {
    const queryKey = request.nextUrl.searchParams.get("api_key");
    if (queryKey) return queryKey;
  }

  return null;
}

/**
 * Middleware function
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip non-API routes
  if (!path.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public routes
  if (matchesPattern(path, PUBLIC_API_PATTERNS)) {
    return NextResponse.next();
  }

  // Allow wallet-auth routes (they handle auth via payment payload at handler level)
  if (matchesPattern(path, WALLET_AUTH_PATTERNS)) {
    return NextResponse.next();
  }

  // Check API key protected routes
  if (matchesPattern(path, API_KEY_PROTECTED_PATTERNS)) {
    const apiKey = getApiKey(request);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "API key required",
          message: "Please provide an API key in the X-API-Key header",
          docs: "https://docs.perkos.io/stack/authentication",
        },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": 'ApiKey realm="Stack API"',
          },
        }
      );
    }

    // Basic format validation (sk_live_ or sk_test_ prefix)
    if (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("sk_test_")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid API key format",
          message: "API keys should start with sk_live_ or sk_test_",
        },
        { status: 401 }
      );
    }

    // Pass the API key to the route handler via header
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-validated-api-key", apiKey);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Allow all other API routes (they handle their own auth)
  return NextResponse.next();
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
  ],
};
