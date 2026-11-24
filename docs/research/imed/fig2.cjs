// Fig. 2: AI-originated incidents by error type (columns) and by what caught them (rows).
const data = require('./fig2-data.json')
module.exports = (W, T, INK, GREY, LIGHT, RULE, esc) => {
  const rows = data.detectors, cols = data.types, short = data.type_short
  const n = (r, c) => ((data.incidents[c] || {})[r] || []).length
  const left = 128, top = 30, rowH = 19, right = 30
  const cw = (W - left - right) / cols.length
  let s = ''
  // column heads (two lines where needed)
  short.forEach((h, j) => {
    const x = left + j * cw + cw / 2
    const parts = h.split(' ')
    const lines = parts.length > 1 && h.length > 9 ? [parts.slice(0, -1).join(' '), parts.at(-1)] : [h]
    lines.forEach((l, k) => { s += `<text x="${x}" y="${top - 16 + k * 10 - (lines.length - 1) * 5 + 5}" font-size="${T.small}" text-anchor="middle" font-style="italic">${esc(l)}</text>` })
  })
  s += `<text x="${W}" y="${top - 6}" font-size="${T.small}" text-anchor="end" font-style="italic">Total</text>`
  s += `<line x1="0" x2="${W}" y1="${top - 2}" y2="${top - 2}" stroke="${INK}" stroke-width="${RULE}"/>`
  let grand = 0
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2 + 2
    if (i % 2 === 1) s += `<rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="#f2f2f2"/>`
    s += `<text x="0" y="${y + 3.5}" font-size="${T.small}">${esc(r)}</text>`
    let tot = 0
    cols.forEach((c, j) => {
      const v = n(r, c); tot += v
      if (!v) return
      const cx = left + j * cw + cw / 2, rad = 2.2 + Math.sqrt(v) * 2.4
      s += `<circle cx="${cx}" cy="${y}" r="${rad}" fill="${INK}"/>`
      s += `<text x="${cx + rad + 2}" y="${y + 3.5}" font-size="${T.small}">${v}</text>`
    })
    grand += tot
    s += `<text x="${W}" y="${y + 3.5}" font-size="${T.small}" text-anchor="end">${tot}</text>`
  })
  const yb = top + rows.length * rowH + 2
  s += `<line x1="0" x2="${W}" y1="${yb}" y2="${yb}" stroke="${INK}" stroke-width="${RULE}"/>`
  s += `<text x="0" y="${yb + 12}" font-size="${T.small}" font-style="italic">Total</text>`
  cols.forEach((c, j) => {
    const v = rows.reduce((a, r) => a + n(r, c), 0)
    s += `<text x="${left + j * cw + cw / 2}" y="${yb + 12}" font-size="${T.small}" text-anchor="middle">${v}</text>`
  })
  s += `<text x="${W}" y="${yb + 12}" font-size="${T.small}" text-anchor="end">${grand}</text>`
  return { svg: s, H: yb + 16 }
}
