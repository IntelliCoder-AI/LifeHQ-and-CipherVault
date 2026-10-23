import { describe, it, expect, beforeAll } from "vitest";
import {
  createVault,
  unlockVault,
  encryptVault,
  changePassphrase,
  parseBackup,
  generatePassword,
  strength,
  type Unlocked,
  type Vault,
} from "../../apps/ciphervault/lib/crypto";
const pass = "four unfamiliar words in October";
const vault: Vault = {
  entries: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "credential",
      title: "Dummy account",
      username: "dummy@example.test",
      password: "NeverARealCredential123!",
      url: "https://example.test",
      notes: "Dummy private note",
      category: "Testing",
      favorite: true,
      created_at: "2026-10-22T12:00:00Z",
      updated_at: "2026-10-22T12:00:00Z",
    },
  ],
};
let created: Unlocked;
beforeAll(async () => {
  created = await createVault(pass, vault);
});
describe("CipherVault authenticated encryption", () => {
  it("round-trips data without exposing plaintext in the envelope", async () => {
    const serialized = JSON.stringify(created.envelope);
    expect(serialized).not.toContain("NeverARealCredential");
    expect(serialized).not.toContain("Dummy account");
    expect((await unlockVault(created.envelope, pass)).vault).toEqual(vault);
    expect(created.key.extractable).toBe(false);
  });
  it("rejects incorrect passphrases", async () => {
    await expect(
      unlockVault(created.envelope, "a completely wrong passphrase"),
    ).rejects.toThrow("Unable to unlock");
  });
  it("rejects authenticated ciphertext, nonce and salt tampering", async () => {
    const e = structuredClone(created.envelope);
    e.ciphertext =
      (e.ciphertext[0] === "A" ? "B" : "A") + e.ciphertext.slice(1);
    await expect(unlockVault(e, pass)).rejects.toThrow("Unable to unlock");
    const nonce = { ...created.envelope, nonce: "AAAAAAAAAAAAAAAA" };
    await expect(unlockVault(nonce, pass)).rejects.toThrow("Unable to unlock");
    const salt = structuredClone(created.envelope);
    salt.kdf.salt = "AAAAAAAAAAAAAAAAAAAAAA==";
    await expect(unlockVault(salt, pass)).rejects.toThrow("Unable to unlock");
  });
  it("validates version, KDF cost, field whitelist and backup bounds before deriving keys", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...created.envelope, version: 2 })),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...created.envelope,
          kdf: { ...created.envelope.kdf, memoryKiB: 2147483647 },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...created.envelope, plaintext: "secret" })),
    ).toThrow();
    expect(() => parseBackup("x".repeat(7_000_001))).toThrow();
  });
  it("exports and restores an authenticated encrypted backup", async () => {
    const backup = parseBackup(JSON.stringify(created.envelope));
    expect((await unlockVault(backup, pass)).vault).toEqual(vault);
  });
  it("uses fresh random nonces on every save and fresh salts on setup", async () => {
    const next = await encryptVault(vault, created.key, created.envelope);
    expect(next.nonce).not.toBe(created.envelope.nonce);
    expect(next.ciphertext).not.toBe(created.envelope.ciphertext);
    const second = await createVault(pass, vault);
    expect(second.envelope.kdf.salt).not.toBe(created.envelope.kdf.salt);
  });
  it("changes the passphrase by re-encrypting and invalidates the old passphrase for the new vault", async () => {
    const next = await changePassphrase(
      created,
      pass,
      "a new set of unrelated words",
    );
    expect(next.envelope.kdf.salt).not.toBe(created.envelope.kdf.salt);
    expect(
      (await unlockVault(next.envelope, "a new set of unrelated words")).vault,
    ).toEqual(vault);
    await expect(unlockVault(next.envelope, pass)).rejects.toThrow();
    expect((await unlockVault(created.envelope, pass)).vault).toEqual(vault);
  });
  it("rejects short setup passphrases and wrong current passphrases", async () => {
    await expect(createVault("short")).rejects.toThrow("16");
    await expect(
      changePassphrase(created, "wrong", "another long enough passphrase"),
    ).rejects.toThrow();
  });
});
describe("password generator", () => {
  it("generates varied passwords with each selected character class", () => {
    const passwords = new Set(
      Array.from({ length: 30 }, () => generatePassword(24)),
    );
    expect(passwords.size).toBe(30);
    for (const p of passwords) {
      expect(p).toHaveLength(24);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
    }
  });
  it("supports a symbol-free password and validates length", () => {
    expect(generatePassword(32, false)).toMatch(/^[a-zA-Z0-9]{32}$/);
    expect(() => generatePassword(5)).toThrow();
    expect(() => generatePassword(24.5)).toThrow();
  });
  it("gives cautious, local strength feedback", () => {
    expect(strength("password123456").level).toBe(1);
    expect(strength("aaaaaaaaaaaaaaaaaaaaaaaa").level).toBe(1);
    expect(strength(generatePassword()).level).toBe(4);
  });
});
