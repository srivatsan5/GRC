# Pericope ERM: product brief for the visual redesign (Phase 3)

## 1. What the product is

Pericope ERM is an **Enterprise Risk Management / GRC** web app for banks, financial services and other regulated mid-size companies. It replaces spreadsheets for:
- identifying risks and rating them
- recording the controls that reduce them
- tracking remediation
- monitoring key risk indicators
- managing vendors, incidents, business continuity, policies and approvals
- producing evidence for auditors and the board

**Tone:** trustworthy, precise, calm. Auditors and board members look at it, so nothing playful, no marketing language, and no decoration that competes with data. Think "Bloomberg-terminal clarity with Linear/Stripe polish", not "consumer SaaS".

**Data is real and often incomplete.** Many risks are not yet rated. Many fields are empty. The design must make "not rated", "—", "never tested" and "not set up yet" look intentional and helpful, never broken.

## 2. Users and roles

| Role | Typical person | Can do | Visits most |
|---|---|---|---|
| Administrator | Head of Risk / system owner | Everything, plus users and settings | Dashboard, Users, Settings, Audit trail |
| Risk Manager | 2nd-line risk team | Create, edit, delete, **approve / reject**, set risk appetite | Dashboard, Risk register, Heatmaps, Workflow, Reports |
| Assessor | 1st-line business owner | Create and edit; cannot approve or delete | Cycle they're assigned to, Risk register, Inherent assessment, Action plans |
| Auditor | Internal / external audit | Read everything plus the audit trail | Reports, Audit trail, Control library |
| Viewer | Executive / board member | Read only | Dashboard, Heatmaps, Reports |

The UI hides actions a role can't perform (the server enforces this too). Read-only roles should still get a beautiful, useful product. Design the empty-handed state: no "Add" buttons, but clear summaries.

## 3. Information architecture (today; you may restructure)

The current navigation is an overlay sidebar, closed by default. Please replace it with a better pattern.

- **Main:** Dashboard
- **RCSA** (Risk & Control Self-Assessment). It's a 5-stage lifecycle, and the stepper must show it:
  1. Assessment cycles (`/rcsa/provisioning`), then one cycle (`/rcsa/provisioning/:id`)
  2. Risk register (`/rcsa/identification`). This is the core, most-used table.
  3. Inherent assessment (`/assessments/inherent`): rate one risk's likelihood × impact before controls
  4. Controls & mitigation (`/rcsa/mitigation`). Each risk has an applied-controls page (`/rcsa/provisioning/:id/controls/:riskId`) where the **residual rating** is set.
  5. Monitoring (`/rcsa/monitoring`): action plans with % complete and due dates, with the hierarchy and action-plan list below it
- **Risk analytics:** Residual analysis, 5×5 Heatmaps, Assessment analytics, KRIs (cards + history chart), KRI matrix, KRI thresholds, Reports
- **Controls & policy:** Control library, Risk appetite, Workflow approvals, Policies
- **Enterprise risk:** Vendor risk (TPRM), Incidents, Business continuity (BCP), Scenario analysis, Business process library
- **Administration:** Audit trail, User management, Settings

There are about 30 pages. Global needs:
- search / ⌘K command palette
- a "Needs your attention" bell (approvals waiting for me, KRI breaches, overdue action plans)
- a user menu (change password, sign out)
- breadcrumbs

## 4. Domain rules the design must express

**Risk score** = likelihood (1–5) × impact (1–5), so 1–25.

| Band | Default score range | Notes |
|---|---|---|
| Low | 1–6 | |
| Moderate | 7–11 | |
| High | 12–15 | |
| Critical | 16–25 | |

- **Thresholds are configurable** in Settings, so never bake numbers into colours.
- **Labels.** Likelihood: Rare, Unlikely, Possible, Likely, Almost certain. Impact: Insignificant, Minor, Moderate, Major, Severe.
- **Inherent vs residual.** Every risk has an inherent score (before controls) and a residual score (after controls); either may be missing.
- **Score badge.** Show inherent → residual movement clearly. Today's badge reads "20 · Critical". Unrated risks show "Not rated". The badge appears everywhere: tables, heatmap cells, cards.
- **Colour.** The scale must be **colour-blind safe and never colour-only**: pair colour with the label or number, and an icon or shape where useful.

