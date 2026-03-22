import { verifyMessage } from 'viem';

const ADMIN_COLLECTION = 'admin_users';

/**
 * Verifies an admin request using EIP-191 signature verification.
 * Requires X-Admin-Signature, X-Admin-Timestamp, and X-Admin-Address headers.
 * The signed message must be "PerkOS Admin {timestamp}".
 */
export async function verifyAdminRequest(request: Request): Promise<{
  authorized: boolean;
  address?: string;
  error?: string;
}> {
  const signature = request.headers.get('X-Admin-Signature');
  const timestamp = request.headers.get('X-Admin-Timestamp');
  const address = request.headers.get('X-Admin-Address');

  if (!signature || !timestamp || !address) {
    return {
      authorized: false,
      error: 'Missing auth headers: X-Admin-Signature, X-Admin-Timestamp, X-Admin-Address',
    };
  }

  // Reject if timestamp is older than 5 minutes
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    return { authorized: false, error: 'Timestamp expired or invalid' };
  }

  // Verify EIP-191 signature: message format is "PerkOS Admin {timestamp}"
  const message = `PerkOS Admin ${timestamp}`;
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

  // Check if address is admin via Firestore
  try {
    const { firebaseAdmin } = await import('@/lib/db/firebase');
    const db = firebaseAdmin.firestore as FirebaseFirestore.Firestore;
    const adminDoc = await db.collection(ADMIN_COLLECTION).doc(address.toLowerCase()).get();
    if (adminDoc.exists) {
      return { authorized: true, address: address.toLowerCase() };
    }
  } catch {
    // Firestore check failed, fall through to env var check
  }

  // Fallback: check ADMIN_WALLETS env var
  const adminAddresses = (process.env.ADMIN_WALLETS || '')
    .toLowerCase()
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  if (!adminAddresses.includes(address.toLowerCase())) {
    return { authorized: false, error: 'Not an admin' };
  }

  return { authorized: true, address: address.toLowerCase() };
}
