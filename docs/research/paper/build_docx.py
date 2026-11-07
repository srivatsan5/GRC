"""
Assemble the submission files from the approved section drafts, on the LEAD-2027 templates.

    python3 -I docs/research/paper/build_docx.py <full-paper-template.docx> <abstract-template.docx>

Writes to docs/research/paper/submission/:
  ERMA-GRC_full-paper_review-copy.docx   anonymous, for review
  ERMA-GRC_title-page.docx               authors and affiliations (separate file)
  ERMA-GRC_abstract.docx                 the abstract on the abstract template (backup submission)
"""
import copy, re, sys
from pathlib import Path
import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

HERE = Path(__file__).resolve().parent
OUT = HERE / 'submission'
OUT.mkdir(exist_ok=True)
FONT = 'Times New Roman'

S1 = (HERE / 'S1_S5_S6_Abstract_draft.md').read_text(encoding='utf8')
S2 = (HERE / 'S2_draft.md').read_text(encoding='utf8')
S34 = (HERE / 'S3_S4_draft.md').read_text(encoding='utf8')


def between(text, start, end=None):
    a = text.index(start) + len(start)
    b = text.index(end, a) if end else len(text)
    return text[a:b].strip('\n')


# ------------------------------------------------------------------ document helpers
def fresh(template):
    d = docx.Document(template)
    # The template's metadata names its own creator; the review copy must carry no names at all.
    cp = d.core_properties
    cp.author = ''
    cp.last_modified_by = ''
    cp.comments = ''
    cp.keywords = ''
    body = d.element.body
    for el in list(body):
        if el.tag != qn('w:sectPr'):
            body.remove(el)
    return d


def fmt(p, align=None, after=6, before=0):
    pf = p.paragraph_format
    pf.line_spacing = 1.0
    pf.space_after = Pt(after)
    pf.space_before = Pt(before)
    if align is not None:
        p.alignment = align


def run(p, text, bold=False, italic=False, size=12):
    r = p.add_run(text)
    r.bold, r.italic = bold or None, italic or None
    r.font.name = FONT
    r.font.size = Pt(size)
    r._element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
    return r


INLINE = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)')


def rich(p, text, size=12, bold=False):
    """Markdown-style **bold** and *italic* inside a paragraph."""
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith('**'):
            run(p, part[2:-2], bold=True, size=size)
        elif part.startswith('*'):
            run(p, part[1:-1], italic=True, bold=bold, size=size)
        elif part.startswith('`'):
            run(p, part[1:-1], size=size, bold=bold)
        else:
            run(p, part, size=size, bold=bold)


def para(d, text, align=WD_ALIGN_PARAGRAPH.JUSTIFY, after=6, size=12, bold=False):
    p = d.add_paragraph()
    fmt(p, align, after)
    rich(p, text, size=size, bold=bold)
    return p


def heading(d, text, size=12, before=10):
    p = d.add_paragraph()
    fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=6, before=before)
    p.paragraph_format.keep_with_next = True
    run(p, text, bold=True, size=size)
    return p


def bullet(d, text, numbered=None):
    p = d.add_paragraph()
    fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=2)
    p.paragraph_format.left_indent = Inches(0.35)
    p.paragraph_format.first_line_indent = Inches(-0.2)
    rich(p, (f'{numbered}. ' if numbered else '•  ') + text)
    return p


def table(d, rows, caption, widths=None, size=12):
    cap = d.add_paragraph()
    fmt(cap, WD_ALIGN_PARAGRAPH.LEFT, after=4, before=6)
    cap.paragraph_format.keep_with_next = True
    m = re.match(r'(Table \d+\.)\s*(.*)', caption)
    run(cap, m.group(1) + ' ', bold=True)
    run(cap, m.group(2), italic=True)
    t = d.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, r in enumerate(rows):
        for j, cell in enumerate(r):
            c = t.cell(i, j)
            c.paragraphs[0].text = ''
            p = c.paragraphs[0]
            fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=0)
            rich(p, cell.strip(), size=size, bold=(i == 0))
            if widths:
                c.width = Inches(widths[j])
    for r in t.rows:  # keep each row on one page
        cs = OxmlElement('w:cantSplit'); cs.set(qn('w:val'), 'true'); r._tr.get_or_add_trPr().append(cs)
    # repeat the header row on a new page
    trPr = t.rows[0]._tr.get_or_add_trPr()
    h = OxmlElement('w:tblHeader'); h.set(qn('w:val'), 'true'); trPr.append(h)
    spacer = d.add_paragraph(); fmt(spacer, after=4)
    return t


def figure(d, path, caption, width=6.2):
    p = d.add_paragraph()
    fmt(p, WD_ALIGN_PARAGRAPH.CENTER, after=4, before=6)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Inches(width))
    cap = d.add_paragraph()
    fmt(cap, WD_ALIGN_PARAGRAPH.JUSTIFY, after=10)
    m = re.match(r'(Figure \d+\.)\s*(.*)', caption)
    run(cap, m.group(1) + ' ', bold=True, size=12)
    rich(cap, m.group(2), size=12)


