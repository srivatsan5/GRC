# Figures and screenshots for the paper

| File | What it is |
|---|---|
| `figure-2-baseline-vs-erma-grc.png` | Figure 2 in §4: the same stored data in the baseline and in ERMA-GRC (scenarios S1.1 and S7.1) |
| `panel-*.png` | The four panels of Figure 2, before composition |
| `screens/01–13-*.png` | ERMA-GRC on the full demo data: sign-in, dashboard, cycles, risk register, risk detail, heatmap, residual analysis, risk indicators, control library, risk appetite, approvals, audit trail, reports |

## Figure 2
- Re-captured after the rename to ERMA-GRC, with the same stored set-up as the recorded evaluation run (`capture.cjs`, `compose.py`).
- Panels (b) and (d) **deliberately** show "Not rated" and an empty cycle: that is the correct behaviour the figure demonstrates.
- Baseline panels are cropped to the data tables, so its old product name does not appear.
- The recorded evidence itself is in `docs/research/evaluation/evidence/`.

## Product screens (`screens/`)

**Data:** the same rows as the Oracle demo install: module demo data, `07_mock_data.sql` and `10_more_demo_data.sql`, converted by `sql-to-rows.py` and served by `demo-stand-in.ts`.

**Then, through the app as named demo users** (`complete-demo.mjs`), so the audit trail records each step:
- the four ratings the demo left open were completed;
- one new risk was added to the current Q4 cycle, and two to the planned Q1 2027 cycle;
- RSK-2026-019 went through its whole life: control applied, action plan, submitted by its maker, approved by a different Risk Manager;
- the last test dates of two library controls were recorded;
- one November risk-indicator reading was recorded.

**Rebuild:**
```bash
python3 -I docs/research/paper/figures/sql-to-rows.py /tmp/demo-rows.json
npx --prefix api tsx docs/research/paper/figures/demo-stand-in.ts /tmp/demo-rows.json   # :8181
# API on :5000 with a fresh DATA_DIR and BOOTSTRAP_ADMIN_EMAIL=srivatsan@erma-grc.example; web on :3000
node docs/research/paper/figures/complete-demo.mjs
node docs/research/paper/figures/screens.cjs
```
