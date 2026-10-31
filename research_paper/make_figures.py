"""Generates the four figures used in the Pericope ERM paper.
Palette: categorical [blue #2a78d6, orange #eb6834, aqua #1baf7a],
status [good #0ca30c, warning #fab219, serious #ec835a, critical #d03b3b],
ink #0b0b0b / #52514e / #898781, gridline #e1e0d9, white surface for print.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.font_manager as fm

plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Arial", "Segoe UI"]

INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BLUE = "#2a78d6"
ORANGE = "#eb6834"
AQUA = "#1baf7a"
GOOD = "#0ca30c"
WARN = "#fab219"
SERIOUS = "#ec835a"
CRIT = "#d03b3b"

OUT = "figures"

# ---------------------------------------------------------------------------
# Figure 1: three-tier resilient architecture
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(3.6, 5.3))
ax.set_xlim(0, 11.5)
ax.set_ylim(0, 15.2)
ax.axis("off")

boxes = [
    (13.6, "Oracle Autonomous Database", "PER_* (RCSA) / ERM_* (KRI-KPI) schema", "#eef4fc", BLUE),
    (10.4, "Oracle REST Data Services (ORDS)", "OAuth2 client-credentials grant", "#eef4fc", BLUE),
    (7.0, "Express BFF  (server.js)", "bounded 8s timeout • shadow store\naudit log • input validation • rate limit", "#fdf1ea", ORANGE),
    (3.6, "Next.js / React Client", "TanStack Query cache\nlocalStorage offline CRUD store", "#e9f8f1", AQUA),
    (0.9, "Risk Manager (Browser)", None, "#f2f2f0", INK2),
]
BOXW = 7.6
for cy, title, sub, face, edge in boxes:
    h = 2.1 if sub else 1.1
    box = FancyBboxPatch((0.3, cy - h/2), BOXW, h, boxstyle="round,pad=0.12,rounding_size=0.14",
                          linewidth=1.3, edgecolor=edge, facecolor=face)
    ax.add_patch(box)
    cx = 0.3 + BOXW/2
    if sub:
        ax.text(cx, cy + 0.42, title, ha="center", va="center", fontsize=8.8, fontweight="bold", color=INK)
        ax.text(cx, cy - 0.42, sub, ha="center", va="center", fontsize=7.0, color=INK2, linespacing=1.5)
    else:
        ax.text(cx, cy, title, ha="center", va="center", fontsize=8.8, fontweight="bold", color=INK)

CX = 0.3 + BOXW/2
# primary solid arrows
arrow_pairs = [(13.6, 10.4), (10.4, 7.0), (7.0, 3.6), (3.6, 0.9)]
for y0, y1 in arrow_pairs:
    h0 = 2.1 if y0 not in (0.9,) else 1.1
    h1 = 2.1 if y1 not in (0.9,) else 1.1
    ax.annotate("", xy=(CX, y1 + h1/2), xytext=(CX, y0 - h0/2),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4, shrinkA=0, shrinkB=0))

# fallback dashed path (ORDS unreachable -> shadow store -> client keeps working)
RX = 0.3 + BOXW + 0.35
ax.annotate("", xy=(RX, 7.9), xytext=(RX, 9.5),
            arrowprops=dict(arrowstyle="-|>", color=CRIT, lw=1.2, ls=(0, (4, 2)),
                             connectionstyle="arc3,rad=0.5"))
ax.text(RX + 0.65, 8.7, "on timeout", fontsize=6.6, color=CRIT, rotation=90, va="center", ha="center")

ax.annotate("", xy=(RX, 4.5), xytext=(RX, 6.1),
            arrowprops=dict(arrowstyle="-|>", color=CRIT, lw=1.2, ls=(0, (4, 2)),
                             connectionstyle="arc3,rad=0.5"))
ax.text(RX + 0.65, 5.3, "on BFF unreachable", fontsize=6.6, color=CRIT, rotation=90, va="center", ha="center")

plt.tight_layout()
plt.savefig(f"{OUT}/fig1_architecture.png", dpi=300, bbox_inches="tight", facecolor="white")
plt.close()

# ---------------------------------------------------------------------------
# Figure 2: qualitative risk classification bands (Likelihood x Impact)
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(3.4, 3.1))
n = 5
cell = 1.0
import numpy as np

def band(score):
    if score <= 4: return GOOD
    if score <= 9: return WARN
    if score <= 14: return SERIOUS
    return CRIT

for row in range(n):          # row 0 = likelihood 5 (top) .. row4 = likelihood1
    likelihood = n - row
    for col in range(n):
        impact = col + 1
        score = likelihood * impact
        c = band(score)
        ax.add_patch(plt.Rectangle((col, n - 1 - row), 1, 1, facecolor=c, edgecolor="white", linewidth=1.5, alpha=0.92))
        ax.text(col + 0.5, n - 1 - row + 0.5, str(score), ha="center", va="center",
                fontsize=8.5, color="white", fontweight="bold")

ax.set_xlim(0, n)
ax.set_ylim(0, n)
ax.set_xticks([i + 0.5 for i in range(n)])
ax.set_xticklabels([str(i + 1) for i in range(n)], fontsize=8, color=INK2)
ax.set_yticks([i + 0.5 for i in range(n)])
ax.set_yticklabels([str(i + 1) for i in range(n)], fontsize=8, color=INK2)
ax.set_xlabel("Impact  (1–5)", fontsize=8.5, color=INK)
ax.set_ylabel("Likelihood  (1–5)", fontsize=8.5, color=INK)
ax.tick_params(length=0)
for s in ax.spines.values():
    s.set_visible(False)

handles = [mpatches.Patch(color=GOOD, label="Low (1–4)"),
           mpatches.Patch(color=WARN, label="Medium (5–9)"),
           mpatches.Patch(color=SERIOUS, label="High (10–14)"),
           mpatches.Patch(color=CRIT, label="Critical (15–25)")]
ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.5, -0.22),
          ncol=2, fontsize=7.3, frameon=False)

plt.tight_layout()
plt.savefig(f"{OUT}/fig2_bands.png", dpi=300, bbox_inches="tight", facecolor="white")
plt.close()

# ---------------------------------------------------------------------------
# Figure 3: functional module distribution (real repo counts)
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(3.4, 2.6))
groups = ["Core RCSA\n(identify→respond)", "Monitoring\n& KRI", "Governance\n& appetite",
          "Extended GRC\ndomains", "Admin &\nplatform"]
counts = [16, 9, 6, 6, 5]
ypos = range(len(groups))
bars = ax.barh(list(ypos)[::-1], counts, color=BLUE, height=0.58, edgecolor="none")
ax.set_yticks(list(ypos)[::-1])
ax.set_yticklabels(groups, fontsize=7.6, color=INK)
ax.set_xlabel("React page components", fontsize=8, color=INK)
for i, v in enumerate(counts):
    ax.text(v + 0.3, list(ypos)[::-1][i], str(v), va="center", fontsize=8, color=INK, fontweight="bold")
ax.set_xlim(0, 20)
for s in ["top", "right", "left"]:
    ax.spines[s].set_visible(False)
ax.spines["bottom"].set_color(GRID)
ax.tick_params(length=0)
ax.grid(axis="x", color=GRID, linewidth=0.8, zorder=0)
ax.set_axisbelow(True)
plt.tight_layout()
plt.savefig(f"{OUT}/fig3_modules.png", dpi=300, bbox_inches="tight", facecolor="white")
plt.close()

# ---------------------------------------------------------------------------
# Figure 4: structural comparative coverage (qualitative, None=0/Partial=1/Full=2)
# ---------------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(3.4, 2.4))
cats = ["Spreadsheet-\nbased ERM", "Legacy commercial\nGRC suite", "Pericope\nERM"]
scores = [6, 9, 12]
colors = [BLUE, ORANGE, AQUA]
bars = ax.bar(cats, scores, color=colors, width=0.55)
for b, v in zip(bars, scores):
    ax.text(b.get_x() + b.get_width()/2, v + 0.3, str(v), ha="center", fontsize=9, fontweight="bold", color=INK)
ax.set_ylim(0, 16)
ax.set_ylabel("Aggregate coverage score (max 14)", fontsize=8, color=INK)
for s in ["top", "right"]:
    ax.spines[s].set_visible(False)
ax.spines["left"].set_color(GRID)
ax.spines["bottom"].set_color(GRID)
ax.tick_params(length=0, labelsize=8)
ax.grid(axis="y", color=GRID, linewidth=0.8, zorder=0)
ax.set_axisbelow(True)
plt.tight_layout()
plt.savefig(f"{OUT}/fig4_coverage.png", dpi=300, bbox_inches="tight", facecolor="white")
plt.close()

print("figures written")
