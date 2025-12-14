/**
 * ENS Utility Functions
 * Provides ENS name resolution for Ethereum addresses
 */

import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

// Create a public client for ENS lookups (always use Ethereum mainnet)
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

/**
 * Get ENS name for an Ethereum address (reverse lookup)
 * @param address - Ethereum address (0x...)
 * @returns ENS name or null if not found
 */
export async function getEnsName(address: Address): Promise<string | null> {
  try {
    const ensName = await publicClient.getEnsName({ address });
    return ensName;
  } catch (error) {
    console.error('Error fetching ENS name:', error);
    return null;
  }
}

/**
 * Get Ethereum address for an ENS name (forward lookup)
 * @param ensName - ENS name (e.g., vitalik.eth)
 * @returns Ethereum address or null if not found
 */
export async function getEnsAddress(ensName: string): Promise<Address | null> {
  try {
    const address = await publicClient.getEnsAddress({ name: ensName });
    return address;
  } catch (error) {
    console.error('Error fetching ENS address:', error);
    return null;
  }
}

/**
 * Format address for display - show ENS name if available, otherwise truncated address
 * @param address - Ethereum address
 * @param ensName - Optional ENS name (if already fetched)
 * @returns Formatted string for display
 */
export function formatAddressDisplay(
  address: Address,
  ensName?: string | null
): string {
  if (ensName) {
    return ensName;
  }
  // Truncate address: 0x1234...5678
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validate if a string is a valid ENS name
 * @param name - String to validate
 * @returns true if valid ENS name format
 */
export function isValidEnsName(name: string): boolean {
  // Basic ENS validation: must end with .eth and contain valid characters
  return /^[a-z0-9-]+\.eth$/i.test(name);
}
