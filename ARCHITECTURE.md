# Architecture

## Boundaries

LifeHQ and CipherVault are independent Next.js applications on separate origins. They share visual components, fonts, and styles. CipherVault does not import the Supabase client, LifeHQ data store, or LifeHQ domain models. Its only durable sensitive state is authenticated ciphertext in its own origin's IndexedDB. A LifeHQ navigation link opens the other origin with no credential handoff.

LifeHQ account pages use a client workspace store backed by same-origin API routes. Route handlers validate the Supabase user, validate inputs with Zod, and query PostgreSQL with the caller's session. No service-role credentials are used. Next.js `proxy.ts` refreshes cookie sessions and sets a fresh CSP nonce. Protected server pages verify the user again. Authenticated responses are private and not cached publicly.

`/demo` uses the same screens and domain functions with an explicit localStorage adapter. Sample data is opt-in. Demo persistence and backend persistence are separate test targets; the demo is neither a fallback for failed account writes nor a synchronization queue.

## Database

The public schema contains profiles, tasks, projects, events, goals, habits, notes, milestones, habit entries, goal entries, task occurrences, event occurrences, reviews, and append-only activity. Preferences are validated JSON on profiles; tags are bounded text arrays rather than a separate tag service. Checklists are tasks with `parent_id`; one nesting level is supported. Recurrence is a constrained JSON rule, not a pre-generated unbounded table of dates.

Every record table has owner-based RLS. Records use UUIDs, owner IDs, timestamps, and optimistic versions. Composite `(id, user_id)` foreign keys stop cross-account associations. Ownership and IDs are immutable. Indexes support owner/date/relationship queries. Dependent record deletion follows explicit foreign-key rules. The demo adapter mirrors those cascades. A bulk task status operation is one SQL statement; account deletion is one transactional function restricted to the current authenticated account with a live session.

The API fetches pages of 500 records per table, avoiding Supabase's default result truncation. The client currently retains the personal workspace in memory; very large archives will need incremental client queries and list virtualization. No collaborative realtime or offline write queue is claimed. Version mismatches produce a conflict instead of silently overwriting a newer save.

## Time and recurrence

Date-only values are ISO calendar dates; timed items also store local wall time and an IANA timezone. Temporal converts these to instants for reminders. A daily 09:00 event remains 09:00 in its assigned timezone across daylight saving. Nonexistent spring times shift forward; ambiguous autumn times choose the earlier instant (`compatible` disambiguation).

Weekly recurrence uses Monday-based ISO week intervals and selected weekdays. Monthly/yearly recurrence clamps to the last valid day while preserving the original anchor (January 31 → February 28/29 → March 31). The optional end date is inclusive. Supported user dates are 1900–2100.

Sparse occurrence records retain the original series date as their identity and a separate scheduled date/time. A move suppresses the original slot and creates exactly one moved slot. Completing a repeated task completes that occurrence, not its entire series. Disabling recurrence hides exceptions from the current schedule but preserves completed history. Deleting the series removes its occurrences. Editing a series retains existing exceptions; changing historical schedules does not recalculate previous records.

Calendar columns show each item's local date and time; they do not normalize mixed-timezone entries into one timezone grid. The UI states this behavior. Workspace timezone governs “today,” analytics date grouping, and habit/progress validation. Project deadlines are date-only.

## Derived data

Dashboard counts and charts derive from saved records. Project progress counts completed top-level tasks, excluding checklists. An open recurring series remains an open project task; occurrence completions contribute to activity and action goals. Count and percentage goals sum entered progress; milestone goals count actual completed milestones; action goals count linked project tasks, recurring completions, and habit entries within the goal date range.

Habit streaks count scheduled days or successful ISO weeks. Unscheduled days do not break a daily streak. The current incomplete day/week does not break a streak until it has passed. Weekly target statistics cap credit at the target; duplicate check-ins are prohibited. Habit weeks remain Monday-based even when calendar display starts Sunday. Editing a habit changes how its existing history is interpreted.

## Reliability and payloads

Client writes update displayed data only after successful persistence. Note autosaves are debounced and serialized, track versions, preserve the draft on failure, and warn on unsaved navigation. Calendar, notes, analytics, goals, habits, and settings are loaded on demand; charts are dynamically imported. Fonts are bundled locally. There are no external scripts, images, analytics, AI calls, paid APIs, or remote font dependencies. A manifest and icon establish a responsive PWA foundation; offline service workers and push delivery are not implemented.
