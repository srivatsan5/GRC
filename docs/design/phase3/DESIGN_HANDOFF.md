# Pericope ERM — Phase 3 design hand-off (Charter)

Status: **direction chosen, tokens final, dashboard and heatmap approved for build, risk register designed.**
Everything else in the brief (risk detail page, workflow, KRIs, heatmaps page, other screens, mobile, edge states) is still to design. Build those in this system, following the rules below.

Source of truth for visuals: the PNGs in `designs/` (light and dark). The standalone HTML pages in `designs/html/` open in any browser and show exact spacing and colours. Read their markup for measurements, but **do not copy their markup into the app**: build with shadcn/ui + Tailwind classes on the tokens in `app/globals.css`.

---

## 1. The direction: "Charter"

Three directions were explored (`designs/explored/`): Ledger (Swiss paper and ink), Nocturne (dark-first control room) and Charter. **Charter was chosen as the most distinctive**: no incumbent GRC tool (ServiceNow IRM, Archer, MetricStream, AuditBoard) looks like it.

- **Look:** warm stone page, ivory panels, one deep evergreen accent, editorial serif figures.
- **Fonts:**
  - **Newsreader** (serif) for display figures, page titles and panel titles **only**.
  - **Inter** for all UI, tables and forms.
  - **JetBrains Mono** for codes such as `CTL-IT-AUTH-01` and `RCSA-2026-010`.
- **Accent:** evergreen `--primary`, used for actions only: buttons, links, focus, the current nav item.
  - "Success" is a different, brighter leaf green that always carries a check icon.
  - Never use the accent to mean "good".
- **Dark mode ("humidor"):** warm charcoal with ivory text and a celadon accent.
  - It is designed separately, not inverted.
  - On dark the risk scale gets **brighter** as risk rises, so Critical is the brightest thing on screen.
  - Printing always uses the light tokens (handled in `globals.css`).

## 2. Install (in this order)

1. **Fonts.** Load Newsreader with `next/font/google` alongside Inter and JetBrains Mono, and expose the CSS variables `--font-inter`, `--font-newsreader` and `--font-jetbrains-mono` on `<html>`. Then delete the Google Fonts `@import` at the top of `globals.css`. Until then the `@import` works as-is.
   ```ts
   import { Inter, Newsreader, JetBrains_Mono } from 'next/font/google'
   const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
   const newsreader = Newsreader({ subsets: ['latin'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-newsreader' })
   const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })
   // <html className={`${inter.variable} ${newsreader.variable} ${mono.variable}`}>
   ```
2. **Replace `app/globals.css`** with the file in this bundle.
3. **Replace `lib/risk.ts`, `lib/kri.ts` and `components/band-badge.tsx`.**
   - Logic and exports are unchanged. `BAND_STYLES` and `LIGHT_STYLES` gain fields, and `BandBadge` keeps its `score` prop.
   - They are type-checked under `strict` and `noUncheckedIndexedAccess`.
4. **Theme.** In the `next-themes` provider set `attribute="class"`, `defaultTheme="light"` and `enableSystem={false}`, and remove the forced light theme. Put the theme switch in the user menu.
5. **Density.** Set `data-density="compact"` on `<html>` from the user menu (persist it per user). Every table and control reads `--row-height` (44 → 32 px), `--control-height` and `--badge-height`.
6. **Remove ad-hoc colours.** Search for `slate-`, `emerald-`, `amber-`, `orange-`, `red-`, `blue-` and `#` hex values in components and replace them with token classes. `data-state.tsx` and every page still use `slate-*`.

## 3. Tokens: how to use them

Every token is in `app/globals.css` and exposed as a Tailwind class.

### Colour

