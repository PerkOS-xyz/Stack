/**
 * Performance Logger Utility
 * Tracks API response times and logs slow queries for admin monitoring
 */

export interface PerformanceLog {
  id: string;
  endpoint: string;
  method: string;
  duration: number; // in milliseconds
  statusCode: number;
  timestamp: string;
  isSlowQuery: boolean;
  metadata?: Record<string, unknown>;
}

// Threshold for slow queries (in milliseconds)
const SLOW_QUERY_THRESHOLD = 1000; // 1 second

// In-memory storage for performance logs (last 500 entries)
const MAX_LOGS = 500;
let performanceLogs: PerformanceLog[] = [];

/**
 * Generate a unique ID for the log entry
 */
function generateLogId(): string {
  return `perf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a performance log entry
 */
export function logPerformance(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  metadata?: Record<string, unknown>
): PerformanceLog {
  const log: PerformanceLog = {
    id: generateLogId(),
    endpoint,
    method,
    duration,
    statusCode,
    timestamp: new Date().toISOString(),
    isSlowQuery: duration >= SLOW_QUERY_THRESHOLD,
    metadata,
  };

  // Add to beginning of array (newest first)
  performanceLogs.unshift(log);

  // Trim array if it exceeds max size
  if (performanceLogs.length > MAX_LOGS) {
    performanceLogs = performanceLogs.slice(0, MAX_LOGS);
  }

  // Log slow queries to console for immediate visibility
  if (log.isSlowQuery) {
    console.warn(
      `[SLOW QUERY] ${method} ${endpoint} took ${duration}ms (status: ${statusCode})`
    );
  }

  return log;
}

/**
 * Get all performance logs
 */
export function getPerformanceLogs(): PerformanceLog[] {
  return performanceLogs;
}

/**
 * Get only slow query logs
 */
export function getSlowQueryLogs(): PerformanceLog[] {
  return performanceLogs.filter((log) => log.isSlowQuery);
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): {
  totalRequests: number;
  slowQueries: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  slowQueryPercentage: number;
  byEndpoint: Record<string, { count: number; avgDuration: number; slowCount: number }>;
  byStatusCode: Record<number, number>;
} {
  if (performanceLogs.length === 0) {
    return {
      totalRequests: 0,
      slowQueries: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      slowQueryPercentage: 0,
      byEndpoint: {},
      byStatusCode: {},
    };
  }

  const durations = performanceLogs.map((log) => log.duration);
  const slowQueries = performanceLogs.filter((log) => log.isSlowQuery);

  // Group by endpoint
  const byEndpoint: Record<string, { count: number; totalDuration: number; slowCount: number }> = {};
  performanceLogs.forEach((log) => {
    if (!byEndpoint[log.endpoint]) {
      byEndpoint[log.endpoint] = { count: 0, totalDuration: 0, slowCount: 0 };
    }
    byEndpoint[log.endpoint].count++;
    byEndpoint[log.endpoint].totalDuration += log.duration;
    if (log.isSlowQuery) {
      byEndpoint[log.endpoint].slowCount++;
    }
  });

  // Convert to averages
  const byEndpointStats: Record<string, { count: number; avgDuration: number; slowCount: number }> = {};
  Object.entries(byEndpoint).forEach(([endpoint, data]) => {
    byEndpointStats[endpoint] = {
      count: data.count,
      avgDuration: Math.round(data.totalDuration / data.count),
      slowCount: data.slowCount,
    };
  });

  // Group by status code
  const byStatusCode: Record<number, number> = {};
  performanceLogs.forEach((log) => {
    byStatusCode[log.statusCode] = (byStatusCode[log.statusCode] || 0) + 1;
  });

  return {
    totalRequests: performanceLogs.length,
    slowQueries: slowQueries.length,
    averageResponseTime: Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    ),
    maxResponseTime: Math.max(...durations),
    minResponseTime: Math.min(...durations),
    slowQueryPercentage: Math.round((slowQueries.length / performanceLogs.length) * 100),
    byEndpoint: byEndpointStats,
    byStatusCode,
  };
}

/**
 * Clear all performance logs
 */
export function clearPerformanceLogs(): void {
  performanceLogs = [];
}

/**
 * Get the slow query threshold
 */
export function getSlowQueryThreshold(): number {
  return SLOW_QUERY_THRESHOLD;
}

/**
 * Higher-order function to wrap API handlers with performance logging
 */
export function withPerformanceLogging<T>(
  endpoint: string,
  method: string,
  handler: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  return handler()
    .then((result) => {
      const duration = Date.now() - startTime;
      // Try to extract status code from result if it's a Response-like object
      const statusCode = (result as { status?: number })?.status || 200;
      logPerformance(endpoint, method, duration, statusCode, metadata);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logPerformance(endpoint, method, duration, 500, { ...metadata, error: String(error) });
      throw error;
    });
}
