# Security and privacy

**CipherVault is an unaudited development prototype. Use dummy credentials only. Do not store real credentials until independent expert review.** Automated tests verify particular behavior; they do not establish cryptographic product safety.

## LifeHQ trust model

Supabase manages password authentication and sessions. Route handlers verify the authenticated user; PostgreSQL RLS restricts every exposed record table to that owner. Same-owner composite foreign keys prevent linking another user's project, habit, goal, task, or milestone. UUIDs are identifiers, not authorization. API inputs are allowlisted and Zod-validated; database constraints also protect direct Data API writes. Supabase's publishable key is public by design. There is no service-role key in the application.

Supabase SSR maintains sessions in browser cookies. Server-side user verification, SameSite cookie behavior, same-origin mutation checks, a nonce-based script CSP, and private/no-store responses reduce session and cross-site risks. The app uses server-only Supabase clients: access, refresh, and PKCE verifier cookies are HttpOnly, Secure in production, SameSite=Lax, and host-scoped. Browser code calls the same-origin application API. XSS can compromise an active account. Markdown rendering does not enable raw HTML; unsafe links are sanitized and remote images are disabled. React escapes text. SQL is passed through parameterized Supabase queries rather than interpolated user input.

Record updates compare versions to detect concurrent edits. Bulk status changes are atomic. Account deletion requires confirmation and password reauthentication in the UI/API, then calls an authenticated RPC limited to the current user with a live session. The database also requires a confirmed, non-anonymous account, a live unexpired Auth session, and a password AMR timestamp within the last 120 seconds (with at most 60 seconds of future clock skew). A direct RPC call cannot omit this proof. Deletion cascades productivity data and auth sessions. Supabase provider backups may retain data according to its retention policy. Restrictive active-session policies protect all 14 public tables and the private deletion queue, including direct Data API requests after logout. Anonymous roles cannot execute app functions.

LifeHQ data is not end-to-end encrypted. Hosting/database operators and compromised infrastructure can access it. Do not put vault credentials into LifeHQ notes. Demo records and preferences are plaintext localStorage, clearly labeled as a local demo.

## CipherVault cryptography

| Property | Implementation |
| --- | --- |
| KDF | Argon2id from `hash-wasm` |
| Parameters | 65,536 KiB memory (64 MiB), 3 iterations, parallelism 1, 32-byte output |
| Salt | 16 random bytes, fresh on setup and passphrase change |
| Encryption | Browser Web Crypto AES-256-GCM with a 128-bit authentication tag |
| Nonce | Fresh random 12 bytes on every encryption using `crypto.getRandomValues` |
| Key | Non-extractable `CryptoKey`, retained only while unlocked |
| Format | Strict version 1 JSON envelope, algorithm identifiers, KDF parameters, salt, nonce, base64 ciphertext |
| Authentication | Canonical format/version/KDF/salt/cipher metadata is AES-GCM additional authenticated data; the nonce affects authentication |
| Storage | Origin-scoped IndexedDB `ciphervault-local-v1`, store `encrypted`, key `vault` |

Passphrases are 16–256 characters at setup/change. No passphrase, plaintext item, or decrypted key is written to browser storage or transmitted to a server. A non-sensitive inactivity setting is stored in localStorage. Argon2 parameters are fixed for version 1 and validated before computation, preventing an imported file from requesting arbitrary memory/CPU costs. Imports reject unknown fields/versions, invalid base64 and lengths, more than 7 MB of JSON, or more than 5 MB of ciphertext. Decrypted contents are schema-validated. Incorrect passphrases and tampered data produce a generic unlock failure.

Changing the passphrase verifies the old one and re-encrypts the vault using a new salt, key, and nonce before atomic replacement. Existing exported backups remain encrypted under their original passphrase: a change cannot revoke a previously copied backup. Restoration authenticates the backup before replacing local ciphertext, and requires explicit acknowledgement. There is no key escrow, cloud synchronization, or forgotten-passphrase recovery.

IndexedDB writes compare the previous nonce inside a transaction to reject stale-tab writes. A BroadcastChannel locks other open tabs after a change or an explicit lock. Idle timers, activity checks, visibility checks, and page exit clear unlocked state. Async epoch checks run after cryptography and after storage writes, so a pending setup or restore cannot reopen a locked session.

Raw temporary byte arrays are overwritten where practical. **JavaScript strings, React state, browser internals, WASM memory, and garbage-collected objects cannot be guaranteed securely erased.** Dropping references is not a secure memory-erasure guarantee. Browser suspensions may delay timers; the activity/visibility checks re-evaluate lock deadlines when execution resumes.

The generator uses Web Crypto randomness with rejection sampling for character selection and shuffling, lengths 16–128, and required character classes. Its default is 24 characters. Strength labels are local heuristics, not breach lookup, crack-time estimates, or proof of entropy. Clipboard timers retain a SHA-256 digest rather than the copied plaintext. Clipboard clearing waits 20 seconds and only attempts a read/clear when permission is already granted and the clipboard still matches the copied value. Operating-system clipboard history and other applications may keep copies.

## What this does and does not protect

The design aims to keep a copied, locked IndexedDB vault or exported backup confidential without the passphrase and detect encrypted-data modification. Offline guessing remains possible; weak passphrases reduce that protection. Random nonces make collisions unlikely, not mathematically impossible.

It does not protect an unlocked vault from XSS, malicious browser extensions, a compromised operating system/browser, keyloggers, screenshots, clipboard capture, hostile dependency updates, or malicious code served by the host. A compromised hosting origin could replace the application and capture future unlocks. Separate origins prevent ordinary same-origin access by LifeHQ but do not protect against device compromise. HTTPS is required outside localhost. Ciphertext size and the existence of a vault are visible metadata. Local browser data can be cleared or lost without warning; backups are essential.

CipherVault has no network API, telemetry, external scripts, AI integration, or cloud storage. Its production CSP defaults to `none`, permits local scripts with per-request nonces plus WASM evaluation required by Argon2, and limits connections/fonts/images to local resources. Development additionally permits eval for Next.js tooling. CSS permits inline styles. CSP is defense in depth, not proof against every script injection or malicious first-party script.

## Verification and remaining review

See the [2026-10-26 security audit](docs/SECURITY_AUDIT_2026-10-26.md) and [TESTING.md](TESTING.md) for executed crypto, RLS, browser storage, navigation, and security-header checks. Dependency audits and Supabase advisors are point-in-time automated checks. Before real vault usage, obtain independent review of cryptography, dependency provenance, browser state/locking, import/parser limits, side channels, supply chain, and deployment. The user verified live signup, email confirmation, login and logout before this audit. Fresh recovery-email delivery was not reverified because of Supabase email quotas and the environment’s restricted external network. Supabase’s advisor still reports disabled leaked-password protection; provider Auth settings and SMTP remain dashboard-managed.

Report vulnerabilities privately to the repository owner. Do not post real vault files, master passphrases, session cookies, recovery links, or credentials in public issues.
