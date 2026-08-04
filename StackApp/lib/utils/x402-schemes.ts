/**
 * x402 payment scheme identifiers.
 *
 * The x402 v2 specification standardizes exactly one scheme: `exact`. Other
 * behaviours (`upto`, `deferred`, batch settlement) are proposed but not
 * ratified, and the scheme namespace is now governed by the x402 Foundation's
 * Technical Steering Committee under the Linux Foundation.
 *
 * Stack's aggregated-voucher settlement therefore advertises the
 * vendor-prefixed identifier `perkos-deferred`. The bare `deferred` string is
 * still ACCEPTED on input so existing clients keep working, but it is no longer
 * advertised. If the TSC later standardizes `deferred` with different
 * semantics, Stack will not be squatting the name.
 *
 * See STACK-PROTOCOL-RESEARCH-2026-07-29.md §1.3.
 */

/** Canonical scheme identifiers Stack advertises. */
export const SCHEME_EXACT = "exact" as const;
export const SCHEME_DEFERRED = "perkos-deferred" as const;

/** Legacy identifier, accepted on input but never advertised. */
export const SCHEME_DEFERRED_LEGACY = "deferred" as const;

export type CanonicalScheme = typeof SCHEME_EXACT | typeof SCHEME_DEFERRED;

/**
 * Map any accepted scheme identifier onto its canonical form.
 *
 * Returns `null` for unknown schemes so callers can fail closed rather than
 * silently routing an unrecognized scheme to a default handler.
 */
export function canonicalizeScheme(scheme: unknown): CanonicalScheme | null {
  if (scheme === SCHEME_EXACT) return SCHEME_EXACT;
  if (scheme === SCHEME_DEFERRED || scheme === SCHEME_DEFERRED_LEGACY) {
    return SCHEME_DEFERRED;
  }
  return null;
}

/** True when the caller used the deprecated bare `deferred` identifier. */
export function isLegacyDeferred(scheme: unknown): boolean {
  return scheme === SCHEME_DEFERRED_LEGACY;
}

/**
 * Deprecation notice surfaced on responses that accepted the legacy name, so
 * integrators discover the rename without reading a changelog.
 */
export const LEGACY_DEFERRED_DEPRECATION =
  `scheme "${SCHEME_DEFERRED_LEGACY}" is deprecated and will stop being accepted; ` +
  `use "${SCHEME_DEFERRED}" instead`;

/** Header used to carry the deprecation notice. */
export const DEPRECATION_HEADER = "X-x402-Deprecation";

/**
 * Every stored identifier that belongs to the same scheme family.
 *
 * Transactions written before the rename carry `deferred`; new ones carry
 * `perkos-deferred`. A query that matches only one of them silently drops
 * history, so filters must match the whole family.
 */
export function schemeFilterValues(scheme: string): string[] {
  if (scheme === SCHEME_DEFERRED || scheme === SCHEME_DEFERRED_LEGACY) {
    return [SCHEME_DEFERRED, SCHEME_DEFERRED_LEGACY];
  }
  return [scheme];
}

/**
 * Stack's `/supported` shape.
 *
 * Deliberately not `SupportedResponse` from `@perkos/types-x402@1.1.1`, whose
 * `scheme` is still typed `"exact" | "deferred"` and predates this rename.
 * Widen here rather than block on republishing that package.
 */
export interface StackSupportedKind {
  scheme: CanonicalScheme;
  network: string;
}

export interface StackSupportedResponse {
  kinds: StackSupportedKind[];
}
