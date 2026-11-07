"""Figure 1: design science process and evaluation set-up. Print-safe greys with one accent.

    python3 -I docs/research/paper/figures/figure1.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = '/usr/share/fonts/opentype/inter/'
bold = ImageFont.truetype(F + 'Inter-SemiBold.otf', 38)
reg = ImageFont.truetype(F + 'Inter-Regular.otf', 32)
small = ImageFont.truetype(F + 'Inter-Regular.otf', 28)
label = ImageFont.truetype(F + 'Inter-SemiBold.otf', 30)

W, H = 2600, 1500
img = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(img)
INK, MUTED, LINE, FILL, ACCENT, ACCENT_FILL = '#1a1a1a', '#555555', '#8a8a8a', '#f3f3f3', '#1d5c46', '#e6f0eb'


def box(x, y, w, h, title, lines, fill=FILL, outline=LINE, title_color=INK):
    d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=fill, outline=outline, width=3)
    ty = y + 26
    for t in title.split('\n'):
        tw = d.textlength(t, font=bold)
        d.text((x + (w - tw) / 2, ty), t, font=bold, fill=title_color)
        ty += 48
    ty += 8
    for t in lines:
        tw = d.textlength(t, font=reg)
        d.text((x + (w - tw) / 2, ty), t, font=reg, fill=MUTED)
        ty += 42
    return (x, y, w, h)


def arrow(x1, y1, x2, y2, color=INK, width=4):
    d.line([x1, y1, x2, y2], fill=color, width=width)
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    s = 20
    p1 = (x2 - s * math.cos(a - 0.45), y2 - s * math.sin(a - 0.45))
    p2 = (x2 - s * math.cos(a + 0.45), y2 - s * math.sin(a + 0.45))
    d.polygon([(x2, y2), p1, p2], fill=color)


def section(y, text):
    d.text((60, y), text, font=label, fill=MUTED)
    d.line([60, y + 46, W - 60, y + 46], fill='#cfcfcf', width=2)


# ---------------------------------------------------------------- design science process
section(40, 'DESIGN SCIENCE PROCESS')
bw, bh, gap, y0 = 560, 230, 80, 120
xs = [60 + i * (bw + gap) for i in range(4)]
box(xs[0], y0, bw, bh, 'Code and runtime audit', ['of an existing GRC system:', 'code review, runtime', 'reproduction, data paths'])
box(xs[1], y0, bw, bh, 'Failure taxonomy', ['seven failure modes', 'F1–F7', '(RQ1)'])
box(xs[2], y0, bw, bh, 'Design principles', ['DP1–DP7, each grounded', 'in a kernel theory', '(RQ2)'])
box(xs[3], y0, bw, bh, 'Instantiation', ['ERMA-GRC: every read and', 'write mediated by the server'], fill=ACCENT_FILL, outline=ACCENT, title_color=ACCENT)
for i in range(3):
    arrow(xs[i] + bw + 8, y0 + bh / 2, xs[i + 1] - 8, y0 + bh / 2)

# ---------------------------------------------------------------- evaluation set-up
section(420, 'EVALUATION SET-UP (RQ3)')
sy = 510
sc = box(60, sy, 700, 330, 'Pre-registered scenarios', ['23, one recorded run each:', '18 audit-derived', '4 generalisation', '1 boundary (expected to fail)'])
bx, bwid, bht = 900, 600, 150
box(bx, sy, bwid, bht, 'Baseline', ['the original system'])
box(bx, sy + 180, bwid, bht, 'ERMA-GRC', ['the artifact'], fill=ACCENT_FILL, outline=ACCENT, title_color=ACCENT)
arrow(760 + 8, sy + 110, bx - 8, sy + 75)
arrow(760 + 8, sy + 220, bx - 8, sy + 255)
db = box(1640, sy, 440, 330, 'Shared database\nstand-in', ['identical seeded', 'rows for both', 'systems'])
arrow(bx + bwid + 8, sy + 75, 1640 - 8, sy + 120)
arrow(bx + bwid + 8, sy + 255, 1640 - 8, sy + 210)
oc = box(2200, sy, 340, 330, 'Outcome', ['PREVENTED or', 'OCCURRED,', 'read from the', 'stored state'])
arrow(2080 + 8, sy + 165, 2200 - 8, sy + 165)

# ---------------------------------------------------------------- evidence line
ey = 900
d.text((60, ey), 'Protocol time-stamped in the project repository before execution. Stored-state outcomes read from the stand-in;'
       ' display outcomes from screen text.', font=small, fill=MUTED)

img = img.crop((0, 0, W, 960))
img.save(os.path.join(HERE, 'figure-1-dsr-process.png'), dpi=(300, 300))
print(img.size)