def page_numbers(d):
    """Bottom-centre page numbers (required by the template guidelines)."""
    for s in d.sections:
        f = s.footer
        p = f.paragraphs[0] if f.paragraphs else f.add_paragraph()
        p.text = ''
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(); r.font.name = FONT; r.font.size = Pt(11)
        for tag, attr in (('w:fldChar', 'begin'), ('w:instrText', None), ('w:fldChar', 'separate'), ('w:t', None), ('w:fldChar', 'end')):
            el = OxmlElement(tag)
            if tag == 'w:fldChar':
                el.set(qn('w:fldCharType'), attr)
            elif tag == 'w:instrText':
                el.set(qn('xml:space'), 'preserve'); el.text = ' PAGE '
            else:
                el.text = '1'
            r._r.append(el)


# ------------------------------------------------------------------ markdown body to Word
FIGS = {'Figure 1.': (HERE / 'figures/figure-1-dsr-process.png', 6.2), 'Figure 2.': (HERE / 'figures/figure-2-baseline-vs-erma-grc.png', 5.4)}


def render(d, md):
    lines = md.split('\n')
    i = 0
    pending_caption = None
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip() or ln.strip() == '---':
            i += 1; continue
        if ln.startswith('### '):
            heading(d, ln[4:].strip(), before=6); i += 1; continue
        if ln.startswith('## '):
            m = re.match(r'## (\d+) (.*)', ln)
            heading(d, f'{m.group(1)}. {m.group(2)}', before=12); i += 1; continue
        if re.match(r'\*\*Table \d+\.\*\*', ln.strip()):
            pending_caption = re.sub(r'\*\*(Table \d+\.)\*\*\s*', r'\1 ', ln.strip()); i += 1; continue
        if ln.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c for c in lines[i].strip().strip('|').split('|')]
                if not re.match(r'^[\s:\-|]+$', lines[i]):
                    rows.append(cells)
                i += 1
            widths = {5: [1.35, 1.0, 1.05, 1.5, 1.4], 4: [1.45, 1.5, 1.35, 1.95], 3: [2.1, 2.15, 2.0]}.get(len(rows[0]))
            table(d, rows, pending_caption or 'Table ?. (caption missing)', widths)
            pending_caption = None
            continue
        if ln.startswith('> '):
            cap = re.sub(r'\s*\*\(File:.*?\)\*', '', ln[2:].strip())
            cap = re.sub(r'\*\*(Figure \d+\.)\*\*\s*', r'\1 ', cap)
            key = cap.split(' ')[0] + ' ' + cap.split(' ')[1]
            figure(d, FIGS[key][0], cap, width=FIGS[key][1])
            i += 1; continue
        m = re.match(r'(\d+)\. (.*)', ln)
        if m:
            bullet(d, m.group(2), numbered=m.group(1)); i += 1; continue
        if ln.lstrip().startswith('- '):
            bullet(d, ln.lstrip()[2:]); i += 1; continue
        para(d, ln.strip()); i += 1


# ------------------------------------------------------------------ content
TITLE = S1.split('**Title:**')[1].split('\n')[0].strip()
TRACK = S1.split('**Name of the Track:**')[1].split('\n')[0].strip()
TYPE = S1.split('**Type of Submission:**')[1].split('\n')[0].strip()
ABS = {k: between(S1, f'**{k}**', nxt) for k, nxt in [('Purpose', '**Design/Methodology/Approach**'), ('Design/Methodology/Approach', '**Findings**'), ('Findings', '**Originality/Value**'), ('Originality/Value', '**Keywords:**')]}
KEYWORDS = S1.split('**Keywords:**')[1].split('\n')[0].strip()

body = '\n'.join([
    '## 1 Introduction', between(S1, '## 1 Introduction', '---'),
    '## 2 Literature Review', between(S2, '## 2 Literature Review', '**Word count:**').rstrip('-\n '),
    '## 3 Methodology', between(S34, '## 3 Methodology', '## 4 Results and Discussion').rstrip('-\n '),
    '## 4 Results and Discussion', between(S34, '## 4 Results and Discussion', '**Word counts:**').rstrip('-\n '),
    '## 5 Implications', between(S1, '## 5 Implications', '## 6 Conclusion').rstrip('-\n '),
    '## 6 Conclusion, Limitations and Future Research', between(S1, '## 6 Conclusion, Limitations and Future Research', '**Word counts').rstrip('-\n '),
])

