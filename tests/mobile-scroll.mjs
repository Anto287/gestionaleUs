import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mockDrive } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5178, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await mockDrive(page)
  const cdp = await context.newCDPSession(page)
  async function swipe(x, y, endY) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (endY - y) * i / 12 }] })
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(300)
  }
  await page.goto('http://127.0.0.1:5178/')
  await page.locator('.app-container').waitFor()
  // Popup scrollabile e popup corto: il gesto non deve mai passare al documento.
  await page.evaluate(() => {
    document.body.style.minHeight = '5000px'
    const root = document.createElement('div')
    root.className = 'ant-select-dropdown'; root.id = 'scroll-fixture'
    root.style.cssText = 'position:fixed;top:100px;left:40px;width:300px;height:200px;z-index:10000;'
    root.innerHTML = '<div id="options-fixture" style="height:200px;overflow:auto"><div style="height:2000px">Opzioni di prova</div></div>'
    document.body.append(root); window.scrollTo(0, 300)
  })
  const initial = await page.evaluate(() => window.scrollY)
  await swipe(150, 250, 140)
  assert.equal(await page.evaluate(() => window.scrollY), initial)
  assert.ok(await page.locator('#options-fixture').evaluate((e) => e.scrollTop > 0))
  await page.locator('#options-fixture').evaluate((e) => { e.scrollTop = e.scrollHeight })
  await swipe(150, 250, 140)
  assert.equal(await page.evaluate(() => window.scrollY), initial, 'bordo inferiore isolato')
  await page.locator('#options-fixture').evaluate((e) => { e.scrollTop = 0 })
  await swipe(150, 140, 250)
  assert.equal(await page.evaluate(() => window.scrollY), initial, 'bordo superiore isolato')
  await page.locator('#options-fixture').evaluate((e) => { e.firstElementChild.style.height = '30px' })
  await swipe(150, 250, 140)
  assert.equal(await page.evaluate(() => window.scrollY), initial, 'popup senza overflow isolato')
  await page.locator('#scroll-fixture').evaluate((e) => e.remove())
  await swipe(350, 650, 350)
  assert.ok(await page.evaluate((start) => window.scrollY > start, initial), 'pagina sbloccata dopo la chiusura')
  await page.evaluate(() => { document.body.style.minHeight = '' })
  await page.goto('http://127.0.0.1:5178/#/social')
  const canvas = page.locator('.ed-stage-wrap canvas').first()
  await canvas.waitFor()
  await canvas.evaluate((c) => {
    document.body.style.minHeight = '5000px'
    window.scrollTo(0, window.scrollY + c.getBoundingClientRect().top - 100)
  })
  await page.waitForTimeout(500)
  assert.equal(await page.getByRole('button', { name: 'Sposta elementi', exact: true }).count(), 0)
  await page.locator('.ed-toolbar').getByRole('button', { name: 'Testo', exact: true }).click()
  await canvas.evaluate((c) => window.scrollTo(0, window.scrollY + c.getBoundingClientRect().top - 100))
  await page.waitForTimeout(300)
  const box = await canvas.boundingBox()
  const beforeScroll = await page.evaluate(() => window.scrollY)
  const beforePixels = await canvas.evaluate((c) => c.toDataURL())
  // Il testo appena aggiunto è centrato sulla tela e deve essere trascinabile subito.
  const startY = box.y + box.height / 2
  await swipe(box.x + box.width / 2, startY, startY + 70)
  assert.equal(await page.evaluate(() => window.scrollY), beforeScroll, 'la pagina resta ferma mentre trascino')
  assert.notEqual(await canvas.evaluate((c) => c.toDataURL()), beforePixels, 'il testo si sposta con il dito')
  await page.locator('.ed-toolbar button').first().click()
  await page.waitForTimeout(200)
  assert.equal(await canvas.evaluate((c) => c.toDataURL()), beforePixels, 'Annulla ripristina la posizione del testo')
  assert.deepEqual(errors, [])
  console.log('Scroll mobile verificato: popup e bordi isolati, pagina sbloccata alla chiusura, trascinamento touch immediato e annullamento della modifica.')
} finally { await browser?.close(); await server.close() }