- **shadcn core:** `background`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar-*`, `chart-1…5`.
- **Extras:** `surface-sunken`, `surface-page`, `surface-raised`, `foreground-secondary`, `border-strong`, `hover`, `selection`, `chart-grid`, `chart-axis`.

### Risk bands

Each band (`low`, `moderate`, `high`, `critical`, `unrated`) has five tokens:

| Token | Use |
|---|---|
| `bg-risk-high` + `text-risk-high-fg` | Solid badge; occupied heatmap cell |
| `bg-risk-high-bg` + `text-risk-high-text` + `border-risk-high-border` | Soft badge; **empty** heatmap cell (with the score as text) |
| `text-risk-high-text` | Coloured text on a card or the page |
| `bg-risk-high` alone | Legend swatch, chart mark, bullet-chart zone |

- `-fg` is only for text on the solid fill. `-text` is for text on a wash, card or page.
- In dark mode `-fg` is dark text, so it fails on a wash.

### Status and KRI

- **Status:** `status-{success|warning|danger|info}` with `-fg` (text and icons) and `-bg` (wash). Always pair the colour with an icon:
  - success → `Check` / `CircleCheck`
  - warning → `TriangleAlert`
  - danger → `OctagonAlert`
  - info → `Info`
- **KRI:** `kri-{green|amber|red}` with `-fg` and `-bg`. `LIGHT_STYLES` already maps colour, icon and label.

### Other scales

- **Type scale:**
  - `text-caption` 12
  - `text-label` 12 caps (or the `label-caps` utility)
  - `text-body-sm` 13
  - `text-body` 14
  - `text-body-lg` 16
  - `text-section` 21, serif panel titles: `font-display text-section`
  - `text-title` 36 and `text-title-lg` 44, serif page titles
  - `text-figure-sm` 20
  - `text-figure` 40
  - `text-figure-lg` 64

  Use the `figure` utility for serif figures (lining, tabular). Figures are always `tabular-nums`, and numeric columns are right-aligned.
- **Radius:** `rounded-xs` 3 · `sm` 5 · `md` 8 · `lg` 12 · `xl` 16. Panels use `lg` and controls use `md`.
- **Elevation:** `shadow-panel` for cards, `shadow-raised`, `shadow-popover` for menus and popovers, `shadow-dialog` for sheets and dialogs, `shadow-button` for the primary button's inner highlight. shadcn's `shadow-xs/sm/md/lg` map to these. Only popovers, sheets and dialogs float.
- **Focus:** a 2 px `--ring` outline with 2 px offset, set in base. Use the `focus-ring` utility on custom controls such as heatmap cells and chips. Replace shadcn's default `focus-visible:ring-ring/50` where it looks weak; its contrast is not verified.
- **Motion:**
  - `--duration-fast` 150 / `base` 200 / `slow` 250 ms, with `ease-out` (`cubic-bezier(.2,0,0,1)`).
  - Animations: `animate-pop-in` (menus), `animate-dialog-in`, `animate-sheet-in`, `animate-toast-in`, `animate-shimmer` (skeletons).
  - KPI numbers count up once on first load over `--duration-count-up` (600 ms).
  - Everything turns off under `prefers-reduced-motion`.
- **Utilities:** `hatch` (the "Not rated" pattern), `skeleton`, `surface-panel`, `surface-raised`, `h-row`, `h-control`, `h-badge`.
- **Layout:** `--layout-sidebar-width` 248, `--layout-sidebar-rail` 64, `--layout-topbar-height` 60, `--layout-page-gutter` 40.

### Verification

- **Contrast:** 57 text pairs per theme pass WCAG AA (lowest 5.28:1 light, 4.51:1 dark). Input borders, focus and chart marks are at least 3:1. Every colour is inside the sRGB gamut.
- **Risk scale, colour-blind simulation** (minimum ΔE between adjacent bands):

  | Theme | Deuteranopia | Protanopia | Tritanopia |
  |---|---|---|---|
  | Light | 13.2 | 17.0 | 15.6 |
  | Dark | 9.5 | 5.5 | 7.1 |

  - The weakest pair is Moderate vs High in dark under protanopia.
  - It is acceptable because every band also shows its number and a 1–4 signal-bar glyph.
- **Build:** compiled with Tailwind 4.3.3.

## 4. App shell

- **Sidebar.** It is persistent and collapsible: 248 px expanded, 64 px icon rail when collapsed (with tooltips). It sits on `bg-sidebar` (stone), and the work area is an inset `bg-background` panel with `rounded-xl`.
  - **Groups:** Dashboard · RCSA lifecycle (numbered 1–5: Assessment cycles, Risk register, Inherent assessment, Controls & mitigation, Monitoring) · Analytics (Heatmaps, Residual analysis, Key risk indicators, Reports) · Controls & policy (Control library, Risk appetite, Approvals [count], Policies) · Enterprise risk (Vendors, Incidents, Business continuity, Scenarios) · Administration (Audit trail, Users, Settings).
  - **Role gating:** items are hidden by role, as in today's `pericope-sidebar.tsx`.
  - **Active item:** `bg-sidebar-accent` with `shadow-panel`.
- **Top bar** (60 px):
  - readable breadcrumbs that use record names, never IDs
  - a ⌘K search button that opens the command palette (pages, records, actions)
  - the organisation name
  - the "Needs your attention" bell, whose count = approvals waiting for me + KRI breaches + overdue action plans
  - the user menu: change password, theme, density, sign out
- **RCSA lifecycle stepper.** Five stages with live progress (see the register PNGs). The current stage is a raised card with a filled number; stages 3 and 4 show a progress bar.

## 5. Executive dashboard (approved)

PNGs: `charter-dashboard-light.png`, `charter-dashboard-dark.png`. Data comes from what `dashboard.tsx` already computes.

1. **Header.** A dateline in label caps ("SUNDAY, 1 NOVEMBER 2026 · LIVE REGISTER"), a serif `text-title-lg` title, and Export register (CSV) as a secondary button.
2. **Headline panel.** One `surface-panel` split into 4 cells by hairlines, not 4 cards.
   - Each cell has a label in caps, a serif `text-figure-lg` figure, a mini bar or badge, and a context line.
   - Active risks shows a rated vs not-rated split bar.
   - High & critical shows the figure in `text-risk-critical-text` plus a solid Critical badge.
   - Control coverage shows a primary progress bar.
   - Approvals waiting for me sits on a `bg-primary/8` tint with a Review button.
3. **Secondary strip.** Plain text, no cards: recorded SLE, open action plans (overdue count in danger), KRIs red/amber, open incidents.
4. **Hero row.**
   - **Left: the heatmap** (see §6).
   - **Right: Needs attention**, grouped as KRI breach / Overdue action plans / Approvals waiting for you.
     - **Only the KRI breach is loud:** a `bg-risk-critical-bg` tile with a 1 px `--risk-critical-text` keyline, a solid "Breach" badge with an octagon icon, the reading as a serif figure, the delta, and a threshold strip (green / amber / red zones with a marker at the reading).
     - Overdue plans and approvals are quiet rows. Overdue rows get a danger chip with a clock icon. Approval rows get a primary "Review" button.
5. **Bottom row** (flex: 1.4 / 1):
   - **Exposure vs appetite.** A bullet chart per category: band zones as washes on a 0–25 track, the tolerance as an ink tick, the tolerance as a soft badge, and current exposure.
     - When no rated risk is in a category, exposure is "—", never 0. Today all 8 categories show "—".
   - **Inherent and residual, by band.** Two 100% stacked bars with counts inside the segments, the Not rated segment hatched, and a swatch legend.
   - **New risks per month.** 12 columns in primary, a value label above each non-zero bar, zero months as a 1 px baseline tick, and a caption for undated risks.
6. **Mobile (390 px).** Panels stack; the headline cells become a 2×2 grid; the heatmap scrolls horizontally inside its panel; Needs attention comes directly after the headline figures.

## 6. Heatmap component (approved; reuse it everywhere)

- **Grid:** 5×5, likelihood 5 at the top, impact 1 on the left. Cells are about 76 px tall with a 4 px gap and `rounded-sm`.
- **Occupied cell:** `BAND_STYLES[b].solid` with the **count** as a serif figure (38 px) bottom-right and the **score** in 11 px top-left.
- **Empty cell:** `BAND_STYLES[b].cell` (the band wash) with the score only, so the zone shape stays visible without competing with real risks.
- **Axis labels:** the number in serif over the label ("5 / Almost certain", "1 / Insignificant"), plus small "Likelihood ↑ / Impact →" captions.
- **Interaction:**
  - Each cell is a `<button>` with an aria-label such as "Likely × Major, score 16, Critical, 1 risk".
  - Hover shows a 2 px ink inset. **Selected** shows a 2 px ink outline with a 2 px gap.
  - Arrow keys move between cells (roving tabindex).
- **Selection detail** sits in a strip **below** the grid, never as a floating tooltip over cells (that hid data). It shows the solid badge, the L × I label, the count, the reference and the statement, plus "Open risk →". When a cell holds several risks it becomes a short list (on the Heatmaps page, a side list).
- **Legend:** swatches with ranges taken from org settings (never hard-coded), plus the hatched "N not rated · Rate now".
- **Modes:** a segmented control (Inherent / Residual / Movement).
  - **Movement:** the inherent cell is a tinted outline, the residual cell is solid, and a dashed arrow joins them. The register's detail sheet shows the single-risk version.
  - For the full grid, draw arrows per risk with the opacity scaled to how many share a path.
- **Bands come from `useOrgSettings().bands`**, so changing thresholds in Settings recolours the grid.

## 7. Risk register (designed)

PNGs: `charter-register-light.png`, `-light-sheet.png`, `-dark-compact.png`, `-dark-sheet.png`.

- **Page:** the lifecycle stepper, a serif title, Import CSV (secondary) and Add risk (primary).
- **Saved views** (tabs with counts): All risks · Needs rating · Awaiting approval · Draft · Approved · + Save view.
- **Toolbar:** search (statement, reference, owner), filter chips (Inherent, Residual, Process, Cycle, Owner, + Filter) and, on the right, the density switch, Columns (shows "8 of 9"; Category is hidden by default because it has no values), and Export CSV.
- **Unrated callout:** "11 of 25 risks have no inherent rating, so they are missing from heatmaps and band totals." with a "Show the 11" button (applies the Needs rating view).
- **Table:** use the shadcn Table, which keeps the legacy `.enterprise-table` styling.
  - The header row stays pinned while the table scrolls. The table scrolls inside the panel and the pagination footer stays fixed.
  - **Columns:** checkbox · Risk (statement + mono reference · process, truncated with a tooltip) · Owner (initials avatar + name, or "Assign owner") · Cycle (mono link) · Inherent (solid badge, or "Not rated" + "Rate now") · Residual (`RiskMovement`: badge + ↓delta, or "Not rated" + "Rate" when inherent exists) · SLE (right-aligned) · Approval (status with icon: Draft / Submitted / Approved) · Created · actions (Assess + a "More" menu with Controls, Edit, Delete). Actions are always visible and each has an aria-label.
  - **Compact:** single-line rows; the reference sits inline after the statement, the process line hides, and badges show the number only.
  - **The selected row** gets `bg-accent` and a 3 px primary bar on the left.
- **Approve and Reject are no longer on table rows.**
  - They live in the detail sheet footer and on the Workflow page, where a rejection reason is required.
  - Bulk approve (rows selected → action bar) is allowed for users who can decide.
- **Detail sheet:** 560 px, floating inset 8 px, `rounded-xl`, `shadow-dialog`, over a scrim. The scrim and sheet sit above the pinned table header. The sheet contains:
  - **Header:** mono reference + approval status, previous/next risk, "Full page", close; the statement as a serif title; owner / cycle / process / SLE as a definition list.
  - **Inherent → residual:** a 5×5 mini grid (Movement mode), solid badges with their L × I labels, and the reduction as a serif figure ("14 points lower after controls").
  - **Controls:** each control as a card with name, code, type, frequency, Design and Operating effectiveness chips, evidence and test status; plus "Apply control".
  - **Action plans:** title, owner, progress bar, due date and an overdue chip.
  - **Approval:** current status, history as an ordered-steps timeline, the maker-checker rules as a caption, and a link to the audit trail.
  - **Footer:** Edit, plus the primary action for the current status (Submit for approval / Approve + Reject with a required reason).
- **2,000+ rows:** server-side pagination (25/50/100), the header pinned, row heights fixed. Virtualise only if a page size above 100 is allowed.

## 8. Data rules (non-negotiable)

- **Never invent data.** "—", "Not rated", "Never tested", "Not assigned" and "No statement recorded" are designed states.
- **Show odd stored values as-is.** References such as `-2026-002` and `VM--002`, and cycle `#1`, exist in the data today; flag them in a data-quality view rather than hiding them.
- **Money** uses `useOrgSettings().money`, with the compact form in tiles ($1.7M).
- **Placeholder:** the organisation name is a placeholder in the designs (`[Organisation name]`). Wire it to settings.

