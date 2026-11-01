# Prompt for Claude Design

Paste everything between the lines into Claude Design, and attach the files listed at the end.

---

You are the lead product designer for **Pericope ERM**, an enterprise risk management (GRC) web app used by risk teams, auditors and executives at regulated companies. I'm attaching:
- **`PRODUCT_BRIEF.md`**: the product, users, roles, domain rules and constraints.
- **`screenshots/`**: 28 screenshots of the current app with realistic data. Use them as a content inventory, not as a style reference.
- **The current code-level design inputs** (`globals.css`, `components.json`, `risk.ts`, `kri.ts`, `pericope-sidebar.tsx`, `band-badge.tsx`, `data-state.tsx`).
- **`DESIGN.md`**: an earlier, unimplemented aesthetic idea.

Read the brief first.

## Goal

Design the complete visual system and the key screens for the redesign. The result must look like a best-in-class enterprise product, calm and precise, at the level of Linear, Stripe Dashboard and Vercel, with the information density of a professional risk tool. It must be **buildable directly** in our stack: Next.js 16, Tailwind CSS v4 CSS-variable tokens, shadcn/ui (New York) on Radix, Lucide icons and Recharts.

## Design system to use (decided; please follow)

1. **Foundation: shadcn/ui + Radix + Tailwind v4 tokens.**
   - Express everything as semantic CSS variables in **OKLCH**: background, foreground, card, muted, border, input, ring, primary, secondary, accent, destructive, sidebar-*, chart-1…5.
   - Add our own semantic tokens:
     - `--risk-low`, `--risk-moderate`, `--risk-high`, `--risk-critical`, `--risk-unrated`, each with `-bg`, `-fg` and `-border` variants
     - `--kri-green`, `--kri-amber`, `--kri-red`
     - `--status-success`, `--status-warning`, `--status-danger`, `--status-info`
   - Provide **light and dark** values for every token.
   - Use the shadcn component set and tell me only how to style and compose it; don't invent new primitives unless needed.
2. **Data-dense enterprise patterns** in the spirit of IBM Carbon's data-table and dashboard guidance, rendered with the restraint of Linear:
   - two table densities (comfortable 44 px rows, compact 32 px)
   - tabular figures
   - a clear type scale
   - an 8 px spacing grid (4 px half-steps)
   - one radius scale
   - one elevation scale
3. **Type:** Inter for UI and figures (`tabular-nums`), JetBrains Mono for record codes. Choose and justify a heading treatment: Inter Display or tighter tracking, or one display face if it really earns its place.
4. **Colour:**
   - a neutral slate base, one confident brand accent (propose one; we have none yet), and the semantic scales above
   - the risk scale must be **colour-blind safe and never colour-only** (always label or number, plus an icon or pattern where useful); check it against deuteranopia and protanopia
   - meet WCAG 2.2 AA contrast in both themes
5. **Charts:**
   - a chart palette, plus specs for the line chart with threshold reference lines (KRI), bar and stacked bars, the 5×5 heatmap, a sparkline, and a progress or bullet bar
   - minimal gridlines, direct labels where possible, and accessible tooltips

## Deliverables

**A. Design tokens.**
- A complete replacement for `styles/globals.css` (Tailwind v4 `@theme` + `:root` + `.dark`), ready to paste.
- Include the type scale, spacing, radius, shadows, focus ring, motion durations and easing, and `prefers-reduced-motion` handling.

**B. App shell.**
- A persistent, collapsible left sidebar grouped as in the brief (you may improve the grouping), showing role-aware items and the active state.
- A top bar with:
  - a ⌘K command palette that searches pages and records
  - the "Needs your attention" bell
  - an organisation name
  - a user menu
- Human-readable breadcrumbs (record names, not IDs).
- A visual **RCSA lifecycle stepper** (5 stages) used across the RCSA pages.
- Light/dark toggle, and density toggle.
- Mobile: bottom navigation or a drawer.

