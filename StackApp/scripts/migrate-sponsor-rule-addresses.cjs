#!/usr/bin/env node

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT is required");

const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore(app);

async function main() {
  const snapshot = await db.collection("perkos_sponsor_rules").get();
  const updates = snapshot.docs.filter((document) => {
    const value = document.data().agent_address;
    return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && value !== value.toLowerCase();
  });

  console.log(`${updates.length} of ${snapshot.size} sponsor rule addresses require normalization`);
  if (!apply || updates.length === 0) {
    console.log(apply ? "No changes required" : "Dry run only; pass --apply to update Firestore");
    return;
  }

  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = db.batch();
    for (const document of updates.slice(offset, offset + 400)) {
      batch.update(document.ref, {
        agent_address: document.data().agent_address.toLowerCase(),
        updated_at: new Date(),
      });
    }
    await batch.commit();
  }
  console.log(`Normalized ${updates.length} sponsor rule addresses`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
