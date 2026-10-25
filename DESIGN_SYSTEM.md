# The Modern Personal Atelier

The interface combines editorial headings with a restrained working canvas. Overview is a composed daily brief; tasks use compact lists, the calendar a dated grid, notes a reading/writing split, and the vault a precise collection/detail layout. There are no decorative dashboard metrics.

## Foundations

Shared primitives live in `packages/ui/styles.css`; LifeHQ owns its palette and typography in `apps/lifehq/app/styles.css`, while CipherVault owns its separate palette. LifeHQ uses locally bundled Manrope for its interface and headings, with 400/500/600/700 weights. CipherVault retains DM Sans. Lucide supplies consistent outlined icons. Layouts use whitespace, rules and a small number of raised surfaces.

| Token | Daylight | Moonlight |
| --- | --- | --- |
| Paper | `#f7f6f2` | `#393632` |
| Surface | `#fffefa` | `#45413c` |
| Ink | `#4b443e` | `#f5f2e9` |
| Muted text | `#6c6259` | `#d0c9bc` |
| Action accent | `#a34b1d` | `#edac72` |
| Stone | `#eae6df` | `#575148` |
| Sidebar | `#eeece5` | `#35322e` |

LifeHQ's Awwwards-inspired direction is documented in [the reference notes](docs/DESIGN_REFERENCES.md). Warm neutrals, simple white working cards and a single warm action color replace pastel fills and gradients. The header toggle changes appearance immediately; Settings supports system appearance. A nonce-authorized bootstrap applies saved appearance before first paint. Account preferences sync the workspace theme; login retains a nonsensitive device preference.

CipherVault owns separate sandstone/ochre tokens, geometric branding, sans-serif headings, and a standalone lock screen. LifeHQ links to a standalone product page that launches the independent web origin. No vault unlock screen, keys, or encrypted records live in LifeHQ.

Interface text is generally 16–18px, secondary labels 14–15px, and panel headings generally 26–31px. Mobile layouts reflow around the larger type. Fonts remain locally bundled.

## Components and behavior

`packages/ui` implements customized shadcn-style primitives using Radix Dialog/Slot, class-variance-authority, and Tailwind utilities. Buttons have explicit primary, secondary, ghost, and destructive roles. Fields associate labels and hints with native controls. Dialogs have accessible names, trapped focus, Escape behavior, and focus restoration. Progress indicators expose actual numeric values. Empty states explain the next useful action.

Destructive record actions use explicit confirmation. Account deletion additionally requires a password and typed phrase. Vault backup replacement requires authentication and acknowledgement. Save states distinguish pending, saved, and failed; note drafts remain editable after failures.

Desktop uses a 260px scrollable sidebar and a generous content canvas. Tablet reduces density and stacks panels. Mobile uses a navigation dialog, stacked dashboard sections, reflowed task controls, and single-column note/vault detail views. Calendar week/month grids have compact entries with an editable alternative; the day view is preferable for detailed mobile planning. No interaction depends solely on hover or drag.

Focus uses a visible accent outline. Motion is short and limited to state transitions; reduced-motion preferences disable it. Charts avoid entry animations and expose a data table. Informational status is conveyed with text as well as color.

## Visual evidence

`docs/screenshots/` contains browser captures at 1440, 768, and 390 pixels for all ten LifeHQ sections (including the CipherVault access guide) and vault setup/unlocked layouts. These use clearly labeled sample records or dummy vault data. Automated overflow and selected accessibility checks accompany the screenshots. Visual inspection and accessibility results are recorded in [TESTING.md](TESTING.md); neither screenshots nor automated scans alone establish complete accessibility compliance.

## Dark-mode refinement

LifeHQ’s Moonlight theme uses neutral warm-gray surfaces, cream text and restrained amber accents. Decorative dividers stay quiet; inputs and secondary actions use a higher-contrast control border. CipherVault retains its separate stone/champagne palette. Toasts use raised dark surfaces.

Visual verification includes empty and populated Overview screens, the vault setup, a selected dummy record, and the edit dialog at desktop and mobile sizes. The vault palette remains distinct from LifeHQ.
