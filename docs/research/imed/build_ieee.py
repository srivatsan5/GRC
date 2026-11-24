"""
Build the IMED-2027 paper as an IEEE conference-format Word file from paper.md.

    python3 -I docs/research/imed/build_ieee.py

Writes, in docs/research/imed/submission/:
  IMED-2027_paper_anonymous.docx   for double-blind review (no names anywhere)
  IMED-2027_paper_camera-ready.docx  with the author byline, for the final version

Layout follows the IEEE conference template: US Letter; margins 0.75 in top, 1 in bottom,
0.625 in left/right; two 3.5 in columns, 0.25 in apart; Times New Roman throughout.
"""
import re
from pathlib import Path
import docx
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

HERE = Path(__file__).resolve().parent
OUT = HERE / 'submission'
FONT = 'Times New Roman'
ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

AUTHORS = [
    ('Srivatsan B', 'Dept. of Computer Science and Engineering', 'Atria Institute of Technology', 'Bengaluru, India', 'srivatsan359@gmail.com'),
    ('Soumit Roy', 'AVP', 'Jade Global, Inc.', 'Aurora, IL, USA', 'Soumit.roy@ieee.org'),
    ('Raja Vishnu', 'Dept. of Computer Science and Engineering', 'Atria Institute of Technology', 'Bengaluru, India', 'rajavishnuuu36911@gmail.com'),
    ('Rithvik R', 'Dept. of Computer Science and Engineering', 'Atria Institute of Technology', 'Bengaluru, India', 'rithvikravindranath@gmail.com'),
    ('Niranthar M Javagal', 'Dept. of Computer Science and Engineering', 'Atria Institute of Technology', 'Bengaluru, India', 'nmjavagal@gmail.com'),
]


# ------------------------------------------------------------------ low-level helpers
def run(p, text, size=10, bold=False, italic=False, caps=False):
    r = p.add_run(text)
    r.font.name = FONT
    r._r.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), FONT)
    r.font.size = Pt(size)
    r.bold, r.italic = bold, italic
    if caps:
        r.font.small_caps = True
    return r


def rich(p, text, size=10, bold=False, italic=False):
    """**bold** and *italic* inline markup."""
    for part in re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*)', text):
        if not part:
            continue
        if part.startswith('**'):
            run(p, part[2:-2], size, True, italic)
        elif part.startswith('*'):
            run(p, part[1:-1], size, bold, True)
        else:
            run(p, part, size, bold, italic)


def fmt(p, align=WD_ALIGN_PARAGRAPH.JUSTIFY, before=0, after=0, indent=0.0, hanging=None, keep=False):
    pf = p.paragraph_format
    pf.alignment = align
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    pf.first_line_indent = Inches(indent) if indent else None
    if hanging is not None:
        pf.left_indent = Inches(hanging)
        pf.first_line_indent = Inches(-hanging)
    pf.keep_with_next = keep
    pf.widow_control = True


def set_cols(section, n, space_in=0.25):
    sp = section._sectPr
    cols = sp.find(qn('w:cols'))
    if cols is None:
        cols = OxmlElement('w:cols'); sp.append(cols)
    cols.set(qn('w:num'), str(n))
    cols.set(qn('w:space'), str(int(space_in * 1440)))


def page_setup(section):
    section.page_width, section.page_height = Inches(8.5), Inches(11)
    section.top_margin, section.bottom_margin = Inches(0.75), Inches(1.0)
    section.left_margin = section.right_margin = Inches(0.625)
    section.header_distance = Inches(0.5)
    section.footer_distance = Inches(0.5)


def defaults(d):
    st = d.styles['Normal']
    st.font.name, st.font.size = FONT, Pt(10)
    st.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), FONT)
    rpr = d.styles.element.find(qn('w:docDefaults')).find(qn('w:rPrDefault')).find(qn('w:rPr'))
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts'); rpr.insert(0, rf)
    for a in list(rf.attrib):
        del rf.attrib[a]
    for a in ('w:ascii', 'w:hAnsi', 'w:eastAsia', 'w:cs'):
        rf.set(qn(a), FONT)
    pf = st.paragraph_format
    pf.space_before = pf.space_after = Pt(0)


def no_borders(table):
    tblPr = table._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for e in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{e}'); el.set(qn('w:val'), 'nil'); b.append(el)
    tblPr.append(b)


