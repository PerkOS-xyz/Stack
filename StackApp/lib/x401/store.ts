import type { X401ChallengeState, X401ChallengeStore } from "./types.ts";

const COLLECTION = "perkos_x401_challenges";

class MemoryX401ChallengeStore implements X401ChallengeStore {
  private readonly challenges = new Map<string, X401ChallengeState>();

  async issue(challenge: X401ChallengeState): Promise<boolean> {
    this.prune();
    if (this.challenges.has(challenge.nonce)) return false;
    this.challenges.set(challenge.nonce, challenge);
    return true;
  }

  async consume(nonce: string): Promise<X401ChallengeState | null> {
    this.prune();
    const challenge = this.challenges.get(nonce);
    if (!challenge) return null;
    this.challenges.delete(nonce);
    return challenge.expiresAt >= Date.now() ? challenge : null;
  }

  private prune() {
    const now = Date.now();
    for (const [nonce, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(nonce);
    }
  }
}

class FirestoreX401ChallengeStore implements X401ChallengeStore {
  async issue(challenge: X401ChallengeState): Promise<boolean> {
    const { getAdminFirestoreDb } = await import("../db/firebase.ts");
    const db = getAdminFirestoreDb();
    const ref = db.collection(COLLECTION).doc(challenge.nonce);
    return db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists && Number(existing.data()?.expiresAt || 0) >= Date.now()) return false;
      transaction.set(ref, challenge);
      return true;
    });
  }

  async consume(nonce: string): Promise<X401ChallengeState | null> {
    const { getAdminFirestoreDb } = await import("../db/firebase.ts");
    const db = getAdminFirestoreDb();
    const ref = db.collection(COLLECTION).doc(nonce);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      transaction.delete(ref);
      const challenge = snapshot.data() as X401ChallengeState;
      return challenge.expiresAt >= Date.now() ? challenge : null;
    });
  }
}

const memoryStore = new MemoryX401ChallengeStore();
const firestoreStore = new FirestoreX401ChallengeStore();

export function getX401ChallengeStore(): X401ChallengeStore {
  return process.env.X401_STORE === "memory" ? memoryStore : firestoreStore;
}

export function createMemoryX401ChallengeStore(): X401ChallengeStore {
  return new MemoryX401ChallengeStore();
}
