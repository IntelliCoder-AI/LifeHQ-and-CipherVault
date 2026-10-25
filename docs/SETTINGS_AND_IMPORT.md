# Settings and backup completion — 25 October 2026

## Account settings

Signed-in accounts can change their email or password in Settings. Both actions verify the current password with Supabase first. Password changes require matching new/confirmation fields and preserve Supabase's own security checks. Email updates use the canonical public callback and explain the confirmation steps in the current and new inboxes. The pending address is shown until Supabase finishes the change. Account credentials are not available in the local demo and are never part of a workspace export/import.

Password recovery remains a distinct email flow. Its update endpoint now requires a verified Supabase `recovery` authentication-method claim, bound to the current user and recent authentication. A normal password session cannot bypass the current-password check through that endpoint. The implementation uses `getClaims()` to verify claims, not editable user metadata or an unverified JWT decode. A successful non-recovery email callback displays a one-time confirmation toast and removes the notice parameter from navigation.

Built-in email quota errors explain the sending limit, while general request throttles have their own message. SMTP configuration, billing and provider rate limits are unchanged. The owner's latest retest confirmed signup confirmation, blocking of unverified password sign-in, CipherVault access, theme persistence, habits/streaks, deletion/undo, board dragging and CRUD/search/export persistence. The password-reset inbox test was blocked by the email quota. New email-change delivery and full reset acceptance still require an actual delivered email.

## JSON import

Settings places Import JSON beside the export action. A LifeHQ version-1 export (up to 5 MB / 2,000 records) is validated before the preview opens. The dialog shows record counts, explains additive copying and duplicate imports, and lets the owner explicitly include preferences. It never replaces existing records. Imported preferences include the display name, appearance, timezone and profile photo, and refresh the Settings draft intentionally.

Every imported ID is regenerated and references are remapped. Task parents are sorted before children, and cycles, missing links, duplicate source IDs, unknown table types and invalid records are rejected. Exported owner IDs, versions and creation/update metadata cannot assign ownership or overwrite existing records. Database timestamp offsets are normalized for compatibility with hosted exports.

The authenticated API enforces origin checks and a streaming size limit. A security-invoker PostgreSQL RPC inserts all rows and optional preferences in one transaction under RLS, overriding every record's owner with `auth.uid()`. A failed row rolls everything back. Explicit anonymous execution is revoked. The local demo mirrors the same validation and additive ownership behavior.

## Profile photo

JPEG, PNG and WebP uploads are limited to 2 MB and resized/cropped in the browser to a 128px JPEG. Canvas re-encoding omits the original file metadata. Only the bounded JPEG data URL is saved in the private, owner-protected profile preferences. No public storage bucket, remote image URL or new runtime secret is introduced. Photos are shown in navigation, can be removed, survive reload, and are included in optional preference backups.

## Validation

Unit/database checks cover authenticated account-change requests, current-password failures, recovery-method checks, mail rate errors, import ownership, malformed/oversized files, link remapping, ordering, rollback and a complete linked sample export. Browser checks cover import preview/persistence/preferences, photo upload/removal/persistence and one-time confirmation feedback, alongside the existing regression and accessibility cases. Final totals are recorded in TESTING.md.
