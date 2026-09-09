/**
 * MPP (Machine Payments Protocol): the same paid products, payable by card.
 *
 * Stack sells over x402 for callers holding stablecoins. An agent holding a
 * card could not buy at all. MPP is the same sale over card rails, and the
 * protocol describes exactly this: several offers on one operation are
 * "alternative ways to access the same operation". The products do not
 * change; the set of callers who can pay does.
 *
 * Refuses to advertise MPP unless it can charge: it needs the Stripe secret
 * key and a secret for the HMAC-bound challenge ids. Without either, the
 * gate is null and the routes quote x402 only. A challenge nothing can settle
 * would walk an agent through a payment that ends nowhere.
 */
import type { PaidProduct } from "./paidApi";

export const MPP_REALM = "stack.perkos.xyz";

function stripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function challengeSecret(): string {
  return process.env.MPP_SECRET_KEY?.trim() ?? "";
}

export function mppConfigured(): boolean {
  return stripeSecretKey().length > 0 && challengeSecret().length >= 32;
}

/** USD price → minor units (cents), the shape MPP and Stripe use. */
export function minorUnits(priceUsd: number): string {
  return String(Math.round(priceUsd * 100));
}

/** The MPP offer for a product, in the shape the OpenAPI x-payment-info publishes. */
export function mppOffer(product: PaidProduct) {
  return {
    intent: "charge" as const,
    method: "stripe" as const,
    amount: minorUnits(product.priceUsd),
    currency: "usd",
    description: `${product.title}, paid by card over MPP.`,
  };
}

type RouteHandler = (request: Request) => Promise<Response> | Response;

const gates = new Map<string, (handler: RouteHandler) => RouteHandler>();

/**
 * The gate for one product: wraps a route handler so a request without a
 * valid MPP credential gets a 402 challenge (WWW-Authenticate: Payment …) and
 * a request with one is charged on Stripe before the handler runs. Null when
 * MPP is not configured.
 */
export async function mppGate(product: PaidProduct): Promise<((handler: RouteHandler) => RouteHandler) | null> {
  if (!mppConfigured()) return null;
  const cached = gates.get(product.id);
  if (cached) return cached;
  // Imported lazily: the SDK pulls in the Stripe client, and a deployment
  // without MPP should not pay that cost.
  const [{ Mppx }, { stripe }] = await Promise.all([import("mppx/nextjs"), import("mppx/server")]);
  const charge = stripe.charge({
    secretKey: stripeSecretKey(),
    networkId: "internal",
    paymentMethodTypes: ["card"],
  });
  const mppx = Mppx.create({ methods: [charge], realm: MPP_REALM, secretKey: challengeSecret() });
  const offer = mppOffer(product);
  const gate = mppx.charge({ amount: offer.amount, currency: offer.currency, decimals: 2, description: offer.description }) as unknown as (handler: RouteHandler) => RouteHandler;
  gates.set(product.id, gate);
  return gate;
}

/** Whether the caller is presenting an MPP credential (as opposed to nothing, or x402). */
export function offeringCard(req: Request): boolean {
  return (req.headers.get("authorization") ?? "").toLowerCase().startsWith("payment ");
}

/** Test seam. */
export function resetMppGates(): void {
  gates.clear();
}