**C. Component specs** (states: default, hover, focus, active, disabled, loading, error), mapped to shadcn components:
- page header (title, description, primary and secondary actions)
- KPI / stat tile (value, delta, context line, link, loading and "not available" states)
- data table (toolbar with search, filter chips, column menu, density, export; sortable headers; sticky header; row actions; selection; pagination "1–25 of 230"; empty, loading-skeleton, error, "not set up in the database yet" states)
- **risk score badge** (inherent, residual, inherent→residual movement, "Not rated")
- **KRI status pill** and the **KRI card** (value, unit, trend vs previous, sparkline or line with thresholds, actions)
- **5×5 heatmap** (cell = count; colour by band; selected cell; axis labels; legend; unrated note)
- date-status chip (overdue, due soon, on track, never)
- approval status badge and the **workflow request card** (ordered steps timeline, Approve/Reject with reason, "why you can't act" message)
- forms in dialogs and sheets (labels, help text, inline validation, 1–5 rating selector with labels, money input with currency, date pickers)
- confirmation dialog (danger)
- toasts
- tabs and segmented controls
- avatar and user chip
- the audit "hash chain verified" badge
- sign-in page

**D. Key screens** (desktop 1440 px, light **and** dark; plus 390 px mobile for the first three):
1. Executive dashboard
2. Workflow approvals (inbox style: "Waiting for me" / "My requests" / "All")
3. KRIs (cards + history)
4. Risk register (the signature table, with filters and a risk detail side sheet)
5. Risk detail: one risk end to end (statement, owner, inherent → residual, applied controls, action plans, history)
6. Assessment cycle detail with the lifecycle stepper and progress
7. Heatmaps (inherent / residual / movement)
8. Control library
9. Vendor register
10. Settings (with the live band preview)
11. Audit trail
12. Sign-in

Also show how a Viewer sees the dashboard (no write actions), and the empty state of a brand-new install (nothing rated yet).

**E. Hand-off notes.**
- For each screen: the shadcn components used, token names, and responsive behaviour.
- A short "do / don't" list so the engineering team keeps everything consistent across all ~30 pages.

## Rules

- **Never invent data.** Use the realistic values from the screenshots. Show missing values as "—", "Not rated" or "Never tested". These are first-class states.
- **No marketing copy, no glassmorphism or gradient gimmicks, no decorative illustrations** in work screens. Personality comes from typography, spacing, precision and one accent colour.
- **Keep the product's real vocabulary:** RCSA, inherent / residual, likelihood × impact, KRI, control effectiveness, maker-checker, appetite / tolerance.
- **Explain key decisions briefly**: why this accent, this type scale, this table density, this navigation.

---

## Files to attach

Everything is in **`docs/design/`**: upload `PRODUCT_BRIEF.md`, the whole `screenshots/` folder and the whole `attachments/` folder. The `attachments/` folder holds copies of the code files below; the originals are at the paths shown.

| # | File (path in the repo) | Why Claude Design needs it |
|---|---|---|
| 1 | `docs/design/PRODUCT_BRIEF.md` | Product, users and roles, IA, domain rules, constraints, what's wrong today |
| 2 | `docs/design/screenshots/` (all 28 PNGs) | Real content and layout inventory for every key page, plus the current mobile view, sidebar and a form dialog |
| 3 | `styles/globals.css` | The current token file its output must replace (Tailwind v4 `@theme` format) |
| 4 | `components.json` | shadcn/ui configuration (New York style, CSS variables, Lucide) |
| 5 | `lib/risk.ts` | Exact scoring rules, bands, likelihood/impact labels |
| 6 | `lib/kri.ts` | KRI traffic-light logic, directions, status labels |
| 7 | `components/pericope-sidebar.tsx` | Current navigation structure and role-gated items |
| 8 | `components/band-badge.tsx` and `components/data-state.tsx` | The score badge and the loading / error / empty / not-set-up states every page uses |
| 9 | `.stitch/DESIGN.md` | The earlier aesthetic direction (optional inspiration, not binding) |

Optional, if Claude Design accepts more files: `components/pages/dashboard.tsx` and `components/pages/workflow.tsx`, to show exactly which data each tile and card has.

**After the design comes back,** bring the tokens file and the screen designs here and say **"Do Phase 3"**. I'll implement them across all pages.