def rule_borders(table):
    """IEEE-style table: rules above and below the header and at the bottom only."""
    tblPr = table._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for e, v in (('top', 'single'), ('bottom', 'single'), ('left', 'nil'), ('right', 'nil'), ('insideH', 'nil'), ('insideV', 'nil')):
        el = OxmlElement(f'w:{e}'); el.set(qn('w:val'), v)
        if v == 'single':
            el.set(qn('w:sz'), '6'); el.set(qn('w:color'), '000000')
        b.append(el)
    tblPr.append(b)
    hdr = table.rows[0]
    for c in hdr.cells:
        tcPr = c._tc.get_or_add_tcPr()
        tb = OxmlElement('w:tcBorders')
        el = OxmlElement('w:bottom'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '4'); el.set(qn('w:color'), '000000')
        tb.append(el); tcPr.append(tb)


def cell_margins(table, lr=0.04, tb=0.01):
    tblPr = table._tbl.tblPr
    m = OxmlElement('w:tblCellMar')
    for side, v in (('top', tb), ('bottom', tb), ('left', lr), ('right', lr)):
        el = OxmlElement(f'w:{side}'); el.set(qn('w:w'), str(int(v * 1440))); el.set(qn('w:type'), 'dxa'); m.append(el)
    tblPr.append(m)


# ------------------------------------------------------------------ blocks
def title_block(d, title, named):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, after=12)
    run(p, title, 24)
    if not named:
        p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, after=14)
        run(p, 'Anonymous authors (double-blind review)', 11, italic=True)
        return
    rows = [AUTHORS[:3], AUTHORS[3:]]
    for row in rows:
        t = d.add_table(rows=1, cols=len(row))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        no_borders(t)
        for c, a in zip(t.rows[0].cells, row):
            c.width = Inches(2.4)
            c.paragraphs[0].text = ''
            for i, line in enumerate(a):
                q = c.paragraphs[0] if i == 0 else c.add_paragraph()
                fmt(q, WD_ALIGN_PARAGRAPH.CENTER)
                run(q, line, 11 if i == 0 else 10, italic=i in (1, 2))
        sp = d.add_paragraph(); fmt(sp, after=6)


def heading1(d, n, text):
    """IEEE level-1 heading: roman numeral, small capitals, centred."""
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, before=8, after=4, keep=True)
    run(p, (f'{ROMAN[n]}. ' if n is not None else '') + text, 10, caps=True)


def heading2(d, letter, text):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.LEFT, before=6, after=3, keep=True)
    run(p, f'{letter}. {text}', 10, italic=True)


def body(d, text, first=True):
    p = d.add_paragraph(); fmt(p, indent=0.2)
    rich(p, text)
    return p


def bullet(d, text, num=None):
    p = d.add_paragraph(); fmt(p, hanging=0.2)
    p.paragraph_format.left_indent = Inches(0.35)
    p.paragraph_format.first_line_indent = Inches(-0.17)
    rich(p, (f'{num}) ' if num else '• ') + text)


def table_block(d, label, title, rows, widths):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, before=6, after=0, keep=True)
    run(p, label, 8, caps=True)
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, after=3, keep=True)
    run(p, title, 8, caps=True)
    t = d.add_table(rows=len(rows), cols=len(rows[0]))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    rule_borders(t); cell_margins(t)
    for i, r in enumerate(rows):
        for j, cell in enumerate(r):
            c = t.cell(i, j)
            c.width = Inches(widths[j])
            q = c.paragraphs[0]; fmt(q, WD_ALIGN_PARAGRAPH.LEFT)
            rich(q, cell.strip(), size=8, bold=(i == 0))
    for r in t.rows:
        trPr = r._tr.get_or_add_trPr()
        cs = OxmlElement('w:cantSplit'); cs.set(qn('w:val'), 'true'); trPr.append(cs)
    sp = d.add_paragraph(); fmt(sp, after=4)


def figure_block(d, path, caption, width=3.45):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, before=4, keep=True)
    p.add_run().add_picture(str(path), width=Inches(width))
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.JUSTIFY, before=3, after=8)
    m = re.match(r'(Fig\. \d+\.)\s*(.*)', caption)
    run(p, m.group(1) + ' ', 8)
    rich(p, m.group(2), size=8)