REFS = [l[2:].strip() for l in between(S2, '## References cited in this section (APA 7, checked against Crossref)', '**Notes for you').split('\n') if l.startswith('- ')]
REFS += [
    'Hevner, A. R., March, S. T., Park, J., & Ram, S. (2004). Design science in information systems research. *MIS Quarterly, 28*(1), 75–106. https://doi.org/10.2307/25148625',
    'Peffers, K., Tuunanen, T., Rothenberger, M. A., & Chatterjee, S. (2007). A design science research methodology for information systems research. *Journal of Management Information Systems, 24*(3), 45–77. https://doi.org/10.2753/MIS0742-1222240302',
    'Venable, J., Pries-Heje, J., & Baskerville, R. (2016). FEDS: A framework for evaluation in design science research. *European Journal of Information Systems, 25*(1), 77–89. https://doi.org/10.1057/ejis.2014.36',
]
def apa_key(r):
    # APA 7: first author's surname, then single-author works before multi-author ones, then year.
    surname = r.split(',')[0].lower()
    authors = r.split('(')[0]
    year = re.search(r'\((\d{4})\)', r).group(1)
    return (surname, '&' in authors, re.sub(r'[^a-z]', '', authors.lower()), year)


REFS.sort(key=apa_key)


def header_block(d, abstract_label):
    t = d.add_paragraph(); fmt(t, WD_ALIGN_PARAGRAPH.CENTER, after=12)
    run(t, TITLE, bold=True, size=22)
    for label, value in (('Name of the Track: ', TRACK), ('Type of Submission: ', TYPE)):
        p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=4)
        run(p, label, bold=True); run(p, value)
    heading(d, abstract_label, before=12, size=12)


# ------------------------------------------------------------------ 1. full paper (anonymous review copy)
FULL, ABSTRACT_T = sys.argv[1], sys.argv[2]
d = fresh(FULL)
header_block(d, 'Abstract')
for k, v in ABS.items():
    heading(d, k, before=4)
    para(d, v)
p = d.add_paragraph(); fmt(p, after=10); run(p, 'Keywords: ', bold=True); run(p, KEYWORDS)
render(d, body)
heading(d, 'References', before=12)
for r in REFS:
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=4)
    p.paragraph_format.left_indent = Inches(0.5); p.paragraph_format.first_line_indent = Inches(-0.5)
    rich(p, r)
page_numbers(d)
d.core_properties.title = TITLE
d.save(OUT / 'ERMA-GRC_full-paper_review-copy.docx')

# ------------------------------------------------------------------ 2. title page (not anonymous)
d = fresh(FULL)
t = d.add_paragraph(); fmt(t, WD_ALIGN_PARAGRAPH.CENTER, after=18); run(t, TITLE, bold=True, size=22)
authors = [('Srivatsan B', '1'), ('Soumit Roy', '2'), ('Raja Vishnu', '1'), ('Rithvik R', '1'), ('Niranthar M Javagal', '1')]
p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.CENTER, after=12)
for n, (name, aff) in enumerate(authors):
    run(p, name); r = run(p, aff); r.font.superscript = True
    if n < len(authors) - 1:
        run(p, ', ' if n < len(authors) - 2 else ' and ')
for aff in ['¹ Department of Computer Science and Engineering, Atria Institute of Technology, Bengaluru, India',
            '² AVP, Jade Global, Inc., Aurora, IL 60504, USA']:
    para(d, aff, align=WD_ALIGN_PARAGRAPH.CENTER, after=4)
para(d, 'srivatsan359@gmail.com, Soumit.roy@ieee.org, rajavishnuuu36911@gmail.com, rithvikravindranath@gmail.com, nmjavagal@gmail.com', align=WD_ALIGN_PARAGRAPH.CENTER, after=12)
for label, value in (('Corresponding author: ', 'Srivatsan B, srivatsan359@gmail.com'), ('Name of the Track: ', TRACK), ('Type of Submission: ', TYPE)):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=4); run(p, label, bold=True); run(p, value)
heading(d, 'Declaration on the use of generative AI', before=12)
decl = between(S34, '**Use of generative AI.** ', '\n\n> **Figure 1.**')
for chunk in decl.split('\n\n'):
    para(d, ' '.join(l.strip().lstrip('- ').strip() for l in chunk.split('\n') if l.strip()))
page_numbers(d)
d.core_properties.title = TITLE
d.save(OUT / 'ERMA-GRC_title-page.docx')

# ------------------------------------------------------------------ 3. abstract on the abstract template
d = fresh(ABSTRACT_T)
t = d.add_paragraph(); fmt(t, WD_ALIGN_PARAGRAPH.CENTER, after=12); run(t, TITLE, bold=True, size=22)
for label, value in (('Name of the Track: ', TRACK), ('Type of Submission: ', TYPE)):
    p = d.add_paragraph(); fmt(p, WD_ALIGN_PARAGRAPH.LEFT, after=4); run(p, label, bold=True); run(p, value)
h = d.add_paragraph(); fmt(h, before=12, after=6); run(h, 'Abstract', bold=True, size=16)
for n, (k, v) in enumerate(ABS.items(), 1):
    heading(d, f'{n}. {k}', before=4)
    para(d, v)
heading(d, 'Keywords', before=8)
para(d, KEYWORDS, align=WD_ALIGN_PARAGRAPH.LEFT)
d.core_properties.title = TITLE
d.save(OUT / 'ERMA-GRC_abstract.docx')
print('written:', *sorted(p.name for p in OUT.glob('*.docx')))
