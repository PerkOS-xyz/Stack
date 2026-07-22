export interface DynamicNetworkOption {
  chainId: number;
}

export const MANUALLY_CONFIGURED_DYNAMIC_CHAIN_IDS = new Set([
  8453, 84532, 1, 11155111, 143, 10143, 4663, 46630, 137, 80002,
  42161, 421614, 10, 11155420, 43114, 43113, 42220, 11142220,
]);

/** Keep only catalog networks not already configured manually, deduplicated by chain ID. */
export function selectAdditionalDynamicNetworkOptions<T extends DynamicNetworkOption>(
  options: readonly T[],
  manuallyConfiguredChainIds: ReadonlySet<number>,
): T[] {
  const seen = new Set(manuallyConfiguredChainIds);
  return options.filter((option) => {
    if (seen.has(option.chainId)) return false;
    seen.add(option.chainId);
    return true;
  });
}