def reference(d, num, text):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.JUSTIFY)
    p.paragraph_format.left_indent = Inches(0.3)
    p.paragraph_format.first_line_indent = Inches(-0.3)
    run(p, f'[{num}]\t', 8)
    rich(p, text, size=8)
    tabs = p.paragraph_format.tab_stops
    tabs.add_tab_stop(Inches(0.3))


# ------------------------------------------------------------------ build
def build(named):
    src = (HERE / 'paper.md').read_text(encoding='utf-8')
    d = docx.Document()
    defaults(d)
    s0 = d.sections[0]
    page_setup(s0); set_cols(s0, 1)
    cp = d.core_properties
    cp.author = cp.last_modified_by = cp.comments = cp.keywords = ''

    title = re.search(r'^# (.+)$', src, re.M).group(1).strip()
    cp.title = title
    title_block(d, title, named)

    # two-column body starts here
    s1 = d.add_section(WD_SECTION.CONTINUOUS)
    page_setup(s1); set_cols(s1, 2, 0.25)

    lines = src.split('\n')
    i = 0
    h1 = -1
    h2 = 0
    in_refs = False
    pending_table = None
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln or ln.startswith('# ') or ln.startswith('<!--'):
            i += 1; continue
        if ln.startswith('**Abstract'):
            p = d.add_paragraph(); fmt(p, after=6)
            m = re.match(r'\*\*Abstract—\*\*\s*(.*)', ln)
            run(p, 'Abstract', 9, bold=True, italic=True); run(p, '—', 9, bold=True)
            run(p, m.group(1), 9, bold=True)
            i += 1; continue
        if ln.startswith('**Keywords'):
            p = d.add_paragraph(); fmt(p, after=6)
            m = re.match(r'\*\*Keywords—\*\*\s*(.*)', ln)
            run(p, 'Keywords', 9, bold=True, italic=True); run(p, '—', 9, bold=True)
            run(p, m.group(1), 9, bold=True, italic=True)
            i += 1; continue
        if ln.startswith('## '):
            name = ln[3:].strip()
            if name in ('Acknowledgment', 'References'):
                heading1(d, None, name)
                in_refs = name == 'References'
            else:
                h1 += 1; h2 = 0
                heading1(d, h1, name)
            i += 1; continue
        if ln.startswith('### '):
            heading2(d, 'ABCDEFGHIJ'[h2], ln[4:].strip()); h2 += 1
            i += 1; continue
        if ln.startswith('**TABLE'):
            m = re.match(r'\*\*(TABLE [IVX]+)\*\*\s*(.*?)\s*(\{widths:([\d.,\s]+)\})?$', ln)
            pending_table = (m.group(1), m.group(2), [float(x) for x in m.group(4).split(',')] if m.group(4) else None)
            i += 1; continue
        if ln.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                if not re.match(r'^[\s:\-|]+$', lines[i]):
                    rows.append([c for c in lines[i].strip().strip('|').split('|')])
                i += 1
            label, ttl, widths = pending_table
            widths = widths or [3.4 / len(rows[0])] * len(rows[0])
            table_block(d, label, ttl, rows, widths)
            pending_table = None
            continue
        if ln.startswith('> **Fig.'):
            m = re.match(r'> \*\*(Fig\. \d+\.)\*\*\s*(.*?)\s*\*\(File: `([^`]+)`(?:, width ([\d.]+))?\)\*', ln)
            figure_block(d, HERE / m.group(3), f'{m.group(1)} {m.group(2)}', float(m.group(4) or 3.45))
            i += 1; continue
        if in_refs:
            m = re.match(r'\[(\d+)\]\s*(.*)', ln)
            if m:
                reference(d, m.group(1), m.group(2))
            i += 1; continue
        m = re.match(r'(\d+)\) (.*)', ln)
        if m:
            bullet(d, m.group(2), m.group(1)); i += 1; continue
        if ln.startswith('- '):
            bullet(d, ln[2:]); i += 1; continue
        if ln.startswith('{anon} ') or ln.startswith('{named} '):
            tag, ln = ln.split(' ', 1)
            if (tag == '{anon}') == named:
                i += 1; continue
        body(d, ln)
        i += 1
    OUT.mkdir(exist_ok=True)
    name = 'IMED-2027_paper_camera-ready.docx' if named else 'IMED-2027_paper_anonymous.docx'
    d.save(OUT / name)
    return name


if __name__ == '__main__':
    print('written:', build(False), build(True))