**KRIs (key risk indicators)** have green / amber / red thresholds and a direction: "higher is worse" or "lower is worse".
- The current value is the latest reading. Readings have dates, and history is a line chart with threshold reference lines.
- Status reads "Within appetite", "Warning" or "Breach".

**Approval workflow (maker-checker).** A request goes through ordered steps (each needs a role). The rules:
- You can't approve your own request.
- One person can't sign two steps.
- A rejection needs a comment.

When you can't act, the UI shows *why* (for example "You cannot approve a request you submitted"). Statuses: Pending, In Review, Approved, Rejected, Withdrawn.

**Approval status on records:** DRAFT, SUBMITTED, IN_REVIEW, PENDING, APPROVED, REJECTED. Editing an approved record sends it back to SUBMITTED.

**Dates drive status.** Statuses such as "Review overdue by 12 days", "Due in 5 days" and "Test overdue" are derived from dates and need consistent chips.

**Money** is shown in the organisation's currency (a setting: USD, EUR, GBP, INR, …), with compact forms ($1.7M) in tiles.

**Audit trail.** The log is hash-chained and tamper-evident, and shows a "Hash chain verified · N entries" badge. It should feel serious and trustworthy.

## 5. Data density

| Item | Typical | Largest |
|---|---|---|
| Risk register | 20–2,000 rows | 20,000 |
| Most other tables | 5–200 rows | |

Tables need:
- server-side search, sort and filter chips
- pagination ("1–25 of 230")
- row actions that are always visible (not hover-only), each with an `aria-label`
- sticky headers and column truncation with a tooltip
- bulk CSV export
- an empty state with an action
- loading skeletons, an error state with retry, and a "not set up in the database yet" state

The **risk register** and **KRI cards** are the two signature screens. The **dashboard** and **heatmap** are what executives see.

## 6. Technical constraints (the design must be buildable as-is)

- **Framework:** Next.js 16 (App Router) + React 19.
- **Styling and components:** Tailwind CSS v4 with CSS-variable tokens (`@theme` in `styles/globals.css`) and **shadcn/ui (New York style) on Radix primitives** (`components.json`). Icons are **Lucide**; charts are **Recharts**.
- **Fonts** are already wired: **Inter** for the UI (with `tabular-nums` for figures) and **JetBrains Mono** for IDs and codes such as `CTL-IT-AUTH-01`.
- **Theming:**
  - Light is the default.
  - **Dark mode is required.** `next-themes` is installed, but the app is currently forced to light.
  - Prefer **OKLCH** tokens.
- **Accessibility:** WCAG 2.2 AA (4.5:1 text contrast, visible focus rings, full keyboard support, reduced-motion support).
- **Responsive:** Desktop-first (1280–1600 px is the main use), fully usable at 1024 px, and readable on mobile at 390 px. On mobile the most important tasks are reading the dashboard, approving workflow requests and recording a KRI reading.
- **Brand:** No logo or brand colour exists yet; the current primary colour is corporate blue `#1e40af`. You may propose a brand mark and accent.

## 7. What is wrong with the current UI (see `screenshots/`)

The screenshots show real data after the data rebuild. Use them for **content and layout inventory, not style**.
- **Navigation:** the sidebar is an overlay hidden behind a hamburger; there is no persistent navigation and no sense of where you are in the 5-stage RCSA lifecycle.
- **Inconsistent patterns:**
  - Every page invents its own KPI tiles, filters, tables and dialogs.
  - Spacing, headings and type scale vary.
  - Two different steppers exist (4-step and 5-step).
- **Hierarchy and density:** visually flat, with small text (11–12 px), weak hierarchy, tables with no density options, and dashboard tiles that all look the same weight.
- **Colour:** the heatmap and band colours are ad hoc Tailwind shades.
- **Missing pieces:**
  - No dark mode.
  - Breadcrumbs show raw IDs ("Provisioning > 1083 > Controls > 1362").
  - The mobile layout is just a squeezed desktop, and tables overflow.
- **Earlier design idea** (`.stitch/DESIGN.md`, "Sentinel / The Pristine Auditor": indigo, Manrope, no-line surfaces, soft shadows): you may reuse what's good in it, but it was never implemented and is not binding.
