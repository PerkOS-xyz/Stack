import { getAdminFirestoreDb } from "../db/firebase";
import { logger } from "../utils/logger";
import type { StellarTransaction } from "../types/stellar";

const COLLECTION = "stellarTransactions";

export class StellarTransactionService {
  async log(
    tx: Omit<StellarTransaction, "id" | "createdAt">,
  ): Promise<StellarTransaction> {
    const db = getAdminFirestoreDb();
    const record = { ...tx, createdAt: Date.now() };
    const docRef = await db.collection(COLLECTION).add(record);

    logger.info("Stellar transaction logged", {
      id: docRef.id,
      type: tx.type,
      amount: tx.amount,
      asset: tx.asset,
    });

    return { id: docRef.id, ...record };
  }

  async getByWallet(
    walletId: string,
    limitCount = 50,
  ): Promise<StellarTransaction[]> {
    const db = getAdminFirestoreDb();
    const snapshot = await db
      .collection(COLLECTION)
      .where("walletId", "==", walletId)
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    })) as StellarTransaction[];
  }

  async getByUser(
    userId: string,
    limitCount = 50,
  ): Promise<StellarTransaction[]> {
    const db = getAdminFirestoreDb();
    const snapshot = await db
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    })) as StellarTransaction[];
  }

  async updateStatus(
    txId: string,
    status: StellarTransaction["status"],
    stellarTxHash?: string,
  ): Promise<void> {
    const db = getAdminFirestoreDb();
    const update: Record<string, unknown> = { status };
    if (stellarTxHash) update.stellarTxHash = stellarTxHash;
    await db.collection(COLLECTION).doc(txId).update(update);
  }
}
