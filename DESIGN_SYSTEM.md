# The Modern Personal Atelier

The interface combines editorial headings with a restrained working canvas. Overview is a composed daily brief; tasks use compact lists, the calendar a dated grid, notes a reading/writing split, and the vault a precise collection/detail layout. There are no decorative dashboard metrics.

## Foundations

Tokens live in `packages/ui/styles.css`. DM Sans is the readable interface face; Newsreader provides editorial headings and occasional italic emphasis. Both are bundled open-source fonts; no remote font requests occur. Lucide supplies consistent outlined icons. Layouts use whitespace, rules, and a small number of raised surfaces rather than uniform cards everywhere.

| Token | Light | Dark |
| --- | --- | --- |
| Paper | `#f6f4ee` | `#171f1d` |
| Surface | `#fffefb` | `#1d2925` |
| Ink | `#202a27` | `#f0efe5` |
| Muted text | `#56635b` | `#adbab0` |
| Forest | `#365b50` | `#a7c7b0` |
| Stone | `#e9e5dd` | `#29352f` |
| Copper text/accent | `#854b2f` | `#e0b08e` |

Copper was darkened from the specification's inspiration color to improve small-text contrast. Sage text has a separate dark-theme value. Completed calendar items use solid readable text and strikethrough, not faded opacity. Themes are purposefully composed, not inverted.

## Components and behavior

`packages/ui` implements customized shadcn-style primitives using Radix Dialog/Slot, class-variance-authority, and Tailwind utilities. Buttons have explicit primary, secondary, ghost, and destructive roles. Fields associate labels and hints with native controls. Dialogs have accessible names, trapped focus, Escape behavior, and focus restoration. Progress indicators expose actual numeric values. Empty states explain the next useful action.

Destructive record actions use explicit confirmation. Account deletion additionally requires a password and typed phrase. Vault backup replacement requires authentication and acknowledgement. Save states distinguish pending, saved, and failed; note drafts remain editable after failures.

Desktop uses a 238px sidebar and a generous content canvas. Tablet reduces density and stacks panels. Mobile uses a navigation dialog, stacked dashboard sections, reflowed task controls, and single-column note/vault detail views. Calendar week/month grids have compact entries with an editable alternative; the day view is preferable for detailed mobile planning. No interaction depends solely on hover or drag.

Focus uses a visible accent outline. Motion is short and limited to state transitions; reduced-motion preferences disable it. Charts avoid entry animations and expose a data table. Informational status is conveyed with text as well as color.

## Visual evidence

`docs/screenshots/` contains browser captures at 1440, 768, and 390 pixels for all nine LifeHQ sections and vault setup/unlocked layouts. These use clearly labeled sample records or dummy vault data. Automated overflow and selected accessibility checks accompany the screenshots. Visual inspection and accessibility results are recorded in [TESTING.md](TESTING.md); neither screenshots nor automated scans alone establish complete accessibility compliance.
