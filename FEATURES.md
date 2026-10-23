# Feature status

“Implemented” describes executable code. Hosted acceptance is a separate requirement; see [TESTING.md](TESTING.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

| Area | Implemented behavior | Qualification |
| --- | --- | --- |
| Authentication | Registration, login/logout, cookie refresh, email recovery, protected routes, profile preferences, self-deletion | Live email confirmation/recovery and return-after-sign-out still require hosted verification |
| Overview | Personalized date, priorities, schedule, upcoming dates, projects/goals/habits/notes, weekly chart, quick actions | Empty by default; sample data is opt-in and local-only |
| Planner | Day/week/month, time blocks, drag date move, accessible edit alternative, event CRUD, recurring task/event exceptions, completed task history | Local time displayed per item; no native push or background alerts |
| Tasks | CRUD, description, priority, categories/tags, project link, checklists, search/filter/sort, bulk status, list/board, overdue, completed archive | Complete repeated instances in the planner; one checklist nesting level |
| Projects | CRUD, accent styling, status/deadline, list/board task detail, progress, milestones, search, archive/restore | No shared-team collaboration |
| Goals | Counts, percentages, milestones, linked project/habit actions, dates, measured entries, reflections, history, completion/missed-date labels, archive | Progress is derived; no generated predictions or scores |
| Habits | Daily weekday schedules, weekly targets, dated check-ins, history calendar, current/longest streak, consistency, editing/archiving | Weekly statistics use ISO weeks; no future check-ins |
| Notes | Markdown edit/preview, serialized autosave, folders/tags, pins/favorites, search, recent order, duplicate/delete, project link, import/export | Raw HTML and remote images disabled; imports limited to 50 KB |
| Analytics/reviews | Week/month activity charts, chart data tables, trends, prior-period comparisons, project/goal/habit summaries, overdue counts, daily/weekly written review | Deleting source records also removes their contribution to derived analytics |
| Search | Ctrl/Cmd+K, records, navigation, quick creation, keyboard selection, focus handling, no-results | Searches the loaded personal workspace |
| Settings | Name, light/dark/system, timezone, date/time, week start, reminders, dashboard visibility/order, JSON export, account deletion | Reminders are visible in-app only; no email/push reminder service |
| Responsive/accessibility | Mobile navigation, responsive layouts, dialog focus, labels, reduced motion, chart alternatives | Automated checks are not a complete WCAG certification |
| CipherVault | Local setup/unlock/lock, inactivity, credential/secure-note CRUD, categories/favorites/search, generator, strength estimate, copy, encrypted backup/restore, passphrase change | Unaudited prototype, dummy credentials only; no synchronization or recovery service |

## Not claimed

- No offline account editing, service worker cache, push notifications, cross-device vault sync, collaboration, file attachments, or AI assistant.
- Clipboard clearing is best effort and browser-dependent. Strength feedback is a local heuristic, not a breach check or entropy guarantee.
- LifeHQ is not end-to-end encrypted: the database operator can access productivity records. Vault contents are separate and never sent to that database.
- No assertion that local-demo browser tests verify real Supabase registration, mail delivery, session return, or account data persistence.
- CipherVault is not a production-certified password manager and has not passed independent review.
