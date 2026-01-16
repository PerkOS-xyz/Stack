/**
 * API Performance Wrapper
 * Wraps Next.js API route handlers to automatically log performance
 */

import { NextRequest, NextResponse } from "next/server";
import { logPerformance } from "./performanceLogger";

type ApiHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Wraps an API route handler with performance logging
 * Usage:
 * ```
 * export const GET = withApiPerformance("/api/example", async (req) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: "..." });
 * });
 * ```
 */
export function withApiPerformance(
  endpoint: string,
  handler: ApiHandler
): ApiHandler {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const method = req.method || "GET";

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;

      logPerformance(endpoint, method, duration, response.status);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logPerformance(endpoint, method, duration, 500, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  };
}

/**
 * Manually log performance for routes that can't use the wrapper
 * Call at the end of your handler:
 * ```
 * const startTime = Date.now();
 * // ... handler logic ...
 * logApiPerformance("/api/example", "GET", startTime, 200);
 * ```
 */
export function logApiPerformance(
  endpoint: string,
  method: string,
  startTime: number,
  statusCode: number,
  metadata?: Record<string, unknown>
): void {
  const duration = Date.now() - startTime;
  logPerformance(endpoint, method, duration, statusCode, metadata);
}
