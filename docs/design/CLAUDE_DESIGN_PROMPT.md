# Prompt for Claude Design

Paste everything between the two lines into Claude Design. Attach `PRODUCT_BRIEF.md`, the whole `screenshots/` folder and the whole `attachments/` folder (all in `docs/design/`).

---

# Pericope ERM: design a world-class risk platform

You are a principal product designer, the calibre that designed Linear, Stripe Dashboard, Vercel, Mercury, Ramp and Bloomberg's modern terminal. You're redesigning **Pericope ERM**, an enterprise risk management (GRC) platform used by risk teams, auditors and boards at banks and regulated companies.

**The bar:** if a Head of Risk sees this next to ServiceNow IRM, Archer, MetricStream and AuditBoard, they should feel the others are a decade old. If a designer sees it, they should want to put it in their portfolio. "Clean and fine" is a failure. I want **beautiful, distinctive and unmistakably premium**, while staying calm, trustworthy and dense enough for professionals who live in it all day.

Read the attachments first:
- **`PRODUCT_BRIEF.md`:** users, roles, every page, the domain rules (likelihood × impact scoring, inherent vs residual, KRI thresholds, maker-checker approvals) and the technical constraints.
- **`screenshots/` (28):** the current app with real data. They show the *content* each screen must hold. Their look is the "before". Don't inherit it.
- **`attachments/`:** the current Tailwind v4 token file to replace (`globals.css`), the shadcn config, the exact scoring and KRI rules (`risk.ts`, `kri.ts`), the navigation, the score badge, the loading/empty/error states, two full pages for data reference, and an earlier aesthetic idea (`DESIGN-earlier-idea.md`, optional).

## How to work (this matters more than anything else)

**Step 1. Three art directions.** Before designing screens, propose **three genuinely different art directions**. Each one gets:
- a name and a one-line idea
- a mood: palette swatches (light and dark), type pairing, surface/elevation approach, data-viz style
- the **same executive dashboard** rendered at 1440 px

