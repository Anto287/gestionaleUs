import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import fs from 'node:fs/promises'
import { mockDrive } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5176, strictPort: true } })
await server.listen()
let browser
const checks = [], errors = []
const out = '/tmp/us-overlays'
await fs.mkdir(out, { recursive: true })
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push(e.message))
  await mockDrive(page)
  const cases = [
    ['/', 'Aggiungi'], ['/rosa/g0', 'Aggiungi$'],
    ['/rosa', 'Aggiungi giocatore'], ['/allenamenti', 'Nuova seduta'], ['/partite', 'Nuova partita'],
    ['/avversari', 'Nuova squadra'], ['/calendario', 'Nuovo impegno'], ['/magazzino', 'Nuovo articolo'],
    ['/conti', 'Nuovo movimento'], ['/conti', 'Esporta PDF'], ['/spese', 'Nuova spesa'],
    ['/rosa/g0', 'Modifica'], ['/rosa/g0', 'Aggiungi versamento'], ['/partite/p0', 'Modifica'],
  ]
  for (const [route, action] of cases) {
    await page.goto(`http://127.0.0.1:5176/#${route}`)
    await page.locator('.app-container').waitFor()
    const button = page.getByRole('button', { name: new RegExp(action) }).first()
    await button.click()
    await page.getByRole('dialog').waitFor()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.getByRole('dialog').evaluate(async (el) => { await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))) })
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 1024 ? 768 : width === 768 ? 1024 : 900 })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const issues = await page.evaluate(() => {
        const modal = [...document.querySelectorAll('.ant-modal')].find((el) => el.checkVisibility({ checkVisibilityCSS: true }))
        const bad = [], box = modal.getBoundingClientRect()
        if (box.left < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) bad.push({ type: 'modal', left: box.left, right: box.right, bottom: box.bottom })
        const footer = modal.querySelector('.ant-modal-footer')?.getBoundingClientRect()
        if (footer && footer.bottom > innerHeight) bad.push({ type: 'footer', bottom: footer.bottom })
        for (const el of modal.querySelectorAll('button,.ant-select,.ant-picker,.ant-input-number,.ant-input-affix-wrapper')) {
          if (!el.checkVisibility({ checkVisibilityCSS: true })) continue
          const r = el.getBoundingClientRect()
          if (r.left < box.left - 1 || r.right > box.right + 1) bad.push({ type: 'outside', text: el.textContent.slice(0, 50), left: r.left, right: r.right })
          if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 4) bad.push({ type: 'button', text: el.textContent, needed: el.scrollWidth, width: el.clientWidth })
        }
        return bad
      })
      checks.push({ route, action, width, issues })
      if (issues.length) console.log(JSON.stringify(checks.at(-1)))
      if (!process.env.CI) await page.screenshot({ path: `${out}/${route.slice(1).replaceAll('/', '-')}-${action.replaceAll(' ', '-')}-${width}.png` })
    }
    await page.getByRole('dialog').getByRole('button', { name: /Close/ }).click()
  }
  await fs.writeFile(`${out}/audit.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ overlays: checks.length, problematic: checks.filter((c) => c.issues.length).length, errors }))
  assert.equal(checks.some((c) => c.issues.length), false)
  assert.deepEqual(errors, [])
} finally { await browser?.close(); await server.close() }
