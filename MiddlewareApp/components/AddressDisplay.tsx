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
}

export function AddressDisplay({
  address,
  showFullAddress = false,
  className = ''
}: AddressDisplayProps) {
  const { ensName, isLoading } = useEnsName(address);

  if (isLoading) {
    return (
      <span className={`font-mono text-cyan-400 ${className}`}>
        Loading...
      </span>
    );
  }

  const displayText = showFullAddress && !ensName
    ? address
    : formatAddressDisplay(address, ensName);

  return (
    <span className={`font-mono text-cyan-400 ${className}`} title={address}>
      {displayText}
    </span>
  );
}
