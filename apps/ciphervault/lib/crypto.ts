import { argon2id } from "hash-wasm";
import { z } from "zod";
const KDF = {
  algorithm: "argon2id" as const,
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
} as const;
const base64 = z
  .string()
  .max(7000000)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const envelopeSchema = z
  .object({
    format: z.literal("ciphervault"),
    version: z.literal(1),
    kdf: z
      .object({
        algorithm: z.literal("argon2id"),
        memoryKiB: z.literal(65536),
        iterations: z.literal(3),
        parallelism: z.literal(1),
        salt: base64.length(24),
      })
      .strict(),
    cipher: z.literal("AES-256-GCM"),
    nonce: base64.length(16),
    ciphertext: base64.min(24),
  })
  .strict();
const storedEntrySchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["credential", "note"]),
    title: z.string().trim().min(1).max(200),
    username: z.string().max(500),
    password: z.string().max(4096),
    url: z.string().max(2048),
    notes: z.string().max(50000),
    category: z.string().trim().min(1).max(80),
    favorite: z.boolean(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .strict();
// Preserve readable legacy vaults while requiring safe URLs for new edits/links.
export function safeWebsite(value: string) {
  if (/[\u0000-\u0020\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export const entrySchema = storedEntrySchema.extend({
  url: z
    .string()
    .max(2048)
    .refine(
      (value) => !value || safeWebsite(value),
      "Use an http or https URL without embedded credentials",
    ),
});
export const vaultSchema = z
  .object({ entries: z.array(storedEntrySchema).max(5000) })
  .strict()
  .refine(
    (vault) =>
      new Set(vault.entries.map((entry) => entry.id)).size ===
      vault.entries.length,
    "Vault entries must have unique IDs",
  );
export type Envelope = z.infer<typeof envelopeSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Vault = z.infer<typeof vaultSchema>;
export type Unlocked = { key: CryptoKey; envelope: Envelope; vault: Vault };
const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
function b64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 32768)
    output += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(output);
}
function bytes(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function additionalData(
  envelope: Pick<Envelope, "format" | "version" | "kdf" | "cipher">,
) {
  return encoder.encode(
    JSON.stringify({
      format: envelope.format,
      version: envelope.version,
      kdf: {
        algorithm: envelope.kdf.algorithm,
        memoryKiB: envelope.kdf.memoryKiB,
        iterations: envelope.kdf.iterations,
        parallelism: envelope.kdf.parallelism,
        salt: envelope.kdf.salt,
      },
      cipher: envelope.cipher,
    }),
  );
}
export function validateEnvelope(input: unknown): Envelope {
  const envelope = envelopeSchema.parse(input);
  if (
    bytes(envelope.kdf.salt).length !== 16 ||
    bytes(envelope.nonce).length !== 12 ||
    bytes(envelope.ciphertext).length > 5_000_000
  )
    throw new Error("Invalid encrypted backup");
  return envelope;
}
export function parseBackup(text: string): Envelope {
  if (text.length > 7_000_000) throw new Error("Backup exceeds the 7 MB limit");
  return validateEnvelope(JSON.parse(text));
}
function validatePassphrase(passphrase: string) {
  if (passphrase.length < 16 || passphrase.length > 256)
    throw new Error(
      "Use a passphrase between 16 and 256 characters. Several unrelated words are a good start.",
    );
}
async function derive(passphrase: string, salt: string) {
  if (passphrase.length > 256) throw new Error("Passphrase is too long");
  const raw = await argon2id({
    password: passphrase,
    salt: bytes(salt),
    parallelism: KDF.parallelism,
    iterations: KDF.iterations,
    memorySize: KDF.memoryKiB,
    hashLength: 32,
    outputType: "binary",
  });
  try {
    return await crypto.subtle.importKey(
      "raw",
      new Uint8Array(raw),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    raw.fill(0);
  }
}
export async function encryptVault(
  vault: Vault,
  key: CryptoKey,
  previous: Pick<Envelope, "kdf">,
): Promise<Envelope> {
  vaultSchema.parse(vault);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const envelope = {
    format: "ciphervault" as const,
    version: 1 as const,
    kdf: previous.kdf,
    cipher: "AES-256-GCM" as const,
    nonce: b64(nonce),
  };
  const plain = encoder.encode(JSON.stringify(vault));
  try {
    if (plain.length > 4_999_984)
      throw new Error("Vault exceeds the 5 MB limit");
    const cipher = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: additionalData(envelope),
        tagLength: 128,
      },
      key,
      plain,
    );
    return { ...envelope, ciphertext: b64(new Uint8Array(cipher)) };
  } finally {
    plain.fill(0);
  }
}
export async function createVault(
  passphrase: string,
  vault: Vault = { entries: [] },
): Promise<Unlocked> {
  validatePassphrase(passphrase);
  const kdf = { ...KDF, salt: b64(crypto.getRandomValues(new Uint8Array(16))) };
  const key = await derive(passphrase, kdf.salt),
    envelope = await encryptVault(vault, key, { kdf });
  return { key, envelope, vault };
}
export async function unlockVault(
  input: unknown,
  passphrase: string,
): Promise<Unlocked> {
  try {
    const envelope = validateEnvelope(input),
      key = await derive(passphrase, envelope.kdf.salt);
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(envelope.nonce),
        additionalData: additionalData(envelope),
        tagLength: 128,
      },
      key,
      bytes(envelope.ciphertext),
    );
    const buffer = new Uint8Array(plain);
    try {
      const vault = vaultSchema.parse(JSON.parse(decoder.decode(buffer)));
      return { key, envelope, vault };
    } finally {
      buffer.fill(0);
    }
  } catch {
    throw new Error(
      "Unable to unlock. The passphrase may be incorrect, or the backup may be damaged.",
    );
  }
}
export async function changePassphrase(
  current: Unlocked,
  oldPassphrase: string,
  nextPassphrase: string,
): Promise<Unlocked> {
  await unlockVault(current.envelope, oldPassphrase);
  return createVault(nextPassphrase, current.vault);
}
const alphabets = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%^&*-_=+?",
};
function randomIndex(length: number) {
  const limit = Math.floor(256 / length) * length,
    random = new Uint8Array(1);
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= limit);
  return random[0] % length;
}
export function generatePassword(length = 24, symbols = true): string {
  if (!Number.isInteger(length) || length < 16 || length > 128)
    throw new Error("Choose a length from 16 to 128");
  const sets = [
      alphabets.lower,
      alphabets.upper,
      alphabets.digits,
      ...(symbols ? [alphabets.symbols] : []),
    ],
    alphabet = sets.join("");
  const output = sets.map((set) => set[randomIndex(set.length)]);
  while (output.length < length)
    output.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = output.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output.join("");
}
export function strength(password: string): { label: string; level: number } {
  if (
    password.length < 12 ||
    /^(.)\1+$/.test(password) ||
    /password|qwerty|123456/i.test(password)
  )
    return { label: "Weak", level: 1 };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) =>
    r.test(password),
  ).length;
  if (password.length >= 20 && classes >= 3)
    return { label: "Strong by local checks", level: 4 };
  if (password.length >= 16 && classes >= 2)
    return { label: "Good length & variety", level: 3 };
  return { label: "Consider a longer password", level: 2 };
}
