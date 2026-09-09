/**
 * Stack's paid API (x402): the product catalog and the pure pieces of the
 * 402 handshake. No Next, no database, no network here, so tests can drive
 * the whole protocol surface with fixtures.
 *
 * Money model: every product is priced in USD and paid in a stablecoin on one
 * of the offered networks through the x402 "exact" scheme (EIP-3009). Stack
 * is its own facilitator: verify and settle run in-process, and the sponsor
 * wallet matched by the `stack.perkos.xyz` domain rule pays the gas.
 *
 * Both x402 versions are spoken. V2 carries requirements in the
 * PAYMENT-REQUIRED header and the payment in PAYMENT-SIGNATURE; V1 carries
 * requirements in the body and the payment in X-PAYMENT. A client that only
 * reads one of them still finds a way to pay.
 */

export interface PaidProduct {
  id: string;
  /** Path template; `{address}`-style placeholders are documentation only. */
  path: string;
  method: "GET";
  priceUsd: number;
  title: string;
  description: string;
  mimeType: string;
  /** What the caller must supply; missing inputs are refused before any settlement. */
  inputs: string[];
}

export const PRODUCTS: Record<string, PaidProduct> = {
  "agent-report": {
    id: "agent-report",
    path: "/api/v1",
    method: "GET",
    priceUsd: 0.01,
    title: "ERC-8004 agent report",
    description:
      "One call, one agent: ERC-8004 identity (owner, agentURI, metadata), reputation summary, validation summary and 8004scan indexing status. Query: chainId, agentId.",
    mimeType: "application/json",
    inputs: ["chainId", "agentId"],
  },
  "payer-trust": {
    id: "payer-trust",
    path: "/api/v1/wallets/{address}/trust",
    method: "GET",
    priceUsd: 0.01,
    title: "x402 payer trust profile",
    description:
      "What Stack has seen from a paying wallet: settlements, success rate, volume, networks, first and last seen, distinct recipients, plus ERC-8004 identities it owns on Base. Path: address.",
    mimeType: "application/json",
    inputs: ["address"],
  },
};

/** A network a product can be paid on. Filled in by the server from config. */
export interface OfferNetwork {
  /** Stack network key, e.g. "base" */
  key: string;
  /** CAIP-2, e.g. "eip155:8453" */
  caip2: string;
  /** Stablecoin contract */
  asset: string;
  /** EIP-712 domain of the token (what the payer signs against) */
  tokenName: string;
  tokenVersion: string;
  decimals: number;
  testnet: boolean;
}

export const PAYMENT_TIMEOUT_SECONDS = 300;

export const V2_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const V2_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
export const V2_RESPONSE_HEADER = "PAYMENT-RESPONSE";
export const V1_PAYMENT_HEADER = "X-PAYMENT";

/** USD price → token base units (6-decimal stablecoins). */
export function priceUnits(priceUsd: number, decimals = 6): string {
  return BigInt(Math.round(priceUsd * 10 ** decimals)).toString();
}

export interface OfferV2 {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resource: { url: string; description: string; mimeType: string };
  extra: { name: string; version: string };
}

export interface OfferV1 {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: { name: string; version: string };
}

/** The V2 requirements for a product at a concrete URL, one per network. */
export function offersV2(product: PaidProduct, resourceUrl: string, payTo: string, networks: OfferNetwork[]): OfferV2[] {
  return networks.map((n) => ({
    scheme: "exact",
    network: n.caip2,
    amount: priceUnits(product.priceUsd, n.decimals),
    asset: n.asset,
    payTo,
    maxTimeoutSeconds: PAYMENT_TIMEOUT_SECONDS,
    resource: { url: resourceUrl, description: product.description, mimeType: product.mimeType },
    extra: { name: n.tokenName, version: n.tokenVersion },
  }));
}

