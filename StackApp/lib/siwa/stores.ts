import { createMemorySIWANonceStore, type SIWANonceStore } from "@buildersgarden/siwa/nonce-store";
import { getAdminFirestoreDb } from "@/lib/db/firebase";

interface Erc8128NonceStore {
  consume(key: string, ttlSeconds: number): Promise<boolean>;
}

const SIWA_NONCE_COLLECTION = "perkos_siwa_nonces";
const ERC8128_NONCE_COLLECTION = "perkos_erc8128_nonces";

class FirestoreSiwaNonceStore implements SIWANonceStore {
  async issue(nonce: string, ttlMs: number): Promise<boolean> {
    const db = getAdminFirestoreDb();
    const ref = db.collection(SIWA_NONCE_COLLECTION).doc(nonce);
    const now = Date.now();
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists && Number(existing.data()?.expiresAt || 0) > now) return false;
      transaction.set(ref, { createdAt: now, expiresAt: now + ttlMs });
      return true;
    });
  }

  async consume(nonce: string): Promise<boolean> {
    const db = getAdminFirestoreDb();
    const ref = db.collection(SIWA_NONCE_COLLECTION).doc(nonce);
    const now = Date.now();
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (!existing.exists) return false;
      transaction.delete(ref);
      return Number(existing.data()?.expiresAt || 0) >= now;
    });
  }
}

class FirestoreErc8128NonceStore implements Erc8128NonceStore {
  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const db = getAdminFirestoreDb();
    const ref = db.collection(ERC8128_NONCE_COLLECTION).doc(key);
    const now = Date.now();
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists && Number(existing.data()?.expiresAt || 0) > now) return false;
      transaction.set(ref, { createdAt: now, expiresAt: now + ttlSeconds * 1000 });
      return true;
    });
  }
}

class MemoryErc8128NonceStore implements Erc8128NonceStore {
  private readonly seen = new Map<string, number>();

  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    for (const [storedKey, expiresAt] of this.seen) {
      if (expiresAt < now) this.seen.delete(storedKey);
    }
    if (this.seen.has(key)) return false;
    this.seen.set(key, now + ttlSeconds * 1000);
    return true;
  }
}

const memorySiwaStore = createMemorySIWANonceStore();
const firestoreSiwaStore = new FirestoreSiwaNonceStore();
const memoryErc8128Store = new MemoryErc8128NonceStore();
const firestoreErc8128Store = new FirestoreErc8128NonceStore();

export function getSiwaNonceStore(): SIWANonceStore {
  return process.env.SIWA_NONCE_STORE === "memory" ? memorySiwaStore : firestoreSiwaStore;
}

export function getErc8128NonceStore(): Erc8128NonceStore {
  return process.env.SIWA_NONCE_STORE === "memory" ? memoryErc8128Store : firestoreErc8128Store;
}
