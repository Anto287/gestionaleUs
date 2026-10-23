import { chromium } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import { mockDrive } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } })
await server.listen()
let browser
const checks = []
const out = '/tmp/us-layout-final'
await fs.mkdir(out, { recursive: true })
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await mockDrive(page)
  const routes = ['/', '/rosa', '/allenamenti', '/partite', '/avversari', '/calendario', '/statistiche', '/formazione', '/piazzati', '/distinte', '/social', '/magazzino', '/conti', '/spese', '/documenti', '/archivio', '/impostazioni', '/rosa/g0', '/partite/p0', '/avversari/avv']
  const widths = process.env.US_AUDIT_QUICK ? [320, 768, 1024, 1440] : [320, 390, 768, 1024, 1440]
  for (const theme of ['chiaro', 'scuro']) {
  await page.addInitScript((t) => localStorage.setItem('usriolunato:tema', t), theme)
  await page.goto('http://127.0.0.1:5174/')
  await page.reload()
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5174/#${route}`)
    await page.locator('.app-container').waitFor()
    await page.locator('.pagina-in-arrivo').waitFor({ state: 'hidden' })
    // Wait for the route transition, not only the unchanged parent shell.
    await page.waitForTimeout(120)
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => window.scrollTo(0, 0))
      const issues = await page.evaluate(() => {
        const bad = []
        if (document.documentElement.scrollWidth > innerWidth + 1) bad.push({ type: 'page', width: document.documentElement.scrollWidth })
        const root = document.querySelector('.app-container')
        for (const el of root.querySelectorAll('button, .ant-card, .ant-select, .ant-input-affix-wrapper, .lista-card')) {
          if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height) continue
          let scrollable = false
          for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
            if (/auto|scroll/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth + 2) { scrollable = true; break }
          }
          if (!scrollable && (r.right > innerWidth + 2 || r.left < -2)) bad.push({ type: 'outside', tag: el.tagName, text: el.textContent.slice(0, 65), left: Math.round(r.left), right: Math.round(r.right) })
          if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 4) bad.push({ type: 'button', text: el.textContent.slice(0, 70), width: el.clientWidth, needed: el.scrollWidth })
        }
        for (const item of root.querySelectorAll('.page-actions > .ant-space > .ant-space-item')) {
          const control = item.querySelector('.ant-select,button')
          if (!control) continue
          const a = item.getBoundingClientRect(), b = control.getBoundingClientRect()
          if (b.right > a.right + 2) bad.push({ type: 'action', text: control.textContent.slice(0, 50) })
        }
        const canvas = root.querySelector('.ed-stage-wrap')
        if (canvas && canvas.getBoundingClientRect().width < Math.min(240, innerWidth - 32)) bad.push({ type: 'canvas', width: canvas.getBoundingClientRect().width })
        for (const title of root.querySelectorAll('.ant-card-head-title,.ant-statistic-title')) {
          if (title.scrollWidth > title.clientWidth + 3) bad.push({ type: 'title', text: title.textContent.slice(0, 70) })
        }
        return bad
      })
      const name = `${route.slice(1).replaceAll('/', '-') || 'panoramica'}-${width}`
      if (!process.env.CI) await page.screenshot({ path: `${out}/${theme}-${name}.png`, fullPage: true })
      checks.push({ theme, route, width, issues })
      if (issues.length) console.log(JSON.stringify({ route, width, issues }))
    }
  }
  }
  await fs.writeFile(`${out}/audit.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ views: checks.length, problematic: checks.filter((x) => x.issues.length).length, errors }))
  if (errors.length || checks.some((x) => x.issues.length)) throw new Error('Controllo layout non superato: consultare audit.json')
} finally { await browser?.close(); await server.close() }
