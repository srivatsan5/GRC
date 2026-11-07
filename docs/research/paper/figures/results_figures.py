"""
Figure 2 (outcome of every scenario, both systems) and Figure 3 (what each system displayed for the
same stored data), drawn from docs/research/evaluation/results.json and the recorded evidence.
Print-safe: outcome is shown by fill + symbol (filled tick vs hollow cross), not by colour alone.
Rendered at 600 dpi for a 6.3-inch column.

    python3 -I docs/research/paper/figures/results_figures.py
"""
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
DPI = 600
pt = lambda p: int(round(p / 72 * DPI))
F = '/usr/share/fonts/opentype/inter/'
font = lambda w, p: ImageFont.truetype(F + ('Inter-SemiBold.otf' if w == 'b' else 'Inter-Regular.otf'), pt(p))
INK, MUTED, HAIR = '#1a1a1a', '#555555', '#c3c2b7'
GOOD, CRIT = '#0b7d0b', '#c0392b'  # darker steps of the status good/critical hues, for white marks on print
W = int(6.3 * DPI)


def tick(d, x, y, s, col, w):
    d.line([(x + s * .22, y + s * .52), (x + s * .42, y + s * .72), (x + s * .78, y + s * .3)], fill=col, width=w, joint='curve')


def cross(d, x, y, s, col, w):
    m = s * .28
    d.line([(x + m, y + m), (x + s - m, y + s - m)], fill=col, width=w)
    d.line([(x + s - m, y + m), (x + m, y + s - m)], fill=col, width=w)


def cell(d, x, y, s, prevented):
    if prevented:
        d.rounded_rectangle([x, y, x + s, y + s], radius=int(s * .12), fill=GOOD)
        tick(d, x, y, s, 'white', max(6, int(s * .11)))
    else:
        d.rounded_rectangle([x, y, x + s, y + s], radius=int(s * .12), fill='white', outline=CRIT, width=max(5, int(s * .07)))
        cross(d, x, y, s, CRIT, max(6, int(s * .1)))


def centre_text(d, cx, y, text, f, fill=INK):
    d.text((cx - d.textlength(text, font=f) / 2, y), text, font=f, fill=fill)


# ---------------------------------------------------------------- Figure 2: outcome matrix
res = json.load(open(os.path.join(ROOT, 'docs/research/evaluation/results.json')))
sc = res['scenarios']
groups = [('F1', ['S1.1', 'S1.2', 'S1.3', 'S1.4']), ('F2', ['S2.1', 'S2.2']), ('F3', ['S3.1', 'S3.2', 'S3.3', 'S3.4']),
          ('F4', ['S4.1', 'S4.2', 'S4.3']), ('F5', ['S5.1', 'S5.2', 'S5.3']), ('F6', ['S6.1']), ('F7', ['S7.1']),
          ('G', ['G1', 'G2', 'G3', 'G4']), ('L', ['L1'])]
out = {s['id']: (s['baseline'] == 'PREVENTED', s['erma_grc'] == 'PREVENTED') for s in sc}
assert sum(len(g) for _, g in groups) == len(out) == 23

H = pt(2.05 * 72)
img = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(img)
fl, fg, fid, ft, fleg = font('b', 9), font('b', 8.5), font('r', 7), font('b', 9.5), font('r', 8)
left, right = pt(66), pt(52)
gap_g = pt(5)
n = 23
s = int((W - left - right - gap_g * (len(groups) - 1)) / n * 0.86)
pad = int((W - left - right - gap_g * (len(groups) - 1)) / n - s)
y_grp, y0 = pt(4), pt(30)
y1 = y0 + s + pt(6)
x = left
xs = {}
for gi, (g, ids) in enumerate(groups):
    gx0 = x
    for sid in ids:
        xs[sid] = x
        x += s + pad
    gx1 = x - pad
    # group label and bracket
    centre_text(d, (gx0 + gx1) / 2, y_grp, g, fg)
    by = y_grp + pt(13)
    d.line([(gx0, by), (gx1, by)], fill=HAIR, width=pt(0.8))
    x += gap_g
for row, (label, yy) in enumerate([('Baseline', y0), ('ERMA-GRC', y1)]):
    d.text((pt(2), yy + (s - pt(9)) / 2 - pt(1)), label, font=fl, fill=INK)
    for sid, xx in xs.items():
        cell(d, xx, yy, s, out[sid][row])
    total = sum(1 for v in out.values() if v[row])
    tx = W - right + pt(10)
    d.text((tx, yy + (s - pt(9.5)) / 2 - pt(1)), f'{total} / 23', font=ft, fill=INK)
