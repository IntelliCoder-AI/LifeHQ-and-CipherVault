import { openDB, type DBSchema } from "idb";
import { validateEnvelope, type Envelope } from "./crypto";
interface VaultDB extends DBSchema {
  encrypted: { key: string; value: Envelope };
}
const database = () =>
  openDB<VaultDB>("ciphervault-local-v1", 1, {
    upgrade(db) {
      db.createObjectStore("encrypted");
    },
  });
export async function readEncrypted(): Promise<Envelope | null> {
  const db = await database();
  try {
    const stored = await db.get("encrypted", "vault");
    return stored ? validateEnvelope(stored) : null;
  } finally {
    db.close();
  }
}
export async function writeEncrypted(
  envelope: Envelope,
  expectedNonce: string | null,
): Promise<void> {
  validateEnvelope(envelope);
  const db = await database();
  try {
    const transaction = db.transaction("encrypted", "readwrite");
    const current = await transaction.store.get("vault");
    if ((current?.nonce || null) !== expectedNonce) {
      transaction.abort();
      await transaction.done.catch(() => {});
      throw new Error(
        "The vault changed in another tab. Lock and unlock again before saving.",
      );
    }
    await transaction.store.put(envelope, "vault");
    await transaction.done;
  } finally {
    db.close();
  }
}
