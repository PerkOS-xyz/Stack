/**
 * Address Display Component with ENS Support
 * Displays Ethereum addresses with optional ENS name resolution
 */

'use client';

import { type Address } from 'viem';
import { useEnsName } from '@/lib/hooks/useEnsName';
import { formatAddressDisplay } from '@/lib/utils/ens';

interface AddressDisplayProps {
  address: Address;
  showFullAddress?: boolean;
  className?: string;
  skipEns?: boolean;
}

export function AddressDisplay({
  address,
  showFullAddress = false,
  className = '',
  skipEns = false
}: AddressDisplayProps) {
  const { ensName, isLoading } = useEnsName(skipEns ? undefined : address);

  if (isLoading && !skipEns) {
    return (
      <span className={`font-mono text-pink-400 ${className}`}>
        Loading...
      </span>
    );
  }

  const displayText = showFullAddress && !ensName
    ? address
    : formatAddressDisplay(address, skipEns ? null : ensName);

  return (
    <span className={`font-mono text-pink-400 ${className}`} title={address}>
      {displayText}
    </span>
  );
}