## 9. Do / don't

| Do | Don't |
|---|---|
| Use token classes (`bg-risk-high`, `text-status-danger-fg`) | Use Tailwind palette colours (`red-600`) or hex values |
| Pair every risk or status colour with a number, label or icon | Use colour alone, or red/green alone |
| Use the serif for figures and titles only | Use the serif in tables, forms or buttons |
| Keep one hero per screen; supporting panels are quieter | Make every card the same weight |
| Make "Not rated" hatched with an action next to it | Show a grey "N/A" or a 0 |
| Keep row actions visible, with aria-labels, 32–44 px targets | Show actions only on hover, or use icon-only nav |
| Put drill-down below or beside a chart | Float tooltips over the data they describe |
| Use evergreen for actions and leaf green with a check for success | Use the accent to mean "good" |
| Respect `prefers-reduced-motion` and the density setting | Hard-code row heights or durations |

## 10. Open items for Phase 3

- **Screens not yet designed:**
  - risk detail full page
  - workflow inbox
  - KRI cards + detail + Record reading
  - Heatmaps page
  - assessment cycle detail
  - control library, vendors, settings (live band preview), audit trail (hash-chain seal)
  - sign-in
  - mobile: dashboard, approve, record a KRI reading
- **Edge states still to design:**
  - new install with no data
  - read-only Viewer dashboard
  - skeletons, error with retry, "module not set up"
  - long statements
  - a 2,000-row table
- **To confirm with the product owner:** removing row-level Approve/Reject from the register, and hiding the empty Category column by default.
