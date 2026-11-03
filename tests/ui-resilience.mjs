import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdirSync } from 'node:fs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5185, strictPort: true } })
await server.listen()
let browser
try {
 browser = await chromium.launch({ headless: true })
 mkdirSync('/tmp/us-resilience', { recursive: true })
 for (const theme of ['chiaro', 'scuro']) for (const width of [320, 390, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript((t) => localStorage.setItem('usriolunato:tema', t), theme)
  await page.goto('http://127.0.0.1:5185/tests/resilience.html')
  await page.locator('.grafico-interattivo').last().waitFor()
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  assert.equal(await overflow(), false, `${width}: pagina con testo lungo`)
  const alert = page.locator('.ant-alert')
  assert.ok((await alert.innerText()).includes('FINE MESSAGGIO'))
  assert.equal(await alert.locator('.ant-alert-description').evaluate((e) => e.scrollWidth > e.clientWidth + 1), false)
  await page.getByRole('button', { name: 'Mostra messaggio lungo', exact: true }).click()
  const toast = page.locator('.ant-message-notice-content'); await toast.waitFor()
  assert.equal(await toast.evaluate((e) => e.getBoundingClientRect().right > innerWidth || e.getBoundingClientRect().left < 0), false)
  assert.equal(await toast.locator('.ant-message-custom-content').evaluate((e) => e.scrollWidth > e.clientWidth + 1), false)
  await page.screenshot({ path: `/tmp/us-resilience/testo-${theme}-${width}.png` })
  // Reload removes test-only persistent toast before interacting with charts.
  await page.reload()
  const charts = page.locator('.grafico-interattivo')
  await charts.last().waitFor()
  for (let i = 0; i < await charts.count(); i++) {
   const chart = charts.nth(i), select = chart.locator('select'), drawing = chart.locator('.grafico-scroll')
   // Exercise both direct touch/click and accessible selection.
   const bar = chart.locator('.recharts-bar-rectangle').first()
   if (await bar.count()) {
    await bar.scrollIntoViewIfNeeded()
    const before = await chart.evaluate((e) => ({ top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height, scroll: window.scrollY, width: document.documentElement.scrollWidth }))
    await bar.click()
    await page.waitForTimeout(80)
    assert.equal(await select.inputValue(), '0', `click seleziona dato nel grafico ${i}`)
    const after = await chart.evaluate((e) => ({ top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height, scroll: window.scrollY, width: document.documentElement.scrollWidth }))
    for (const k of Object.keys(before)) assert.ok(Math.abs(before[k] - after[k]) <= 1, `${width}: grafico ${i}, ${k} si è spostato`)
   }
   await select.scrollIntoViewIfNeeded()
   const before = await chart.boundingBox(), detailBefore = await chart.locator('.grafico-dettaglio').boundingBox()
   await select.selectOption('0')
   const after = await chart.boundingBox(), detailAfter = await chart.locator('.grafico-dettaglio').boundingBox()
   assert.equal(before.height, after.height)
   assert.equal(detailBefore.height, detailAfter.height)
   assert.equal(await overflow(), false)
   await chart.getByText(/Vedi tutti i dati in tabella/).click()
   assert.ok(await chart.locator('tbody tr').count() >= 2)
   if ([320, 390].includes(width)) await chart.screenshot({ path: `/tmp/us-resilience/grafico-${i}-${theme}-${width}.png` })
   await chart.getByText(/Vedi tutti i dati in tabella/).click()
   assert.ok(await drawing.count())
  }
  await page.getByRole('button', { name: 'Mostra notifica lunga', exact: true }).click()
  const notification = page.locator('.ant-notification-notice'); await notification.waitFor()
  assert.equal(await notification.evaluate((e) => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1), false)
  assert.equal(await overflow(), false)
  assert.deepEqual(errors, [])
  await page.close()
 }
 console.log('Testi lunghi, messaggi, notifiche e sei viste dei grafici stabili verificati a 320/390/768/1440px nei due temi')
} finally { await browser?.close(); await server.close() }
