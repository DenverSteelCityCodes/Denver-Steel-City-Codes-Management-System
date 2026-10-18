// Read-only capture of every screen on the live demo (no form submits).
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = 'https://scc.haanie.com'
const OUT = process.argv[2]
fs.mkdirSync(OUT, { recursive: true })

const plan = [
  { role: null, routes: ['/login', '/signup', '/forgot', '/apply', '/unauthorized'] },
  { role: 'Camp admin', routes: ['/admin', '/admin/classes', '/admin/sessions', '/admin/students', '/admin/volunteers', '/admin/interviews', '/admin/duties', '/admin/attendance', '/admin/updates', '/admin/users', '/admin/forms'] },
  { role: 'Parent', routes: ['/parent', '/parent/classes', '/parent/register'] },
  { role: 'Volunteer', routes: ['/volunteer', '/volunteer/classes', '/volunteer/duties', '/volunteer/updates', '/volunteer/profile'] },
  { role: 'Volunteer applicant', routes: ['/volunteer'] },
]
const sizes = [
  { tag: 'm', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { tag: 'd', viewport: { width: 1440, height: 900 } },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
for (const size of sizes) {
  for (const { role, routes } of plan) {
    const ctx = await browser.newContext({ viewport: size.viewport, isMobile: size.isMobile, hasTouch: size.hasTouch, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    if (role) {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: new RegExp('^' + role, 'i') }).first().click()
      await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 })
      await page.waitForLoadState('networkidle')
    }
    for (const r of routes) {
      const slug = ((role ? role.split(' ').pop() + '-' : 'public-') + (r.replace(/\//g, '_').replace(/^_/, '') || 'root')).toLowerCase()
      try {
        await page.goto(BASE + r, { waitUntil: 'networkidle' })
        await page.waitForTimeout(1200)
        await page.screenshot({ path: `${OUT}/${slug}.${size.tag}.png`, fullPage: true })
        if (size.tag === 'd') fs.writeFileSync(`${OUT}/${slug}.txt`, await page.evaluate(() => document.body.innerText))
        console.log('ok', slug, size.tag, page.url())
      } catch (e) { console.log('FAIL', slug, size.tag, e.message.split('\n')[0]) }
    }
    await ctx.close()
  }
}
await browser.close()