# scenario ids under the cells, rotated
for sid, xx in xs.items():
    tw = int(d.textlength(sid, font=fid)) + 4
    lab = Image.new('RGBA', (tw, pt(9)), (255, 255, 255, 0)); ImageDraw.Draw(lab).text((0, 0), sid, font=fid, fill=MUTED)
    lab = lab.rotate(90, expand=True)
    img.paste(lab, (int(xx + s / 2 - lab.width / 2), int(y1 + s + pt(4))), lab)
# legend
ly = y1 + s + pt(30)
lx = left
ls = pt(10)
cell(d, lx, ly, ls, True); d.text((lx + ls + pt(4), ly - pt(1)), 'PREVENTED: the failure did not occur', font=fleg, fill=INK)
lx2 = lx + ls + pt(4) + d.textlength('PREVENTED: the failure did not occur', font=fleg) + pt(18)
cell(d, lx2, ly, ls, False); d.text((lx2 + ls + pt(4), ly - pt(1)), 'OCCURRED: the failure occurred', font=fleg, fill=INK)
img = img.crop((0, 0, W, ly + ls + pt(4)))
img.save(os.path.join(HERE, 'figure-2-scenario-outcomes.png'), dpi=(DPI, DPI))
print('figure 2', img.size)

# ---------------------------------------------------------------- Figure 3: same stored data, two displays
fh, fr, fb, fsmall = font('b', 9), font('r', 8.5), font('b', 8.5), font('r', 7.5)
colx0 = pt(70)
gap = pt(8)
cw = int((W - colx0 - 2 * gap) / 3)
heads = ['Stored in the database', 'Baseline displays', 'ERMA-GRC displays']
rows = [
    ('S1.1', 'Unrated risk',
     [('Risk:', 'Eval S1.1 unrated risk'), ('Likelihood:', 'none'), ('Impact:', 'none'), ('SLE:', 'none')],
     [('Rating:', '1/5 × 4/5, score 4'), ('Band:', 'Moderate'), ('SLE:', '$40,000')],
     [('Inherent:', 'Not rated'), ('Residual:', 'Not rated'), ('SLE:', '—')]),
    ('S7.1', 'Cycle with no risks',
     [('Cycle:', 'CYC-EVAL-S71'), ('Risks in cycle:', 'none')],
     [('Risk 1:', 'score 16, $160,000'), ('Risk 2:', 'score 12, $120,000'), ('', 'Both invented, each'), ('', 'with a Delete button')],
     [('', 'No risks in this cycle yet')]),
]
line_h = pt(12.5)
box_pad = pt(7)
row_h = [box_pad * 2 + line_h * max(len(r[2]), len(r[3]), len(r[4])) for r in rows]
H3 = pt(20) + sum(row_h) + gap * len(rows) + pt(2)
img = Image.new('RGB', (W, H3), 'white'); d = ImageDraw.Draw(img)
hm = pt(10)
for i, h in enumerate(heads):
    cx = colx0 + i * (cw + gap) + cw / 2
    if i == 0:
        centre_text(d, cx, pt(2), h, fh, INK)
    else:
        tw = d.textlength(h, font=fh)
        x0 = cx - (tw + hm + pt(4)) / 2
        cell(d, x0, pt(3), hm, i == 2)
        d.text((x0 + hm + pt(4), pt(2)), h, font=fh, fill=INK)
y = pt(20)
for (sid, desc, stored, base, erma), rh in zip(rows, row_h):
    d.text((pt(2), y + box_pad), sid, font=fh, fill=INK)
    d.multiline_text((pt(2), y + box_pad + line_h), desc.replace(' with ', '\nwith ').replace('risk', 'risk'), font=fsmall, fill=MUTED, spacing=pt(2))
    for i, (lines, kind) in enumerate([(stored, 'stored'), (base, 'bad'), (erma, 'good')]):
        bx = colx0 + i * (cw + gap)
        outline = {'stored': HAIR, 'bad': CRIT, 'good': GOOD}[kind]
        d.rounded_rectangle([bx, y, bx + cw, y + rh], radius=pt(4), fill='white' if kind != 'stored' else '#f6f6f3', outline=outline, width=pt(1.1 if kind != 'stored' else 0.8))
        ty = y + box_pad
        for k, v in lines:
            tx = bx + box_pad
            if k:
                d.text((tx, ty), k, font=fr, fill=MUTED); tx += d.textlength(k + ' ', font=fr)
            vf = fb if kind != 'stored' or not k else fr
            assert tx + d.textlength(v, font=vf) <= bx + cw - box_pad, f'line too long: {k} {v}'
            d.text((tx, ty), v, font=vf, fill=INK)
            ty += line_h
    y += rh + gap
img = img.crop((0, 0, W, y - gap + pt(2)))
img.save(os.path.join(HERE, 'figure-3-same-data-two-systems.png'), dpi=(DPI, DPI))
print('figure 3', img.size)
