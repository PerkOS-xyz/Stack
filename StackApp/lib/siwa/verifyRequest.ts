import { nextjsToFetchRequest, verifyAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";
import { verifyReceipt } from "@buildersgarden/siwa/receipt";
import { getSiwaReceiptSecret } from "./config";
import { resolveSiwaNetworkByChainId } from "./network";
import { getErc8128NonceStore } from "./stores";

export async function verifyStackSiwaRequest(request: Request) {
  const secret = getSiwaReceiptSecret();
  const receiptToken = request.headers.get("x-siwa-receipt");
  if (!receiptToken) return { valid: false as const, error: "Missing X-SIWA-Receipt header" };

  const receipt = verifyReceipt(receiptToken, secret);
  if (!receipt) return { valid: false as const, error: "Invalid or expired SIWA receipt" };

  const resolved = resolveSiwaNetworkByChainId(receipt.chainId);
  if (receipt.agentRegistry.toLowerCase() !== resolved.agentRegistry.toLowerCase()) {
    return { valid: false as const, error: "Receipt registry is not canonical for its chain" };
  }

  return verifyAuthenticatedRequest(nextjsToFetchRequest(request), {
    receiptSecret: secret,
    verifyOnchain: true,
    publicClient: resolved.client,
    nonceStore: getErc8128NonceStore(),
  });
}
