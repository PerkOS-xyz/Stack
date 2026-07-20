import { verifyMessage } from 'viem';

/**
 * Verifies that a request is signed by the holder of a wallet address using
 * EIP-191 signature verification.
 *
 * Requires X-Wallet-Signature, X-Wallet-Timestamp, and X-Wallet-Address headers.
 * The signed message must be "PerkOS Sponsor Wallet Access {timestamp}".
 *
 * This proves the caller controls the address in the header. The caller (route)
 * MUST still authorize the action by checking that the returned `address`
 * matches the resource owner (e.g. a sponsor wallet's `user_wallet_address`).
 *
 * Mirrors the EIP-191 pattern in `adminAuth.ts`.
 */
export async function verifyWalletSignature(request: Request, purpose?: string): Promise<{
  authorized: boolean;
  address?: string;
  error?: string;
}> {
  const signature = request.headers.get('X-Wallet-Signature');
  const timestamp = request.headers.get('X-Wallet-Timestamp');
  const address = request.headers.get('X-Wallet-Address');

  if (!signature || !timestamp || !address) {
    return {
      authorized: false,
      error: 'Missing auth headers: X-Wallet-Signature, X-Wallet-Timestamp, X-Wallet-Address',
    };
  }

  // Reject if timestamp is older than 5 minutes (replay protection)
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    return { authorized: false, error: 'Timestamp expired or invalid' };
  }

  // Purpose-bound messages prevent a signature collected for one operation
  // from authorizing a different route. Existing sponsor UI keeps the legacy
  // message when no purpose is supplied.
  const message = purpose
    ? `PerkOS ${purpose} ${timestamp}`
    : `PerkOS Sponsor Wallet Access ${timestamp}`;
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return { authorized: false, error: 'Invalid signature' };
    }
  } catch {
    return { authorized: false, error: 'Signature verification failed' };
  }

  return { authorized: true, address: address.toLowerCase() };
}
