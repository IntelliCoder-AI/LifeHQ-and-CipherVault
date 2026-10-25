# QA bug fixes — 25 October 2026

This release addresses the supplied QA defects and quick wins. It preserves LifeHQ's design and the independent, dummy-only CipherVault app.

| Finding | Change |
| --- | --- |
| Wrong auth origin / expired email | Production environment points to `https://lifehq-three.vercel.app`. Signup, recovery, resend and callback redirects use that configured origin, including when invoked from a preview. Production login/reset pages redirect to the canonical host before creating PKCE state. Errors distinguish an unusable browser flow from a link with no code, and known error fragments lead to visible recovery guidance. A resend form uses privacy-safe responses. |
| CipherVault SSO wall | Launch environment points to the verified project domain `https://ciphervault-orpin.vercel.app`. Vercel Standard Protection leaves that production domain public and protects deployment URLs and previews. Existing vault data is origin-bound; the companion page explains encrypted backup transfer from an older address. |
| Contradictory theme controls | Settings reads the ThemeProvider's live selection. Appearance changes apply and save immediately; saving other preferences includes the current theme. Header changes no longer leave the Settings select stale or get overwritten by its initial draft. Unsaved unrelated fields survive theme changes. |
| Habit disabled dates / backfill | Scheduled start days are enabled. Unavailable dates remain focusable, use `aria-disabled`, show a reason on hover, and explain it when activated. The weekly table and monthly history explain backfilling past scheduled dates. Schedule rules and server validation are retained. Current/longest streaks already existed and remain visible. |
| Silent account deletion | Success redirects to a login notice confirming deletion. |
| Generic login errors | Invalid credentials receive actionable guidance, including recovery and starting again after account deletion, without revealing whether an account exists. |
| Note delete wording | All record deletes use the same shared confirmation, with a ten-second undo explanation. |
| Undo | Private, RLS-protected pending-deletion queue and security-invoker RPCs stage removal for ten seconds. Undo cancels the queue entry before expiry; linked records are preserved. Expiry finalizes with the existing FK cascade and version guard. Concurrently changed records are kept. The browser finalizes active windows; if closed, the next authenticated workspace request completes expired deletions. Account erasure remains immediate and separately confirmed. Habit checkbox unchecks remain immediate. The local demo mirrors the queue and persistence. |

## Auth configuration and remaining acceptance

The owner confirmed Supabase's Site URL and both callback redirect URLs were saved for `lifehq-three.vercel.app`. Confirm email remains unchanged by agreement until a fresh email link succeeds. Old consumed/expired OTP links cannot be repaired by changing URLs. After publication, test a newly requested confirmation and recovery email in the originating browser; only then enable Confirm email if confirmation is required. The connector does not provide an inbox or edit hosted Auth configuration.

Direct public browser access from this managed environment remains restricted. Vercel's authenticated fetch can check response content, but uses a temporary access mechanism and cannot establish anonymous access or end-to-end inbox acceptance. No bypass URLs are embedded in either product.

## Validation

Validation covers unit tests for canonical auth URLs, callback destinations, privacy-safe resend/login errors and account-deletion reauthentication; PostgreSQL tests for queue ownership, rollback/undo, expiry/cascades and version conflicts; and browser checks for theme agreement, habits, reload-safe undo and feedback. Final results are recorded in TESTING.md.

The broader feature list (account email/password settings, global JSON import, persistent trash, push reminders, avatar and further board interaction work) remains a separate backlog.
