import type { X402SettleRequest, X402VerifyRequest } from "../types/x402";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

/**
 * Normalize the canonical x402 v2 payload (`accepted`) into Stack's internal
 * scheme envelope. V1 and the pre-standard flat v2 shape remain accepted as a
 * migration bridge for existing PerkOS clients.
 */
export function normalizeX402Request(
  request: unknown
): X402VerifyRequest | X402SettleRequest {
  if (!isRecord(request) || !isRecord(request.paymentPayload) || !isRecord(request.paymentRequirements)) {
    throw new Error("Invalid x402 request envelope");
  }

  const x402Version = Number(request.x402Version);
  const paymentPayload = request.paymentPayload;
  const paymentRequirements = request.paymentRequirements;

  if (x402Version === 2 && isRecord(paymentPayload.accepted)) {
    const accepted = paymentPayload.accepted;
    const fields = [
      "scheme",
      "network",
      "amount",
      "asset",
      "payTo",
      "maxTimeoutSeconds",
      "extra",
    ] as const;

    for (const field of fields) {
      if (!sameValue(accepted[field], paymentRequirements[field])) {
        throw new Error(`paymentPayload.accepted.${field} does not match paymentRequirements.${field}`);
      }
    }

    const resource = isRecord(paymentPayload.resource)
      ? paymentPayload.resource
      : paymentRequirements.resource ?? "";

    return {
      x402Version: 2,
      paymentPayload: {
        x402Version: 2,
        scheme: accepted.scheme,
        network: accepted.network,
        payload: paymentPayload.payload,
        extensions: paymentPayload.extensions,
      },
      paymentRequirements: {
        ...paymentRequirements,
        scheme: accepted.scheme,
        network: accepted.network,
        amount: accepted.amount,
        asset: accepted.asset,
        payTo: accepted.payTo,
        maxTimeoutSeconds: accepted.maxTimeoutSeconds,
        extra: accepted.extra,
        resource,
      },
    } as unknown as X402VerifyRequest;
  }

  return request as unknown as X402VerifyRequest;
}
