# Testing and verification

## Commands

```sh
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
npm audit --omit=dev
```

To test optimized production code, build first, then start each application in a separate terminal:

```sh
npm run start -w @lifehq/app
npm run start -w @lifehq/vault
E2E_EXTERNAL=1 npm run test:e2e
```

The browser tests default to ports 3000 and 3001. `LIFEHQ_BASE_URL` and `VAULT_BASE_URL` override them; `E2E_EXTERNAL=1` tells Playwright to use existing servers. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed browser. Browser screenshots contain demo/dummy data. Tracing is disabled to avoid habitually recording secret forms. The HTML report is generated locally and gitignored.

## Executed checks

Verification was performed on 2026-10-23. The final result ledger is in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

- **40 Vitest tests passed** across domain recurrence/progress, React primitives, cryptography, and real PostgreSQL RLS via PGlite.
- Strict TypeScript and ESLint passed for both applications.
- Both optimized Next.js production builds passed. A first restricted-sandbox build failed because Turbopack could not bind its local worker port; clearing its failed generated cache and rerunning with local network permission succeeded.
- Initial production Playwright run: 14 passed, 3 failed on the same sage text contrast issue. The color was corrected; subsequent results are recorded in the final ledger rather than treating this initial run as all green.
- Production dependency audit reported zero known vulnerabilities at the time of inspection. Supabase security advisors reported no findings after both migrations.

## Scope and evidence

`tests/unit/domain.test.ts` checks monthly clamping without anchor drift, leap-year recurrence, weekly bounds, daylight-saving gap/fold behavior, preferred-zone date boundaries, moved occurrences, discontinued recurrence, recurring completion validation, daily/weekly streaks, duplicate/future exclusion, goal/project metrics, and invalid date/timezone/ownership input.

`tests/unit/crypto.test.ts` executes the actual Argon2id and Web Crypto implementation: round-trip, fresh salts/nonces, wrong passphrases, nonce/salt/ciphertext tampering, format/version/size/KDF bounds, restoration, re-encryption, old-passphrase rejection, old-backup behavior, and generator constraints. This is not a third-party crypto audit.

`tests/integration/rls.test.ts` runs the checked-in SQL migrations on PGlite's PostgreSQL engine. It checks owner access, hidden foreign rows, forbidden updates/deletes, spoofed ownership, cross-owner associations, immutable IDs/owners, anonymous denial, all-table RLS, unique habit dates, invalid constraints, session-required deletion, and transactional self-deletion without deleting the other user. The test harness supplies minimal `auth` functions/tables and role claims; it does **not** execute Supabase's Auth service or prove email/password sessions work.

Browser journeys exercise the real forms and persistence adapters: task CRUD and dashboard agreement, project board/milestones/archive, event recurrence and per-instance move/delete, goal milestones/measured progress, dated habits, Markdown autosave/XSS/search/duplicate/export, preferences across reloads, command keyboard behavior, recurring completion history/undo, anonymous and cross-origin API denial, mobile navigation and dialog dismissal.

The vault browser test creates dummy credentials, checks that IndexedDB contains ciphertext rather than titles/usernames/notes, changes passphrases, rejects the old password, restores an exported encrypted backup, locks after simulated elapsed time, and deletes a test item. A second-tab test verifies stale tabs lock and malformed backups do not replace the vault. The lifecycle test checks there are no requests to outside origins and no page exceptions.

Network-failure UI tests deliberately intercept the Auth endpoint with an aborted connection and a 429 error. They verify retained input and usable retry controls; they are **not successful real-auth tests**.

Screenshots and overflow checks cover all nine LifeHQ sections at 1440, 768, and 390 pixels, plus vault setup/unlocked views. Axe scans target WCAG 2/2.1/2.2 A/AA rules for critical screens and controls. These automated results do not establish full WCAG compliance, usability with every assistive technology, or Safari/Firefox behavior.

## Open acceptance checks

Actual hosted registration, confirmation mail, password recovery, account persistence across sign-out/return, and full hosted two-user journeys remain unverified until redirect/email configuration and network access are resolved. The local demo uses browser persistence; it must not be presented as proof of Supabase persistence. Follow the explicit hosted checklist in [DEPLOYMENT.md](DEPLOYMENT.md).

Load/performance testing at large account sizes, cross-browser coverage, device-level accessibility review, and independent vault security review remain outside the executed evidence. No invented Lighthouse score or blanket “production secure” claim is made.
