// usage: node shot.mjs <outdir> <file.html>... ; captures 390 light/dark + 1440 light, full page
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
const [out, ...files] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const sizes = (process.env.SIZES || 'm-light,m-dark,d-light').split(',')
for (const f of files) {
  for (const s of sizes) {
    const [dev, theme] = s.split('-')
    const ctx = await b.newContext({ viewport: dev === 'm' ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: dev === 'm', hasTouch: dev === 'm' })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await p.goto('file://' + path.resolve(f) + '?theme=' + theme, { waitUntil: 'networkidle' })
    await p.waitForTimeout(300)
    const name = path.basename(f, '.html') + '.' + s + '.png'
    await p.screenshot({ path: path.join(out, name), fullPage: true })
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    console.log(name, 'h=' + await p.evaluate(() => document.documentElement.scrollHeight), ov > 0 ? 'OVERFLOW ' + ov : '', errs.length ? 'ERR ' + errs.join(' | ') : '')
    await ctx.close()
  }
}
await b.close()
