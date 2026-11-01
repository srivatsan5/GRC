# Phase 3: The Charter design, connected end to end

This follows [CHANGES_PHASE_2.md](CHANGES_PHASE_2.md). The design came from Claude Design: the hand-off spec, token file and reference screens are in [`docs/design/phase3/`](docs/design/phase3/).

**In one line:** every screen has been rebuilt in the Charter design system, and each one still reads and writes real data through the existing API. The database is unchanged in this phase.

## ⚠️ What you need to do

Nothing new: no migrations and no new environment variables. Rebuild and redeploy **both** the web app (`npm run build`) and the API (`cd api && npm run build`). The API has two small additions, listed under "Fixes from the independent review".

## Design foundation

| Area | What changed |
|---|---|
| Tokens (`app/globals.css`) | Charter OKLCH palette with a light theme and a designed dark theme. Risk-band, status and KRI tokens; a named type scale (`text-caption` … `text-figure-lg`); panel and raised surfaces; row and control heights; hatched "not rated" fill |
| Fonts (`app/layout.tsx`) | Self-hosted with `next/font`: Newsreader (titles and figures), Inter (UI), JetBrains Mono (codes) |
| Theme and density | Light / dark from the user menu (next-themes). Comfortable / compact density stored per user |
| `cn()` (`lib/utils.ts`) | Knows the Charter font-size and shadow tokens, so they are no longer dropped when classes merge |
| Print | A4 board-pack layout. Always prints on white paper, even in dark theme |

## App shell (`components/shell/`)

- **Sidebar** grouped by the RCSA lifecycle, collapsible to a 64 px rail, with a live approvals count. It becomes a drawer on mobile.
- **⌘K command palette** searches records (risks, controls, KRIs, vendors, policies, incidents) as well as pages and actions.
- **Breadcrumbs** show record names, not IDs.
- **Attention bell** lists real items: KRI breaches, overdue actions and approvals waiting for you.
- **User menu** holds theme, density, change password and sign out.

## Shared components

- `components/charter/`: page header, panels, headline figures, meters, segmented controls, view tabs, filter chips, due-date chips, approval badges, people, fact lists and callouts.
  - The **risk heatmap** has Inherent / Residual / Movement modes, keyboard navigation and movement arrows.
  - The **lifecycle stepper** shows live progress for each RCSA stage.
- `components/band-badge.tsx`: `BandBadge`, `RiskMovement` and `BandPips`. Every risk score uses the same band colours and a "Not rated · Rate" state.
- `components/ui/*` restyled to tokens: buttons, inputs, dialogs, the floating side sheet, menus, toasts and others. Unused legacy components were deleted.
- Loading, empty and error states are consistent, using skeletons and plain-English messages.

## Screens

| Group | Screens |
|---|---|
| Dashboard and analytics | Executive dashboard, heatmaps, residual analysis, assessment analytics, progress dashboard, risk overview, reports (6 reports, board-pack print, CSV) |
| RCSA lifecycle | Cycles and cycle detail, risk register (with a detail sheet), the new full risk page `/risks/[id]`, inherent assessment, controls and mitigation, monitoring, action plans, RCSA overview |
| Controls and policy | Control library, applied controls, control testing, policies, risk appetite, approvals inbox (maker-checker) |
| Enterprise risk | KRIs (register, configuration, matrix), vendors, incidents, business continuity, scenarios, process library |
| Administration | Audit trail with an integrity seal, users, settings, sign-in |

Old per-risk mitigation URLs (`/rcsa/mitigation/[id]`) now redirect to `/risks/[id]`.

## Fixes from the independent review

An independent review found no data-wiring mismatches against the API. It did confirm these behaviour bugs, all now fixed:

| Bug | Fix |
|---|---|
| A list could show "empty" after its last page's last row was deleted or approved away | Every paged list steps back to the new last page (`useClampPage` in `components/pager.tsx`) |
| ⌘K links to the page you were already on did nothing (`?q=`, `?new=1`, `?report=`) | Pages follow the query string with `useSearchParams`. The app shell now provides the Suspense boundary for this |
| The inherent assessment page kept showing the previous risk after the URL changed | `riskId` is read from the URL, and the form resets for each risk |
| "View in audit trail" opened the log unfiltered | The audit trail reads `?search=` |
| Assessors were shown "Unlink" buttons that the API refused, leaving stale control–risk links | **API:** link tables (`erm_lnk_*`) accept deletes from anyone who can edit (`deletePermission: 'update'`). The records themselves still need `delete` |
| A risk's approval history could miss entries for short ids | **API:** `/api/audit?entityId=` filters on the exact record id |
| Residual "rate" links went to the read-only analytics page, and viewers saw "Rate now" | Links go to Controls & mitigation and are shown only to editors |
| A reject reason typed for one risk carried over to the next in the detail sheet | The reason resets when the risk changes |
| Deleting a risk left the controls, plans and links that depended on it in the cache | Those tables refresh too |
| The stepper's "20 risks" and the register's "All risks 25" read as a contradiction | The stepper says "active risks". The register lists inactive risks as well |
| Minor issues | "Apply control" now needs create permission. A cycle can't be deleted before its risk count has loaded. Monitoring `?id=` links work more than once |

## Verification

- TypeScript has no errors (web and API). Lint is clean. The production build succeeds.
- API tests: 93 of 93 pass (2 new: link deletes by editors, exact audit record filter).
- `e2e/real-data.cjs`: 19 of 19 pass against the production build.
  - All 31 routes render with real data.
  - Settings currency, the cycle page, the KRI matrix, the maker-checker approval in the UI, the viewer being read-only, and the attention bell are all checked.
- `e2e/security.cjs`: 18 of 18 pass.
  - httpOnly session, password rules, approvals persisted, audit chain verified, role limits (with a spoofed role header ignored), and a database outage shown to the user.
  - Selectors were updated for the new design; the assertions are unchanged.
- Screens were checked at 1440 px and 390 px in light and dark. None overflows horizontally at 390 px, and the risk register table fits at 1440 px with the sidebar open.

## Known follow-ups

- The inherent assessment history shows "—" for date and author, because the API doesn't stamp `per_trn_inherent_risk_assessment` rows. To fix it:
  - Confirm that table has `CREATED_ON` / `CREATED_BY` in Oracle (adding them with a migration if not).
  - Add `serverColumns` for it in `api/src/tables/registry.ts`.

- The progress dashboard shows more risks at "stage complete" than are approved. That is the stored data, shown as it is.
- Unused shadcn primitives (select, tabs, card, etc.) are kept, restyled, as a kit for future screens.
