/**
 * Message an agent wallet signs to rotate its API key.
 * Timestamp-bound so a signature cannot be replayed outside the window.
 */
export const ROTATION_WINDOW_MS = 5 * 60 * 1000;

export function buildRotationMessage(walletAddress: string, timestamp: number): string {
  return [
    "Rotate PerkOS Stack Agent API key",
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");
}
