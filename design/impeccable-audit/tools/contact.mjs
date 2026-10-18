// node contact.mjs <outdir> <dev m|d> <theme> <prefix> : first-viewport contact sheet of screens/<prefix>*.html
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const [out, dev, theme, prefix, full] = process.argv.slice(2)
const dir = new URL('../mockup/screens', import.meta.url).pathname
const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.html')).sort()
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const vp = dev === 'm' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const ctx = await b.newContext({ viewport: vp, isMobile: dev === 'm', hasTouch: dev === 'm' })
const p = await ctx.newPage()
const shots = []
for (const f of files) {
  const errs = []
  p.removeAllListeners('pageerror'); p.on('pageerror', e => errs.push(e.message))
  await p.goto('file://' + path.join(dir, f) + '?theme=' + theme, { waitUntil: 'networkidle' })
  await p.waitForTimeout(250)
  const h = await p.evaluate(() => document.documentElement.scrollHeight)
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  const buf = await p.screenshot({ fullPage: full === 'full' })
  shots.push({ f, h, ov, errs, b64: buf.toString('base64') })
  console.log(f, 'h=' + h, ov > 0 ? 'OVERFLOW ' + ov : '', errs.join('|'))
}
const cols = dev === 'm' ? 6 : 3
const w = dev === 'm' ? 300 : 620
const html = `<html><body style="margin:0;background:#888;font:14px sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:12px;padding:12px;align-items:start">` +
  shots.map(s => `<div><div style="font-weight:700;margin-bottom:4px;color:#fff">${s.f} (${s.h})</div><img style="width:${w}px;display:block" src="data:image/png;base64,${s.b64}"></div>`).join('') + '</div></body></html>'
const m = await ctx.newPage()
await m.setViewportSize({ width: cols * (w + 12) + 12, height: 800 })
await m.setContent(html)
await m.waitForTimeout(300)
fs.mkdirSync(out, { recursive: true })
await m.screenshot({ path: path.join(out, `sheet-${prefix}-${dev}-${theme}.png`), fullPage: true })
await b.close()
