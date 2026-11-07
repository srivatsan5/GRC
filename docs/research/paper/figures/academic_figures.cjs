/**
 * Figures 1 and 2 in a journal style: black and grey only, hairline rules, square corners,
 * Liberation Serif (metric-compatible with Times New Roman, the paper's typeface).
 * Drawn as SVG and rendered at 600 dpi for a 6.3-inch text column.
 *
 *   node docs/research/paper/figures/academic_figures.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const OUT = __dirname
const ROOT = path.resolve(__dirname, '../../../..')
const WIDTH = 605 // CSS px = 6.3 in at 96 px/in
const SCALE = 600 / 96 // 600 dpi
const FONT = "'Liberation Serif', 'Times New Roman', serif"
const INK = '#111'
const GREY = '#555'
const RULE = 0.75 // px (about 0.56 pt)

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Type sizes are in CSS px; placed at 6.3 in, 1 px is about 0.75 pt, so 11.5 px prints near 8.5 pt.
const T = { head: 12, bold: 12, body: 11.5, small: 9.5 }

// ---------------------------------------------------------------- Figure 1: process and set-up
function figure1() {
  const W = WIDTH
  const lh = 16
  const box = (x, y, w, h, lines, fill = 'white') => {
    const top = y + h / 2 - ((lines.length - 1) * lh) / 2 + 4
    const t = lines
      .map((l, i) => `<text x="${x + w / 2}" y="${top + i * lh}" text-anchor="middle" font-size="${i === 0 ? T.bold : T.body}" font-weight="${i === 0 ? 700 : 400}">${esc(l)}</text>`)
      .join('')
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${INK}" stroke-width="${RULE}"/>${t}`
  }
  const arrow = (x1, y1, x2, y2) => `<line x1="${x1 + 3}" y1="${y1}" x2="${x2 - 3}" y2="${y2}" stroke="${INK}" stroke-width="${RULE}" marker-end="url(#ah)"/>`
  const SHADE = '#e6e6e6'
  // (a) design science process
  const bw = 124, bh = 60, gx = (W - 4 * bw) / 3, ya = 30
  const xs = [0, 1, 2, 3].map(i => i * (bw + gx))
  let s = `<text x="0" y="14" font-size="${T.head}" font-style="italic">(a) Design science process</text>`
  s += box(xs[0], ya, bw, bh, ['Audit', 'existing GRC system'])
  s += box(xs[1], ya, bw, bh, ['Failure modes', 'F1–F7 (RQ1)'])
  s += box(xs[2], ya, bw, bh, ['Design principles', 'DP1–DP7 (RQ2)'])
  s += box(xs[3], ya, bw, bh, ['Instantiation', 'ERMA-GRC'], SHADE)
  for (let i = 0; i < 3; i++) s += arrow(xs[i] + bw, ya + bh / 2, xs[i + 1], ya + bh / 2)
  // (b) evaluation set-up
  const yb = ya + bh + 56
  s += `<text x="0" y="${yb - 16}" font-size="${T.head}" font-style="italic">(b) Evaluation set-up (RQ3)</text>`
  const rowH = 42, gapR = 24, fullH = 2 * rowH + gapR
  const c1 = 0, c1w = 122, c2 = 162, c2w = 104, c3 = 306, c3w = 128, c4 = 474, c4w = W - 474
  const r1 = yb + rowH / 2, r2 = yb + rowH + gapR + rowH / 2, mid = yb + fullH / 2
  s += box(c1, yb, c1w, fullH, ['23 scenarios', '18 audit-derived', '4 generalisation', '1 boundary'])
  s += box(c2, yb, c2w, rowH, ['Baseline'])
  s += box(c2, yb + rowH + gapR, c2w, rowH, ['ERMA-GRC'], SHADE)
  s += box(c3, yb, c3w, fullH, ['Database stand-in', 'identical', 'seeded rows'])
  s += box(c4, yb, c4w, fullH, ['Outcome', 'PREVENTED or', 'OCCURRED'])
  s += arrow(c1 + c1w, r1, c2, r1) + arrow(c1 + c1w, r2, c2, r2)
  s += arrow(c2 + c2w, r1, c3, r1) + arrow(c2 + c2w, r2, c3, r2)
  s += arrow(c3 + c3w, mid, c4, mid)
  return { svg: s, W, H: yb + fullH }
}

// ---------------------------------------------------------------- Figure 2: outcome of every scenario
function figure2() {
  const res = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/research/evaluation/results.json'), 'utf8'))
  const out = Object.fromEntries(res.scenarios.map(s => [s.id, [s.baseline === 'PREVENTED', s.erma_grc === 'PREVENTED']]))
  const groups = [
    ['F1', ['S1.1', 'S1.2', 'S1.3', 'S1.4']], ['F2', ['S2.1', 'S2.2']], ['F3', ['S3.1', 'S3.2', 'S3.3', 'S3.4']],
    ['F4', ['S4.1', 'S4.2', 'S4.3']], ['F5', ['S5.1', 'S5.2', 'S5.3']], ['F6', ['S6.1']], ['F7', ['S7.1']],
    ['G', ['G1', 'G2', 'G3', 'G4']], ['L', ['L1']],
  ]
  if (groups.flatMap(g => g[1]).length !== 23 || Object.keys(out).length !== 23) throw new Error('expected 23 scenarios')
  const W = WIDTH
  const left = 76, right = 64, ggap = 9
  const pitch = (W - left - right - ggap * (groups.length - 1)) / 23
  const yTop = 1, yGroup = 23, yIds = 48, yMid = 60, yR1 = 84, yR2 = 114, yBottom = 136
  let s = `<line x1="0" y1="${yTop}" x2="${W}" y2="${yTop}" stroke="${INK}" stroke-width="1"/>`
  s += `<text x="0" y="${yGroup}" font-size="${T.head}" font-style="italic">System</text>`
  s += `<text x="${W}" y="${yGroup}" font-size="${T.head}" font-style="italic" text-anchor="end">Prevented</text>`
  let x = left
  const centres = []
  for (const [g, ids] of groups) {
    const gx0 = x
    ids.forEach((id, k) => { centres.push([id, x + pitch / 2]); s += `<text x="${x + pitch / 2}" y="${yIds}" font-size="${T.small}" text-anchor="middle" fill="${GREY}">${k + 1}</text>`; x += pitch })
    s += `<text x="${(gx0 + x) / 2}" y="${yGroup}" font-size="${T.bold}" text-anchor="middle" font-weight="700">${g}</text>`
    s += `<line x1="${gx0 + 2}" y1="${yGroup + 8}" x2="${x - 2}" y2="${yGroup + 8}" stroke="${INK}" stroke-width="${RULE}"/>`
    x += ggap
  }
  s += `<line x1="0" y1="${yMid}" x2="${W}" y2="${yMid}" stroke="${INK}" stroke-width="${RULE}"/>`
  ;[['Baseline', yR1, 0], ['ERMA-GRC', yR2, 1]].forEach(([label, y, k]) => {
    s += `<text x="0" y="${y + 4}" font-size="${T.body + 0.5}">${label}</text>`
    for (const [id, cx] of centres) {
      s += out[id][k]
        ? `<circle cx="${cx}" cy="${y}" r="5" fill="${INK}"/>`
        : `<circle cx="${cx}" cy="${y}" r="4.5" fill="white" stroke="${INK}" stroke-width="1.05"/>`
    }
    const total = Object.values(out).filter(v => v[k]).length
    s += `<text x="${W}" y="${y + 4}" font-size="${T.body + 0.5}" text-anchor="end">${total} / 23</text>`
  })
  s += `<line x1="0" y1="${yBottom}" x2="${W}" y2="${yBottom}" stroke="${INK}" stroke-width="1"/>`
  const ky = yBottom + 24
  s += `<circle cx="${left + 5}" cy="${ky - 4}" r="5" fill="${INK}"/><text x="${left + 15}" y="${ky}" font-size="${T.body}">Prevented</text>`
  s += `<circle cx="${left + 105}" cy="${ky - 4}" r="4.5" fill="white" stroke="${INK}" stroke-width="1.05"/><text x="${left + 115}" y="${ky}" font-size="${T.body}">Occurred</text>`
  return { svg: s, W, H: ky + 4 }
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: SCALE })
  for (const [name, fig] of [['figure-1-dsr-process', figure1()], ['figure-2-scenario-outcomes', figure2()]]) {
    const M = 10 // white margin around the drawing
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fig.W + 2 * M}" height="${fig.H + 2 * M}" viewBox="${-M} ${-M} ${fig.W + 2 * M} ${fig.H + 2 * M}" font-family="${FONT}" fill="${INK}" text-rendering="geometricPrecision">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="${INK}"/></marker></defs>
      <rect width="100%" height="100%" fill="white"/>${fig.svg}</svg>`
    fs.writeFileSync(path.join(OUT, `${name}.svg`), svg)
    await page.setViewportSize({ width: fig.W + 30, height: Math.ceil(fig.H) + 30 })
    await page.setContent(`<html><body style="margin:0;padding:10px;background:white">${svg}</body></html>`)
    await page.locator('svg').screenshot({ path: path.join(OUT, `${name}.png`) })
    console.log(name, fig.W, Math.ceil(fig.H))
  }
  await browser.close()
})()
