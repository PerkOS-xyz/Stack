export interface SponsorRuleCandidate {
  id?: string;
  sponsor_wallet_id: string;
  agent_address?: string | null;
  priority?: number | null;
  created_at?: unknown;
}

function createdAtMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") return toMillis.call(value);
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Select one deterministic agent rule across normalized and historical checksum records.
 * Highest priority wins; ties prefer the oldest rule, then stable document/wallet IDs.
 */
export function selectSponsorRule(
  rules: readonly SponsorRuleCandidate[],
  address: string,
): SponsorRuleCandidate | undefined {
  const normalizedAddress = address.trim().toLowerCase();
  return rules
    .filter((rule) => rule.agent_address?.trim().toLowerCase() === normalizedAddress)
    .sort((left, right) => {
      const priority = (right.priority || 0) - (left.priority || 0);
      if (priority !== 0) return priority;
      const created = createdAtMillis(left.created_at) - createdAtMillis(right.created_at);
      if (created !== 0) return created;
      return `${left.id || ""}:${left.sponsor_wallet_id}`.localeCompare(
        `${right.id || ""}:${right.sponsor_wallet_id}`,
      );
    })[0];
}
