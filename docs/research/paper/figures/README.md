# Figures and screenshots for the paper

| File | What it is |
|---|---|
| `figure-2-baseline-vs-erma-grc.png` | Figure 2 in §4: the same stored data in the baseline and in ERMA-GRC (scenarios S1.1 and S7.1) |
| `panel-*.png` | The four panels of Figure 2, before composition |
| `screens/01–08-*.png` | Full ERMA-GRC screens (sign-in, dashboard, risk register, heatmap, empty cycle, audit trail, approvals, key risk indicators) for slides or a later full paper |

**How they were made:**
- Re-captured on 7 November 2026, after the product was renamed to ERMA-GRC (commit `a58562b`).
- Same stand-in database and stored set-up as the recorded evaluation run. The recorded evidence itself is in `docs/research/evaluation/evidence/`.
- Baseline panels are cropped to the data tables, so its old product name does not appear.

**Rebuild:**
```bash
node docs/research/paper/figures/capture.cjs      # needs the five services described in capture.cjs
python3 -I docs/research/paper/figures/compose.py
```
