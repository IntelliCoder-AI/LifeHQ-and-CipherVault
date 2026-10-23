# The Modern Personal Atelier

The interface combines editorial headings with a restrained working canvas. Overview is a composed daily brief; tasks use compact lists, the calendar a dated grid, notes a reading/writing split, and the vault a precise collection/detail layout. There are no decorative dashboard metrics.

## Foundations

Tokens live in `packages/ui/styles.css`. DM Sans is the readable interface face; Newsreader provides editorial headings and occasional italic emphasis. Both are bundled open-source fonts; no remote font requests occur. Lucide supplies consistent outlined icons. Layouts use whitespace, rules, and a small number of raised surfaces rather than uniform cards everywhere.

| Token | Light | Dark |
| --- | --- | --- |
| Paper | `#faf7f2` | `#49324a` |
| Surface | `#fffdf9` | `#563c53` |
| Ink | `#563b4b` | `#fff4e7` |
| Muted text | `#755f6c` | `#e5cedb` |
| Primary accent | `#80506b` | `#f2d6b3` |
| Stone | `#eee4e5` | `#65495f` |
| Brass accent | `#866030` | `#efd2a9` |

Warm ivory, rosewood, plum, and brass replace the green palette. The evening theme uses visibly plum surfaces. Existing project color IDs remain compatible with saved records, while their displayed labels and colors use the new palette. Small-text accents meet the automated contrast checks; completed calendar items use solid readable text and strikethrough. Themes are purposefully composed, not inverted.

Interface text is generally 16–18px, secondary labels 14–15px, and editorial panel headings 31px. Mobile layouts reflow around the larger type. Fonts remain locally bundled.

## Components and behavior

`packages/ui` implements customized shadcn-style primitives using Radix Dialog/Slot, class-variance-authority, and Tailwind utilities. Buttons have explicit primary, secondary, ghost, and destructive roles. Fields associate labels and hints with native controls. Dialogs have accessible names, trapped focus, Escape behavior, and focus restoration. Progress indicators expose actual numeric values. Empty states explain the next useful action.

Destructive record actions use explicit confirmation. Account deletion additionally requires a password and typed phrase. Vault backup replacement requires authentication and acknowledgement. Save states distinguish pending, saved, and failed; note drafts remain editable after failures.

Desktop uses a 260px scrollable sidebar and a generous content canvas. Tablet reduces density and stacks panels. Mobile uses a navigation dialog, stacked dashboard sections, reflowed task controls, and single-column note/vault detail views. Calendar week/month grids have compact entries with an editable alternative; the day view is preferable for detailed mobile planning. No interaction depends solely on hover or drag.

Focus uses a visible accent outline. Motion is short and limited to state transitions; reduced-motion preferences disable it. Charts avoid entry animations and expose a data table. Informational status is conveyed with text as well as color.

## Visual evidence

`docs/screenshots/` contains browser captures at 1440, 768, and 390 pixels for all ten LifeHQ sections (including the CipherVault access guide) and vault setup/unlocked layouts. These use clearly labeled sample records or dummy vault data. Automated overflow and selected accessibility checks accompany the screenshots. Visual inspection and accessibility results are recorded in [TESTING.md](TESTING.md); neither screenshots nor automated scans alone establish complete accessibility compliance.
