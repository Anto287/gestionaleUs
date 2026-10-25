import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import { mockDrive } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5177, strictPort: true } })
await server.listen()
let browser
const checks = [], errors = [], out = '/tmp/us-variants'
await fs.mkdir(out, { recursive: true })
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push(e.message))
  await mockDrive(page)
  const cases = [
    ['/magazzino', 'Materiale', 'tab'], ['/magazzino', 'Manutenzione', 'tab'], ['/magazzino', 'Borsa medica', 'tab'], ['/magazzino', 'Tute da gara', 'tab'],
    ['/statistiche', "Albo d'oro", 'tab'], ['/social', 'Risultato', 'segment'], ['/social', 'Mese', 'segment'], ['/social', 'Formazione', 'segment'],
    ['/formazione', 'Genera formazione', 'generate'], ['/conti', 'Filtri', 'drawer'], ['/rosa', 'Filtri', 'drawer'],
  ]
  for (const [route, label, kind] of cases) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`http://127.0.0.1:5177/#${route}`)
    await page.locator('.app-container').waitFor()
    await page.locator('.pagina-in-arrivo').waitFor({ state: 'hidden' })
    if (kind === 'tab') await page.getByRole('tab', { name: new RegExp(label) }).click()
    if (kind === 'segment') await page.locator('.ant-segmented-item').filter({ hasText: label }).first().click()
    if (kind === 'generate') {
      await page.getByRole('button', { name: 'Tutti', exact: true }).click()
      await page.getByRole('button', { name: new RegExp(label) }).click()
      await page.locator('.campo').waitFor()
    }
    if (kind === 'drawer') {
      await page.getByRole('button', { name: new RegExp(label) }).click()
      await page.getByRole('dialog').waitFor()
      await page.waitForTimeout(300)
    }
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 768 : 900 })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const issues = await page.evaluate(() => {
        const bad = []
        if (document.documentElement.scrollWidth > innerWidth + 1) bad.push({ type: 'page', width: document.documentElement.scrollWidth })
        const canvas = document.querySelector('.ed-stage-wrap')
        if (canvas && canvas.getBoundingClientRect().width < 240) bad.push({ type: 'canvas', width: canvas.getBoundingClientRect().width })
        for (const btn of document.querySelectorAll('.app-container button,.ant-drawer-footer button')) {
          if (!btn.checkVisibility({ checkVisibilityCSS: true })) continue
          if (btn.scrollWidth > btn.clientWidth + 4) bad.push({ type: 'button', text: btn.textContent.slice(0, 60) })
        }
        return bad
      })
      checks.push({ route, label, width, issues })
      if (issues.length) console.log(JSON.stringify(checks.at(-1)))
      if (!process.env.CI) await page.screenshot({ path: `${out}/${route.slice(1)}-${label.replaceAll(' ', '-')}-${width}.png`, fullPage: false })
    }
    if (kind === 'drawer') await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).first().click()
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('http://127.0.0.1:5177/#/social')
  await page.getByRole('button', { name: /Design/ }).click()
  await page.getByText('Design della grafica', { exact: true }).waitFor()
  if (!process.env.CI) await page.screenshot({ path: `${out}/social-design-tablet.png` })
  await page.getByRole('dialog').locator('.ant-drawer-close').click()
  await fs.writeFile(`${out}/audit.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ variants: checks.length, problematic: checks.filter((c) => c.issues.length).length, errors }))
  assert.equal(checks.some((c) => c.issues.length), false)
  assert.deepEqual(errors, [])
} finally { await browser?.close(); await server.close() }