/** The same offers in V1 shape (string resource, maxAmountRequired, legacy network key). */
export function offersV1(product: PaidProduct, resourceUrl: string, payTo: string, networks: OfferNetwork[]): OfferV1[] {
  return networks.map((n) => ({
    scheme: "exact",
    network: n.key,
    maxAmountRequired: priceUnits(product.priceUsd, n.decimals),
    resource: resourceUrl,
    description: product.description,
    mimeType: product.mimeType,
    payTo,
    maxTimeoutSeconds: PAYMENT_TIMEOUT_SECONDS,
    asset: n.asset,
    extra: { name: n.tokenName, version: n.tokenVersion },
  }));
}

/** Base64 PaymentRequired document for the PAYMENT-REQUIRED header (x402 v2). */
export function encodePaymentRequired(product: PaidProduct, resourceUrl: string, accepts: OfferV2[]): string {
  const doc = {
    x402Version: 2,
    resource: { url: resourceUrl, description: product.description, mimeType: product.mimeType },
    accepts,
  };
  return Buffer.from(JSON.stringify(doc)).toString("base64");
}

/** The V1 402 body: the same offers, plus the catalog so an agent learns what else is for sale. */
export function paymentRequiredBody(product: PaidProduct, accepts: OfferV1[], reason?: string) {
  return {
    x402Version: 1,
    error: reason ?? "Payment required",
    accepts,
    product: { id: product.id, title: product.title, price: `$${product.priceUsd}`, inputs: product.inputs },
    catalog: catalog(),
  };
}

export function catalog() {
  return Object.values(PRODUCTS).map((p) => ({ id: p.id, path: p.path, method: p.method, price: `$${p.priceUsd}`, title: p.title, description: p.description, inputs: p.inputs }));
}

/** Read the payment from either version's header. */
export function readPaymentHeader(get: (name: string) => string | null | undefined): string | null {
  return get(V1_PAYMENT_HEADER) ?? get(V1_PAYMENT_HEADER.toLowerCase()) ?? get(V2_SIGNATURE_HEADER) ?? get(V2_SIGNATURE_HEADER.toLowerCase()) ?? null;
}

/** Decode a base64 (or raw JSON) payment header into the x402 paymentPayload. */
export function decodePaymentHeader(header: string | null): Record<string, unknown> | null {
  if (!header || !header.trim()) return null;
  const raw = header.trim();
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export interface MatchedRequest {
  x402Version: 1 | 2;
  paymentPayload: Record<string, unknown>;
  paymentRequirements: OfferV1 | OfferV2;
  network: string;
}

/**
 * Pair a decoded payment with the offer it pays for. V2 payments name the
 * requirement they accepted; V1 payments name a network. Anything that does
 * not point at one of our offers is refused before touching the facilitator.
 */
export function matchPayment(decoded: Record<string, unknown>, v2: OfferV2[], v1: OfferV1[], networks: OfferNetwork[]): MatchedRequest | { error: string } {
  const version = Number(decoded.x402Version);
  if (version === 2) {
    const accepted = decoded.accepted as { network?: string; amount?: string } | undefined;
    const offer = v2.find((o) => o.network === accepted?.network);
    if (!offer) return { error: "accepted.network is not one of the offered networks" };
    if (accepted?.amount !== undefined && accepted.amount !== offer.amount) return { error: "accepted.amount does not match the offer" };
    return { x402Version: 2, paymentPayload: decoded, paymentRequirements: offer, network: offer.network };
  }
  if (version === 1) {
    const network = String(decoded.network ?? "");
    const n = networks.find((x) => x.key === network || x.caip2 === network);
    const offer = n ? v1.find((o) => o.network === n.key) : undefined;
    if (!offer) return { error: "payload.network is not one of the offered networks" };
    return { x402Version: 1, paymentPayload: decoded, paymentRequirements: offer, network: offer.network };
  }
  return { error: "x402Version must be 1 or 2" };
}

/** Base64 PAYMENT-RESPONSE header after settlement. */
export function encodePaymentResponse(result: { success: boolean; transaction?: string | null; network: string; payer?: string | null; errorReason?: string | null }): string {
  return Buffer.from(JSON.stringify({
    success: result.success,
    ...(result.errorReason ? { errorReason: result.errorReason } : {}),
    ...(result.payer ? { payer: result.payer } : {}),
    transaction: result.transaction || "",
    network: result.network,
  })).toString("base64");
}
