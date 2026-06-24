import type { WalletClient, Account } from "viem";

/**
 * Builds the EIP-191 ownership-proof headers required by the authenticated
 * sponsor-wallet endpoints (send, solana-send, and create/update/delete).
 *
 * The connected EVM wallet signs "PerkOS Sponsor Wallet Access {timestamp}".
 * The server (`verifyWalletSignature`) checks the signature + 5-minute freshness
 * and that the signer owns the wallet's `user_wallet_address`.
 *
 * Throws if there is no connected wallet or no available signing method — callers
 * should surface that to the user and abort the request.
 */
export async function buildSponsorWalletAuthHeaders(params: {
  address: string | undefined;
  walletClient: WalletClient | null;
  walletAccount: Account | null;
}): Promise<Record<string, string>> {
  const { address, walletClient, walletAccount } = params;

  if (!address) {
    throw new Error("No connected wallet");
  }

  const timestamp = Date.now().toString();
  const message = `PerkOS Sponsor Wallet Access ${timestamp}`;

  let signature: string;
  if (walletAccount?.signMessage) {
    // Para SDK provides an account object with signMessage
    signature = await walletAccount.signMessage({ message });
  } else if (walletClient) {
    // Dynamic or external wallets sign via the viem wallet client
    signature = await walletClient.signMessage({
      account: address as `0x${string}`,
      message,
    });
  } else {
    throw new Error("No signing method available");
  }

  return {
    "X-Wallet-Address": address,
    "X-Wallet-Timestamp": timestamp,
    "X-Wallet-Signature": signature,
  };
}
