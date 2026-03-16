import { Keypair } from "@stellar/stellar-sdk";
import crypto from "crypto";
import { getAdminFirestoreDb } from "../db/firebase";
import { logger } from "../utils/logger";
import type { StellarWallet, StellarConfig } from "../types/stellar";

const COLLECTION = "stellarWallets";
const ALGORITHM = "aes-256-gcm";

function getStellarConfig(): StellarConfig {
  return {
    rpcUrl: process.env.STELLAR_RPC_URL || "https://mainnet.sorobanrpc.com",
    horizonUrl: process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org",
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || "Public Global Stellar Network ; September 2015",
    usdcContract: process.env.STELLAR_USDC_CONTRACT || "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    masterKey: process.env.STELLAR_WALLET_MASTER_KEY || "",
  };
}

function getMasterKeyBuffer(): Buffer {
  const config = getStellarConfig();
  if (!config.masterKey || config.masterKey.length !== 64) {
    throw new Error("STELLAR_WALLET_MASTER_KEY must be a 32-byte hex string (64 chars)");
  }
  return Buffer.from(config.masterKey, "hex");
}

function encryptSecret(secret: string): { encrypted: string; iv: string; authTag: string } {
  const masterKey = getMasterKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decryptSecret(encrypted: string, iv: string, authTag: string): string {
  const masterKey = getMasterKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export class StellarWalletService {
  async createWallet(userId: string): Promise<StellarWallet> {
    const db = getAdminFirestoreDb();
    const existing = await this.getWalletByUserId(userId);
    if (existing) {
      throw new Error("Wallet already exists for this user");
    }

    const keypair = Keypair.random();
    const { encrypted, iv, authTag } = encryptSecret(keypair.secret());
    const now = Date.now();

    const wallet: Omit<StellarWallet, "id"> = {
      userId,
      publicKey: keypair.publicKey(),
      encryptedSecret: encrypted,
      iv,
      authTag,
      xlmBalance: "0",
      usdcBalance: "0",
      autoSwap: true,
      spendingLimit: "100",
      spent24h: "0",
      lastSpendReset: now,
      createdAt: now,
      updatedAt: now,
      status: "active",
    };

    const docRef = await db.collection(COLLECTION).add(wallet);
    logger.info("Stellar wallet created", { userId, publicKey: keypair.publicKey() });

    return { id: docRef.id, ...wallet };
  }

  async getWalletByUserId(userId: string): Promise<StellarWallet | null> {
    const db = getAdminFirestoreDb();
    const snapshot = await db
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as StellarWallet;
  }

  async getKeypair(walletId: string): Promise<Keypair> {
    const db = getAdminFirestoreDb();
    const doc = await db.collection(COLLECTION).doc(walletId).get();
    if (!doc.exists) throw new Error("Wallet not found");

    const data = doc.data() as Omit<StellarWallet, "id">;
    const secret = decryptSecret(data.encryptedSecret, data.iv, data.authTag);
    return Keypair.fromSecret(secret);
  }

  async updateBalance(walletId: string, xlm: string, usdc: string): Promise<void> {
    const db = getAdminFirestoreDb();
    await db.collection(COLLECTION).doc(walletId).update({
      xlmBalance: xlm,
      usdcBalance: usdc,
      updatedAt: Date.now(),
    });
  }

  async recordSpending(walletId: string, amount: string): Promise<void> {
    const db = getAdminFirestoreDb();
    const doc = await db.collection(COLLECTION).doc(walletId).get();
    if (!doc.exists) throw new Error("Wallet not found");

    const wallet = doc.data() as Omit<StellarWallet, "id">;
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;

    let spent = parseFloat(wallet.spent24h);
    if (now - wallet.lastSpendReset > windowMs) {
      spent = 0;
    }
    spent += parseFloat(amount);

    await db.collection(COLLECTION).doc(walletId).update({
      spent24h: spent.toString(),
      lastSpendReset: now - wallet.lastSpendReset > windowMs ? now : wallet.lastSpendReset,
      updatedAt: now,
    });
  }

  async canSpend(walletId: string, amount: string): Promise<boolean> {
    const db = getAdminFirestoreDb();
    const doc = await db.collection(COLLECTION).doc(walletId).get();
    if (!doc.exists) return false;

    const wallet = doc.data() as Omit<StellarWallet, "id">;
    if (wallet.status !== "active") return false;

    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    let spent = parseFloat(wallet.spent24h);
    if (now - wallet.lastSpendReset > windowMs) {
      spent = 0;
    }

    const limit = parseFloat(wallet.spendingLimit);
    return spent + parseFloat(amount) <= limit;
  }

  async freezeWallet(walletId: string): Promise<void> {
    const db = getAdminFirestoreDb();
    await db.collection(COLLECTION).doc(walletId).update({
      status: "frozen",
      updatedAt: Date.now(),
    });
    logger.info("Stellar wallet frozen", { walletId });
  }
}
