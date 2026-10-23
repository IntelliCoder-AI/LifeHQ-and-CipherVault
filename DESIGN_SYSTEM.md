# The Modern Personal Atelier

The interface combines editorial headings with a restrained working canvas. Overview is a composed daily brief; tasks use compact lists, the calendar a dated grid, notes a reading/writing split, and the vault a precise collection/detail layout. There are no decorative dashboard metrics.

## Foundations

Tokens live in `packages/ui/styles.css`. DM Sans is the readable interface face; Newsreader provides editorial headings and occasional italic emphasis. Both are bundled open-source fonts; no remote font requests occur. Lucide supplies consistent outlined icons. Layouts use whitespace, rules, and a small number of raised surfaces rather than uniform cards everywhere.

| Token | Light | Dark |
| --- | --- | --- |
| Paper | `#faf8f4` | `#493f46` |
| Surface | `#fffefa` | `#594c55` |
| Ink | `#514237` | `#f4eef1` |
| Muted text | `#726354` | `#d9cdd4` |
| Primary accent | `#9b4935` | `#eac2b3` |
| Stone | `#eee8df` | `#63525c` |
| Brass accent | `#805e25` | `#d8c2a6` |

LifeHQ uses neutral ivory surfaces, warm brown text, and restrained terracotta accents. Navigation uses a subtle active background and a thin accent rule. Soft dusk is the evening theme. The header toggle changes light/dark appearance immediately; Settings also supports system appearance. A nonce-authorized bootstrap applies saved appearance before first paint. Account preferences sync the workspace theme; the login page retains a nonsensitive device preference.

CipherVault owns separate sandstone/ochre tokens, geometric branding, sans-serif headings, and a standalone lock screen. LifeHQ links to a standalone product page that launches the independent web origin. No vault unlock screen, keys, or encrypted records live in LifeHQ.

Interface text is generally 16–18px, secondary labels 14–15px, and editorial panel headings 31px. Mobile layouts reflow around the larger type. Fonts remain locally bundled.

## Components and behavior

`packages/ui` implements customized shadcn-style primitives using Radix Dialog/Slot, class-variance-authority, and Tailwind utilities. Buttons have explicit primary, secondary, ghost, and destructive roles. Fields associate labels and hints with native controls. Dialogs have accessible names, trapped focus, Escape behavior, and focus restoration. Progress indicators expose actual numeric values. Empty states explain the next useful action.

Destructive record actions use explicit confirmation. Account deletion additionally requires a password and typed phrase. Vault backup replacement requires authentication and acknowledgement. Save states distinguish pending, saved, and failed; note drafts remain editable after failures.

Desktop uses a 260px scrollable sidebar and a generous content canvas. Tablet reduces density and stacks panels. Mobile uses a navigation dialog, stacked dashboard sections, reflowed task controls, and single-column note/vault detail views. Calendar week/month grids have compact entries with an editable alternative; the day view is preferable for detailed mobile planning. No interaction depends solely on hover or drag.

Focus uses a visible accent outline. Motion is short and limited to state transitions; reduced-motion preferences disable it. Charts avoid entry animations and expose a data table. Informational status is conveyed with text as well as color.

## Visual evidence

`docs/screenshots/` contains browser captures at 1440, 768, and 390 pixels for all ten LifeHQ sections (including the CipherVault access guide) and vault setup/unlocked layouts. These use clearly labeled sample records or dummy vault data. Automated overflow and selected accessibility checks accompany the screenshots. Visual inspection and accessibility results are recorded in [TESTING.md](TESTING.md); neither screenshots nor automated scans alone establish complete accessibility compliance.

## Dark-mode refinement

Dark mode uses desaturated dusk surfaces and off-white text in LifeHQ, with muted stone/champagne tones in CipherVault. Decorative dividers stay quiet; form inputs and secondary actions have a separate higher-contrast control border. Toasts use raised dark surfaces, and the vault prototype notice uses neutral text instead of a large amber band. Light-mode tokens are unchanged.

Visual verification includes empty and populated Overview screens, the vault setup, a selected dummy record, and the edit dialog at desktop and mobile sizes. The vault palette remains distinct from LifeHQ.
