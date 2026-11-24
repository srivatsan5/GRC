/**
 * IMED-2027 figures in journal style: black and grey only, hairline rules, serif type
 * (Liberation Serif, metric-compatible with Times New Roman). One IEEE column wide (3.45 in),
 * rendered at 600 dpi.
 *
 *   node docs/research/imed/figures.cjs
 */
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const OUT = path.join(__dirname, 'figures')
const ROOT = path.resolve(__dirname, '../../..')
const W = 331 // CSS px = 3.45 in at 96 px/in
const SCALE = 600 / 96
const FONT = "'Liberation Serif', 'Times New Roman', serif"
const INK = '#111', GREY = '#666', LIGHT = '#d9d9d9', RULE = 0.6
const T = { label: 10.5, small: 9.5 } // ≈ 8 pt and 7 pt at column width
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// ------------------------------------------------------------ Fig. 1: commits per active day, with stages
function figure1() {
  // Commits made with the assistant, read from git (author "Claude", 1–16 Nov 2026)
  const raw = execSync(`git -C "${ROOT}" log --author=Claude --format=%ad --date=short`).toString().trim().split('\n')
  const perDay = {}
  raw.forEach(d => { perDay[d] = (perDay[d] || 0) + 1 })
  const days = Object.keys(perDay).sort()
  const total = raw.length
  const left = 22, right = 4, top = 14, plotH = 92
  const bw = (W - left - right) / days.length
  const max = Math.ceil((Math.max(...Object.values(perDay)) + 3) / 5) * 5
  const y = v => top + plotH - (v / max) * plotH
  let s = ''
  // axis and gridlines
  for (let v = 0; v <= max; v += 5) {
    s += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? LIGHT : INK}" stroke-width="${v ? 0.5 : RULE}"/>`
    s += `<text x="${left - 4}" y="${y(v) + 3}" font-size="${T.small}" text-anchor="end" fill="${GREY}">${v}</text>`
  }
  s += `<text x="0" y="8" font-size="${T.small}" fill="${GREY}" font-style="italic">Commits</text>`
  days.forEach((d, i) => {
    const x = left + i * bw + bw * 0.2, w = bw * 0.6, v = perDay[d]
    s += `<rect x="${x}" y="${y(v)}" width="${w}" height="${y(0) - y(v)}" fill="${INK}"/>`
    s += `<text x="${x + w / 2}" y="${y(v) - 3}" font-size="${T.small}" text-anchor="middle">${v}</text>`
    s += `<text x="${x + w / 2}" y="${y(0) + 11}" font-size="${T.small}" text-anchor="middle">${+d.slice(8)}</text>`
  })
  s += `<text x="${(left + W - right) / 2}" y="${y(0) + 23}" font-size="${T.small}" text-anchor="middle" fill="${GREY}" font-style="italic">Active day (November 2026)</text>`
  // stage bands under the axis
  const stages = [
    ['Audit + rebuild', ['2026-11-01']],
    ['Database', ['2026-11-02', '2026-11-03']],
    ['Gates 1–5, protocol, run', ['2026-11-06']],
    ['Manuscript, Gate 7', ['2026-11-07', '2026-11-08', '2026-11-09']],
  ]
  const by = y(0) + 40
  stages.forEach(([label, ds], k) => {
    const idx = ds.map(d => days.indexOf(d)).filter(i => i >= 0)
    if (!idx.length) return
    const x0 = left + Math.min(...idx) * bw + 2, x1 = left + (Math.max(...idx) + 1) * bw - 2
    const yy = by + (k % 2) * 18
    s += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="${INK}" stroke-width="${RULE}"/>`
    s += `<line x1="${x0}" x2="${x0}" y1="${yy - 2.5}" y2="${yy + 2.5}" stroke="${INK}" stroke-width="${RULE}"/>`
    s += `<line x1="${x1}" x2="${x1}" y1="${yy - 2.5}" y2="${yy + 2.5}" stroke="${INK}" stroke-width="${RULE}"/>`
    const anchor = k === 3 ? 'end' : 'start'
    s += `<text x="${anchor === 'end' ? x1 : x0}" y="${yy - 4}" font-size="${T.small}" text-anchor="${anchor}">${esc(label)}</text>`
  })
  return { svg: s, H: by + 18 + 4, total, days, perDay }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: SCALE })
  const extra = process.argv.slice(2)
  const figs = [['fig1-timeline', figure1()]]
  if (fs.existsSync(path.join(__dirname, 'fig2-data.json'))) figs.push(['fig2-incidents', require('./fig2.cjs')(W, T, INK, GREY, LIGHT, RULE, esc)])
  for (const [name, fig] of figs) {
    const M = 6
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * M}" height="${fig.H + 2 * M}" viewBox="${-M} ${-M} ${W + 2 * M} ${fig.H + 2 * M}" font-family="${FONT}" fill="${INK}" text-rendering="geometricPrecision"><rect x="${-M}" y="${-M}" width="100%" height="100%" fill="white"/>${fig.svg}</svg>`
    fs.writeFileSync(path.join(OUT, `${name}.svg`), svg)
    await page.setViewportSize({ width: W + 40, height: Math.ceil(fig.H) + 40 })
    await page.setContent(`<html><body style="margin:0;padding:10px;background:white">${svg}</body></html>`)
    await page.locator('svg').screenshot({ path: path.join(OUT, `${name}.png`) })
    console.log(name, fig.total !== undefined ? `commits=${fig.total} days=${fig.days.join(',')}` : '')
  }
  await browser.close()
})()
