const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_RECEIPT_TTL_MS = 30 * 60 * 1000;

function boundedPositiveInt(value: string | undefined, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}

export function getSiwaReceiptSecret(): string {
  const secret = process.env.SIWA_RECEIPT_SECRET || process.env.SIWA_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SIWA_RECEIPT_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function getSiwaNonceTtlMs(): number {
  return boundedPositiveInt(process.env.SIWA_NONCE_TTL_MS, DEFAULT_NONCE_TTL_MS, 15 * 60 * 1000);
}

export function getSiwaReceiptTtlMs(): number {
  return boundedPositiveInt(process.env.SIWA_RECEIPT_TTL_MS, DEFAULT_RECEIPT_TTL_MS, 24 * 60 * 60 * 1000);
}

export function getSiwaPublicOrigin(request: Request): string {
  const configured = process.env.SIWA_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) return `${forwardedProto || "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export function getSiwaDomain(request: Request): string {
  return process.env.SIWA_DOMAIN || new URL(getSiwaPublicOrigin(request)).host;
}

export function getSiwaVerifyUri(request: Request): string {
  return `${getSiwaPublicOrigin(request)}/api/v2/agents/siwa/verify`;
}
