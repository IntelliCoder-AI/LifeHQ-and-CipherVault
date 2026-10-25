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

- **43 Vitest tests passed** across domain recurrence/progress, React primitives, cryptography, and real PostgreSQL RLS via PGlite.
- Strict TypeScript and ESLint passed for both applications.
- Both optimized Next.js production builds passed. A first restricted-sandbox build failed because Turbopack could not bind its local worker port; clearing its failed generated cache and rerunning with local network permission succeeded.
- **23 Playwright tests passed against optimized production builds**, including responsive layouts, signup confirmation/visibility, local navigation/history, Overview section ordering, and CipherVault discoverability. The palette refresh exposed one low-contrast secondary label in the plum theme; its token was corrected and the complete suite passed. Final signup inspection also tightened muted illustration-text contrast and waits for bundled fonts before scanning. Subsequent small mobile-label enlargement was checked with the relevant responsive/accessibility tests.
- Production dependency audit reported zero known vulnerabilities at the time of inspection. Supabase security advisors reported no findings after both migrations.

## Scope and evidence

`tests/unit/domain.test.ts` checks monthly clamping without anchor drift, leap-year recurrence, weekly bounds, daylight-saving gap/fold behavior, preferred-zone date boundaries, moved occurrences, discontinued recurrence, recurring completion validation, daily/weekly streaks, duplicate/future exclusion, goal/project metrics, and invalid date/timezone/ownership input.

`tests/unit/crypto.test.ts` executes the actual Argon2id and Web Crypto implementation: round-trip, fresh salts/nonces, wrong passphrases, nonce/salt/ciphertext tampering, format/version/size/KDF bounds, restoration, re-encryption, old-passphrase rejection, old-backup behavior, and generator constraints. This is not a third-party crypto audit.

`tests/integration/rls.test.ts` runs the checked-in SQL migrations on PGlite's PostgreSQL engine. It checks owner access, hidden foreign rows, forbidden updates/deletes, spoofed ownership, cross-owner associations, immutable IDs/owners, anonymous denial, all-table RLS, unique habit dates, invalid constraints, session-required deletion, and transactional self-deletion without deleting the other user. The test harness supplies minimal `auth` functions/tables and role claims; it does **not** execute Supabase's Auth service or prove email/password sessions work.

Browser journeys exercise the real forms and persistence adapters: task CRUD and dashboard agreement, project board/milestones/archive, event recurrence and per-instance move/delete, goal milestones/measured progress, dated habits, Markdown autosave/XSS/search/duplicate/export, preferences across reloads, command keyboard behavior, recurring completion history/undo, anonymous and cross-origin API denial, mobile navigation and dialog dismissal.

The vault browser test creates dummy credentials, checks that IndexedDB contains ciphertext rather than titles/usernames/notes, changes passphrases, rejects the old password, restores an exported encrypted backup, locks after simulated elapsed time, and deletes a test item. A second-tab test verifies stale tabs lock and malformed backups do not replace the vault. The lifecycle test checks there are no requests to outside origins and no page exceptions.

Network-failure UI tests deliberately intercept the Auth endpoint with an aborted connection and a 429 error. They verify retained input and usable retry controls; they are **not successful real-auth tests**.

The signup form test stubs a successful confirmation response to check form behavior; it does not create a Supabase account. A direct request to the real local Auth route checks that mismatched passwords return HTTP 400 before contacting Supabase. Navigation tests assert no server-component or workspace-data request during section changes and verify browser back/forward.

Screenshots and overflow checks cover all ten LifeHQ sections, including the CipherVault access guide at 1440, 768, and 390 pixels, plus vault setup/unlocked views. Axe scans target WCAG 2/2.1/2.2 A/AA rules for critical screens and controls. These automated results do not establish full WCAG compliance, usability with every assistive technology, or Safari/Firefox behavior.

## Open acceptance checks

Actual hosted registration, confirmation mail, password recovery, account persistence across sign-out/return, and full hosted two-user journeys remain unverified until live network access and actual test-account/email verification are available. The user confirmed production redirect configuration is saved. The local demo uses browser persistence; it must not be presented as proof of Supabase persistence. Follow the explicit hosted checklist in [DEPLOYMENT.md](DEPLOYMENT.md).

Load/performance testing at large account sizes, cross-browser coverage, device-level accessibility review, and independent vault security review remain outside the executed evidence. No invented Lighthouse score or blanket “production secure” claim is made.

## Hosted HTTP checks

Vercel reports the LifeHQ production deployment READY. Using the Vercel connector, `/login` and `/demo` returned 200, `/api/workspace` returned 401 without a LifeHQ session, and `/workspace` resolved to the login page. Responses included nonce-based CSP, private/no-store caching, frame denial, content-type protection, and HSTS. This connector can use Vercel deployment-protection bypass links; these checks do not establish unrestricted browser access or execute client-side authenticated journeys. Direct shell/browser access to the deployment is blocked by the managed network proxy (CONNECT 403). The user cannot change this environment policy.

A GitHub Actions verification workflow is committed. Its hosted result is unverified: the environment also rejected the GitHub Actions API request. Local executed checks above are the evidence, not an assumed CI pass.

## Navigation measurement

A six-section local Chromium sequence previously triggered six server-component requests; the same sequence now triggers zero. One idle local run measured a median click-to-heading interval of 101ms versus 159ms in the baseline. These small local samples are diagnostic, not a hosted performance guarantee. Functions are configured in Mumbai alongside the database region; hosted latency and large-workspace performance remain unmeasured.

The auth routing regression tests assert that public pages and API routes skip middleware session work while protected workspace pages still reject an unverified identity. Each data API retains its own authenticated check. Browser coverage includes the theme toggle on login and workspace, persistence across reload, system theme changes, the independent CipherVault page, and absence of localhost launch links. CipherVault setup is scanned in both themes.

The latest security advisor reported leaked-password protection disabled. No paid Auth setting was enabled. This does not change the existing prototype-only vault restriction.


25 October 2026 — Awwwards-informed LifeHQ palette and Manrope typography: optimized build, ESLint and six focused Playwright checks passed (responsive 1440/768/390, major sections and editor in both themes, signup confirmation/visibility, theme persistence/system mode). Fourteen dedicated visual captures cover Overview, Projects and auth; Overview and Projects pass focused contrast/overflow scans. The initial muted badge contrast failure was fixed, then the complete focused set was rerun successfully. This styling update does not resolve the previously documented hosted Auth/inbox acceptance limitation.
