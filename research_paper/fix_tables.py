import re
import sys

src = sys.argv[1]
dst = sys.argv[2]

with open(src, "r", encoding="utf-8") as f:
    text = f.read()

pattern = re.compile(
    r"\\begin\{longtable\}\[\]\{.*?\}\n"
    r"\\toprule\\noalign\{\}\n"
    r"(?P<header>.*?)\\\\\n"
    r"\\midrule\\noalign\{\}\n"
    r"\\endhead\n"
    r"\\bottomrule\\noalign\{\}\n"
    r"\\endlastfoot\n"
    r"(?P<body>.*?)"
    r"\\end\{longtable\}",
    re.DOTALL,
)


def strip_minipage(cell_text):
    cell_text = re.sub(
        r"\\begin\{minipage\}\[b\]\{\\linewidth\}\\raggedright\n(.*?)\n\\end\{minipage\}",
        lambda m: m.group(1).strip(),
        cell_text,
        flags=re.DOTALL,
    )
    cell_text = cell_text.replace("\n", " ").strip()
    # allow line-breaking after escaped underscores in long identifier-like
    # cells (e.g. inherent_risk_assessment), which otherwise overflow their
    # column as a single unbreakable token
    cell_text = cell_text.replace(r"\_", r"\_\allowbreak ")
    return cell_text


def split_row(row):
    # split on & that are not escaped
    parts = re.split(r"(?<!\\)&", row)
    return [strip_minipage(p) for p in parts]


def visible_len(cell_text):
    # rough estimate of rendered character count, stripping LaTeX commands
    t = re.sub(r"\\[a-zA-Z]+(\{[^{}]*\})?", "", cell_text)
    t = t.replace("{", "").replace("}", "").replace("\\_", "_")
    return max(len(t), 3)


def replace(m):
    header_cells = split_row(m.group("header"))
    ncols = len(header_cells)
    body = m.group("body").strip()

    # split body into rows on lines ending with \\ (row separators), being
    # careful of \\ used inside \textbf{...} etc. Rows in pandoc longtable
    # output are always terminated with " \\\\\n" between rows.
    rows = re.split(r"\\\\\n", body)
    rows = [r for r in rows if r.strip()]
    fixed_rows = []
    all_cells = []
    for r in rows:
        cells = split_row(r)
        cells = [c.strip() for c in cells]
        all_cells.append(cells)
        fixed_rows.append(" & ".join(cells) + r" \\")

    # proportional column widths, based on the longest cell in each column
    col_max = [visible_len(header_cells[i]) for i in range(ncols)]
    for cells in all_cells:
        for i, c in enumerate(cells):
            if i < ncols:
                col_max[i] = max(col_max[i], visible_len(c))
    total = sum(col_max)
    fractions = [c / total for c in col_max]

    subtract = 2 * max(ncols - 1, 0)
    colspec = "".join(
        [
            r">{\raggedright\arraybackslash}p{\dimexpr%.4f\linewidth-%.4f\tabcolsep\relax}"
            % (frac, subtract * frac)
            for frac in fractions
        ]
    )
    header_line = " & ".join(r"\textbf{%s}" % c.strip() for c in header_cells) + r" \\"

    out = []
    out.append(r"\begin{table}[!ht]")
    out.append(r"\centering")
    out.append(r"\small")
    out.append(r"\begin{tabular}{@{}%s@{}}" % colspec)
    out.append(r"\toprule")
    out.append(header_line)
    out.append(r"\midrule")
    out.extend(fixed_rows)
    out.append(r"\bottomrule")
    out.append(r"\end{tabular}")
    out.append(r"\end{table}")
    return "\n".join(out)


new_text, n = pattern.subn(replace, text)
print(f"replaced {n} longtable blocks", file=sys.stderr)


# ---------------------------------------------------------------------------
# Convert manually-numbered display math ( \qquad \text{(N)} ) into a real
# \begin{equation}...\end{equation}, so the number is auto-generated and
# flush against the column's right margin (IEEE requirement), instead of
# just following a fixed \qquad gap after the equation content.
# ---------------------------------------------------------------------------
eq_pattern = re.compile(
    r"\\\[\n(?P<body>.*?)\s*\\qquad\s*\\text\{\(\d+\)\}\n\\\]",
    re.DOTALL,
)
new_text, n_eq = eq_pattern.subn(
    lambda m: "\\begin{equation}\n%s\n\\end{equation}" % m.group("body").strip(),
    new_text,
)
print(f"converted {n_eq} display equations to numbered \\equation blocks", file=sys.stderr)

# ---------------------------------------------------------------------------
# Set the References section in a smaller, single-spaced font, matching
# common IEEE practice for bibliography lists.
# ---------------------------------------------------------------------------
ref_pattern = re.compile(
    r"(\\section\*\{References\}\\label\{references\}\n)(.*?)(\n\\end\{document\})",
    re.DOTALL,
)
new_text, n_ref = ref_pattern.subn(
    lambda m: m.group(1) + "\\footnotesize\n" + m.group(2) + m.group(3),
    new_text,
)
print(f"applied footnotesize to references section: {n_ref}", file=sys.stderr)

with open(dst, "w", encoding="utf-8") as f:
    f.write(new_text)
