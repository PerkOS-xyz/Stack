/**
 * x402 V2 HTTP header utilities.
 *
 * Generic behavior is provided by @perkos/util-x402-headers. Chain-aware
 * helpers are local so newly supported networks are reflected in CAIP-2,
 * response headers, receipts, and explorer links immediately.
 */

import * as shared from "@perkos/util-x402-headers";
import {
  getBlockExplorerUrl,
  getChainIdFromNetwork,
  getNetworkFromChainId,
  type SupportedNetwork,
} from "./chains";

import type {
  VerifyHeadersParams,
  SettleHeadersParams,
  V2Receipt,
  CreateReceiptParams,
  PaymentRequirementsHeader,
} from "@perkos/util-x402-headers";

export type {
  VerifyHeadersParams,
  SettleHeadersParams,
  V2Receipt,
  CreateReceiptParams,
  PaymentRequirementsHeader,
} from "@perkos/util-x402-headers";

export const generateRequestId = shared.generateRequestId;
export const getBaseHeaders = shared.getBaseHeaders;

export function getChainId(network: string): number | null {
  const caip2Match = /^eip155:(\d+)$/.exec(network);
  if (caip2Match) return Number(caip2Match[1]);
  return getChainIdFromNetwork(network) ?? shared.getChainId(network);
}

export function networkToCAIP2(network: string): string | null {
  const chainId = getChainId(network);
  return chainId ? `eip155:${chainId}` : null;
}

export function caip2ToNetwork(caip2: string): SupportedNetwork | null {
  const match = /^eip155:(\d+)$/.exec(caip2);
  if (match) {
    const network = getNetworkFromChainId(Number(match[1]));
    if (network) return network as SupportedNetwork;
  }
  return shared.caip2ToNetwork(caip2) as SupportedNetwork | null;
}

export function getBlockExplorerTxUrl(network: string, txHash: string): string | null {
  const chainId = getChainId(network);
  if (!chainId) return shared.getBlockExplorerTxUrl(network, txHash);
  const explorer = getBlockExplorerUrl(chainId);
  return explorer ? `${explorer}/tx/${txHash}` : null;
}

export function getVerifyHeaders(params: VerifyHeadersParams): Record<string, string> {
  const chainId = getChainId(params.network);
  const headers: Record<string, string> = {
    ...getBaseHeaders(),
    "X-x402-Request-Id": params.requestId,
    "X-x402-Network": params.network,
    "X-x402-Scheme": params.scheme,
    "X-x402-Valid": params.isValid.toString(),
  };
  if (chainId) {
    headers["X-x402-Chain-Id"] = chainId.toString();
    headers["X-x402-CAIP2"] = `eip155:${chainId}`;
  }
  if (params.payer) headers["X-x402-Payer"] = params.payer;
  return headers;
}

export function getSettleHeaders(params: SettleHeadersParams): Record<string, string> {
  const chainId = getChainId(params.network);
  const headers: Record<string, string> = {
    ...getBaseHeaders(),
    "X-x402-Request-Id": params.requestId,
    "X-x402-Network": params.network,
    "X-x402-Scheme": params.scheme,
    "X-x402-Success": params.success.toString(),
  };
  if (chainId) {
    headers["X-x402-Chain-Id"] = chainId.toString();
    headers["X-x402-CAIP2"] = `eip155:${chainId}`;
  }
  if (params.payer) headers["X-x402-Payer"] = params.payer;
  if (params.transaction) headers["X-x402-Transaction"] = params.transaction;
  return headers;
}

export function createV2Receipt(params: CreateReceiptParams): V2Receipt {
  const chainId = getChainId(params.network);
  return {
    version: "2.0.0",
    requestId: params.requestId,
    timestamp: new Date().toISOString(),
    network: {
      name: params.network,
      chainId,
      caip2: chainId ? `eip155:${chainId}` : null,
    },
    payment: {
      scheme: params.scheme,
      payer: params.payer,
      ...(params.amount && { amount: params.amount }),
      ...(params.asset && { asset: params.asset }),
    },
    settlement: {
      success: params.success,
      transaction: params.transaction,
      blockExplorer: params.transaction
        ? getBlockExplorerTxUrl(params.network, params.transaction)
        : null,
    },
  };
}

export function buildWWWAuthenticateHeader(requirements: PaymentRequirementsHeader): string {
  const caip2 = networkToCAIP2(requirements.network) || requirements.network;
  const parts = [
    `x402 scheme="${requirements.scheme}"`,
    `network="${caip2}"`,
    `maxAmountRequired="${requirements.maxAmountRequired}"`,
    `resource="${requirements.resource}"`,
    `payTo="${requirements.payTo}"`,
    `asset="${requirements.asset}"`,
  ];
  if (requirements.description) parts.push(`description="${requirements.description}"`);
  if (requirements.mimeType) parts.push(`mimeType="${requirements.mimeType}"`);
  if (requirements.outputSchema) parts.push(`outputSchema="${requirements.outputSchema}"`);
  return parts.join(", ");
}

export function parseWWWAuthenticateHeader(
  header: string
): PaymentRequirementsHeader | null {
  const parsed = shared.parseWWWAuthenticateHeader(header);
  if (!parsed) return null;
  parsed.network = caip2ToNetwork(parsed.network) || parsed.network;
  return parsed;
}
