/**
 * Plan payments claimed by transaction hash (POST /api/subscription/pay).
 *
 * A transfer pays for a plan once. The used-hash record and the subscription
 * are written in one Firestore transaction, so a second claim of the same
 * transfer finds the record and grants nothing.
 */
import type { Firestore } from "firebase-admin/firestore";
import type { SubscriptionTier } from "../config/subscriptions.ts";
import type { UserSubscription } from "./SubscriptionService.ts";

export const SUBSCRIPTION_PAYMENTS_COLLECTION = "perkos_subscription_payments";
const SUBSCRIPTIONS_COLLECTION = "perkos_subscriptions";

export interface PlanPaymentClaim {
  chainId: number;
  network: string;
  transactionHash: string;
  userWalletAddress: string;
  tier: SubscriptionTier;
  billingCycle: string;
  /** Amount received, in token units (for the record only). */
  amount: string;
  expiresAt: Date;
}

/** One record per chain and transaction hash. */
export function subscriptionPaymentId(chainId: number, transactionHash: string): string {
  return `${chainId}_${transactionHash.toLowerCase()}`;
}

/**
 * Grants the plan a transfer paid for and records its hash as used.
 * Returns null, and writes nothing, when the hash already paid for a plan.
 */
export async function grantPlanForPayment(
  db: Firestore,
  claim: PlanPaymentClaim,
  now: Date = new Date()
): Promise<UserSubscription | null> {
  const address = claim.userWalletAddress.toLowerCase();
  const paymentRef = db
    .collection(SUBSCRIPTION_PAYMENTS_COLLECTION)
    .doc(subscriptionPaymentId(claim.chainId, claim.transactionHash));
  const subscriptions = db.collection(SUBSCRIPTIONS_COLLECTION);

  return db.runTransaction(async (transaction) => {
    const used = await transaction.get(paymentRef);
    if (used.exists) return null;

    // Same lookup as SubscriptionService.getAnySubscription: one record per wallet.
    const found = await transaction.get(
      subscriptions.where("user_wallet_address", "==", address).limit(1)
    );
    const existing = found.docs[0];
    const previous = existing?.data() as Partial<UserSubscription> | undefined;
    const subscriptionRef = existing ? existing.ref : subscriptions.doc();

    const fields = {
      user_wallet_address: address,
      tier: claim.tier,
      status: "active" as const,
      started_at: now.toISOString(),
      expires_at: claim.expiresAt.toISOString(),
      trial_ends_at: null,
      cancelled_at: null,
      stripe_customer_id: previous?.stripe_customer_id ?? null,
      stripe_subscription_id: previous?.stripe_subscription_id ?? null,
    };

    if (existing) {
      transaction.update(subscriptionRef, { ...fields, updated_at: now });
    } else {
      transaction.set(subscriptionRef, { ...fields, created_at: now.toISOString(), updated_at: now });
    }
    transaction.create(paymentRef, {
      transaction_hash: claim.transactionHash.toLowerCase(),
      chain_id: claim.chainId,
      network: claim.network,
      user_wallet_address: address,
      tier: claim.tier,
      billing_cycle: claim.billingCycle,
      amount: claim.amount,
      subscription_id: subscriptionRef.id,
      created_at: now.toISOString(),
    });

    return {
      ...previous,
      ...fields,
      id: subscriptionRef.id,
      created_at: previous?.created_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    };
  });
}
