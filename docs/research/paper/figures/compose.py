"""Compose Figure 2 from the four panels captured by capture.cjs."""
from PIL import Image, ImageDraw, ImageFont
import os
here = os.path.dirname(os.path.abspath(__file__))
bold = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 46)
reg = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Regular.otf', 40)
panels = [
    ('panel-a-baseline-unrated.png', '(a) Baseline', 'Risk with no stored rating or SLE: shown with score 4 and SLE $40,000'),
    ('panel-b-erma-unrated.png', '(b) ERMA-GRC', 'The same stored risk: shown as "Not rated", no SLE'),
    ('panel-c-baseline-empty-cycle.png', '(c) Baseline', 'Assessment cycle with no risks: two invented, scored risks with delete buttons'),
    ('panel-d-erma-empty-cycle.png', '(d) ERMA-GRC', 'The same cycle: shown empty'),
]
W, pad, gap, label_h = 2460, 40, 70, 90
imgs = [Image.open(os.path.join(here, f)).convert('RGB') for f, _, _ in panels]
imgs[3] = imgs[3].crop((0, 80, imgs[3].width, imgs[3].height - 70))  # trim empty margin around the empty state
H = pad + sum(label_h + im.height + gap for im in imgs) - gap + pad
fig = Image.new('RGB', (W + 2 * pad, H), 'white')
d = ImageDraw.Draw(fig)
y = pad
for im, (_, tag, text) in zip(imgs, panels):
    d.text((pad, y + 10), tag, font=bold, fill='#111111')
    d.text((pad + d.textlength(tag + '  ', font=bold), y + 15), text, font=reg, fill='#444444')
    y += label_h
    fig.paste(im, (pad, y))
    d.rectangle([pad - 1, y - 1, pad + im.width, y + im.height], outline='#bbbbbb', width=2)
    y += im.height + gap
fig.save(os.path.join(here, 'figure-2-baseline-vs-erma-grc.png'), dpi=(300, 300))
print(fig.size)