Make them truly distinct, not three shades of blue. Examples of the range I mean (don't copy these):
- **"Swiss audit ledger":** paper-white, ink-black type, hairline rules, one signal colour, typographic hierarchy doing all the work.
- **"Night operations":** dark-first, deep blue-black graphite, luminous data, precise glows only on live signals.
- **"Private bank":** warm stone neutrals, deep green or oxblood accent, editorial serif display figures, very quiet chrome.

Recommend one, say why it fits a risk product used by boards and auditors, then continue with it. Keep the others as an appendix.

**Step 2. Refine the chosen direction into a full system and the key screens**, as specified below.

**Step 3. Critique and raise the bar.**
- Before finishing, review every screen against the **Mediocre vs excellent** checklist below, and fix every "mediocre" you find.
- Then do one more pass, asking: *what would make a designer stop scrolling on this screen?* Add that one signature detail per key screen.

## The visual ambition: what "best" means here

**Typography as the main event**
- **Large tabular numerals:** big, confident figures for KPIs (e.g. 40–56 px) with a refined numeric font. Consider a display face for figures and headings (for example Inter Display, Geist, Söhne-like grotesques, or a high-contrast serif for numbers if your direction calls for it). Inter stays for dense UI text and JetBrains Mono for codes like `CTL-IT-AUTH-01`.
- **A real type scale** with clear contrast between page title, section title, label, body and caption. Use optical tracking on large sizes. Make figures always `tabular-nums`, and right-align numeric columns.

**Colour with intent**
- **A neutral system with real depth:** tinted neutrals, not flat grey. Use **one** signature accent you can recognise in a thumbnail.
- **The risk scale:**
  - Low → Moderate → High → Critical must be the most beautiful, legible scale in the product.
  - Perceptually even (OKLCH), colour-blind safe, and **never colour-only**: always number or label, plus a shape or icon cue.
  - It must look as good in dark mode as in light.
- **Semantic colours** (success, warning, danger, info) that harmonise with the accent rather than being stock Tailwind.

**Surfaces, depth and detail**
- **Layered surfaces:** page → panel → raised element. Use subtle tonal steps, hairline borders (0.5–1 px at low alpha), and soft multi-layer shadows only where something truly floats (menus, sheets, popovers).
- **Crafted details:** inner highlights on primary buttons, a beautiful focus ring, considered radius (pick one scale and keep it), and pixel-perfect alignment to a 4/8 px grid.
- **No gimmicks:** no glassmorphism blur on work surfaces, no neon gradients, no stock illustrations, no emoji. Premium comes from restraint and precision.

**Data visualisation that people screenshot for board packs**
- **The 5×5 heatmap is the hero visual of the product.** Make it stunning. Its parts:
  - a cell colour ramp
  - risk counts as large figures, with each cell's score in small type
  - a clear selected/hover state
  - elegant axis labels (1 · Rare … 5 · Almost certain; 1 · Insignificant … 5 · Severe)
  - an **inherent → residual** mode that shows movement, with arrows, ghosted origin cells or small multiples
- **KRI cards:** a line chart with shaded green/amber/red threshold bands (not just lines), the latest point emphasised, the delta vs the previous reading with direction-aware colour, and a sparkline variant for compact lists.
- **Dashboard charts:**
  - minimal gridlines, direct labels instead of legends where possible, and a beautiful tooltip
  - bullet charts for "exposure vs appetite"
  - progress rings or bars for cycle completion
  - stacked bars for inherent vs residual by band
- **A chart palette** that works in both themes and with the risk scale.

**Motion (subtle, purposeful)**
- 150–250 ms ease-out transitions, numbers that count up once on first load, smooth sheet and dialog entrances, skeletons that shimmer gently, and full respect for `prefers-reduced-motion`.
- Specify the durations and easing as tokens.

**Iconography**
- Lucide, one consistent stroke (1.5 px), sized to the type scale. Icons support labels; they never replace them in navigation.

## Signature screens (where the "wow" must land)

Design these at **1440 px in light AND dark**, with real content from the screenshots:

1. **Executive dashboard.** The cover of the product. Show:
   - a headline row with the 4 most important figures: active risks, high/critical, control coverage, approvals waiting for me
   - the hero heatmap
   - a "what changed / needs attention" stream: KRI breaches, overdue action plans, approvals
   - exposure vs appetite by category as bullet charts
   - inherent vs residual by band
   - new risks over time

   It must read in 5 seconds from across a boardroom and still reward a close look.
2. **Risk register.** The signature work table. It needs:
   - a toolbar with search, filter chips, saved views, a density toggle, columns and export
   - sticky header, inherent and residual score badges with a movement arrow, owner avatars, and approval status
   - inline "Not rated, rate now" affordances
   - pagination
   - a **risk detail side sheet** that opens over the table (statement, ratings, controls, action plans, history)
3. **Risk detail, full page.** One risk end to end: statement, owner, inherent → residual journey (a visual that shows the reduction), applied controls with effectiveness, action plans with progress, approval history, and audit timeline.
4. **Workflow approvals.** An inbox-style layout ("Waiting for me" / "My requests" / "All"). Request cards show an elegant ordered-steps timeline and Approve / Reject (with a required reason). When the user can't act, a graceful "why not" message appears (e.g. "You submitted this request").
5. **KRIs.** A grid of KRI cards with threshold bands, one card expanded into a detail view with the full history, and a "Record reading" flow.
6. **Heatmaps.** Full page: inherent / residual / movement modes, the selected-cell drill-down list, and the unrated-risks callout.

Then, in the same system (desktop light, plus dark for at least two): assessment cycle detail with the **5-stage RCSA lifecycle stepper**, control library, vendor register, settings (with live band preview), audit trail (with the "hash chain verified" seal), and sign-in. The sign-in page is a chance for a quiet brand moment.

**Mobile at 390 px** for the dashboard, approving a workflow request, and recording a KRI reading.

**Edge states that make or break quality:**
- a **brand-new install** (nothing rated, empty tables): elegant, guiding empty states with a clear first action
- the **read-only Viewer** dashboard (no write actions, still rich)
- loading skeletons
- an error with retry
- "This module isn't set up in the database yet"
- a long risk statement that truncates gracefully
- a table with 2,000 rows

## The system you must deliver

**A. Tokens.** A complete, paste-ready replacement for `styles/globals.css`:
- Tailwind v4 `@theme`, `:root` and `.dark`, all colours in **OKLCH**.
- shadcn semantic tokens: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, sidebar-*, chart-1…5.
- Our tokens: `--risk-{low|moderate|high|critical|unrated}` with `-bg`/`-fg`/`-border`, `--kri-{green|amber|red}`, and `--status-{success|warning|danger|info}`.
- The type scale, spacing, radius, shadows/elevation, focus ring, motion duration and easing, and reduced-motion overrides.

**B. App shell.**
- A **persistent, collapsible sidebar**: grouped, role-aware, with active and hover states and a collapsed icon rail.
- A top bar with:
  - a **⌘K command palette** (pages, records, actions)
  - the "Needs your attention" bell with grouped items
  - the organisation name
  - a user menu (change password, theme, density, sign out)
- Readable breadcrumbs (record names, never IDs).
- The **RCSA lifecycle stepper** (5 stages) with progress.
- A mobile pattern (bottom bar or drawer).

**C. Components**, each with states (default, hover, focus, active, disabled, loading, error) and mapped to shadcn/ui:
- page header
- KPI tile (value, delta, context, sparkline, loading, "not available")
- data table (full toolbar, two densities: 44 px and 32 px rows)
- **risk score badge** (inherent, residual, movement, not rated)
- KRI status pill and KRI card
- heatmap
- date-status chip (overdue, due soon, on track, never)
- approval badge and workflow card
- forms in dialogs and sheets: the 1–5 rating selector with labels, a money input with currency, date pickers, and inline validation
- danger confirmation
- toasts
- tabs and segmented controls
- avatars
- empty states
- the audit seal
- sign-in

**D. Hand-off.** For each screen: the components used, token names and responsive behaviour. Add a one-page **do / don't** guide so engineers keep 30+ pages consistent. Use React + Tailwind + shadcn code where you can, so we can lift it directly.

## Mediocre vs excellent (self-check every screen)

| Mediocre (reject) | Excellent (aim) |
|---|---|
| Every card the same weight; a grid of equal tiles | Clear hierarchy: one hero, supporting tiles, secondary detail |
| Grey everything, stock Tailwind blue | Tinted neutrals and one memorable accent |
| 12 px text everywhere, tiny KPIs | Confident type scale, big tabular figures, comfortable reading sizes |
| Heavy borders around every box | Tonal layers, hairlines, generous but purposeful whitespace |
| Charts with legends, gridlines and default colours | Direct labels, threshold bands, palette tuned to the system |
| Red/green only for risk | A perceptual, colour-blind-safe scale with labels and shape cues |
| Empty states that say "No data" | Empty states that explain, guide and offer the first action |
| Dark mode as inverted colours | Dark mode designed on purpose, with its own elevation logic |
| Icons replacing words in navigation | Icons supporting clear labels |
| Hover-only actions, tiny targets | Visible actions, 32–44 px targets, obvious focus rings |
| Decoration added to look premium | Premium through precision, alignment and restraint |

## Non-negotiables

- **Never invent data.** Use the real values from the screenshots. "—", "Not rated" and "Never tested" are first-class, well-designed states.
- **Accessibility:** WCAG 2.2 AA contrast in both themes, full keyboard support, visible focus, nothing colour-only, and reduced-motion support.
- **Buildable in our stack:** Next.js 16, Tailwind v4 CSS variables, shadcn/ui (New York) on Radix, Lucide, Recharts.
- **Domain vocabulary:** use the product's real terms: RCSA, inherent / residual, likelihood × impact, KRI, control effectiveness, maker-checker, appetite / tolerance. No marketing copy inside the product.
- **Explain your key decisions in a few lines:** the accent, the type pairing, the heatmap treatment, the navigation, the table density.

---

## Files to attach (all in `docs/design/`)

| File | Why |
|---|---|
| `PRODUCT_BRIEF.md` | Users, roles, every page, domain rules, constraints, what's wrong today |
| `screenshots/` (28 PNGs) | Real content of every key page, plus mobile, navigation and a form |
| `attachments/globals.css` | The token file the design must replace |
| `attachments/components.json` | shadcn/ui setup (New York, CSS variables, Lucide) |
| `attachments/risk.ts`, `attachments/kri.ts` | Exact scoring bands, labels and KRI logic |
| `attachments/pericope-sidebar.tsx` | Current navigation and role-gated items |
| `attachments/band-badge.tsx`, `attachments/data-state.tsx` | The score badge and the shared loading / empty / error states |
| `attachments/dashboard.tsx`, `attachments/workflow.tsx` | The data available to each dashboard tile and workflow card |
| `attachments/DESIGN-earlier-idea.md` | An earlier aesthetic idea (optional inspiration) |

**Tips for the best result**
- If Claude Design asks you to choose between its three art directions, pick the one that feels most distinctive, not the safest. You can ask it to tone it down later; it's much harder to make a safe design exciting.
- Ask for the dashboard and heatmap first, iterate until they're stunning, then let it roll the system out to the rest.
- When you're happy, bring the tokens file and screen designs back here and say **"Do Phase 3"**, and I'll implement them across all pages.
