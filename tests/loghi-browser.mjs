import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5182, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), data = fixtures(), errors = [], seasons = []
    data.loghi = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('usriolunato:__secret', 'test-only'))
    await context.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
      if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] || [] }))
      if (b.action === 'list') res.items = data[b.collection] || []
      if (b.action === 'put' && b.collection === 'loghi') { data.loghi = [b.record]; seasons.push(b.season) }
      if (b.action === 'delete' && b.collection === 'loghi') data.loghi = []
      if (b.action === 'standings') Object.assign(res, { tipo: 'api', righe: [{ squadra: 'U.S. Riolunato', punti: 12 }, { squadra: 'Squadra senza logo', punti: 10 }], aggiornato: new Date().toISOString() })
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5182/#/loghi')
    await page.getByLabel('Squadra del logo', { exact: true }).fill('U.S. Riolunato')
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const ctx = c.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 32, 32); return c.toDataURL('image/png').split(',')[1] })
    await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByAltText('Anteprima logo', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Salva logo', exact: true }).click()
    await page.getByAltText('Logo U.S. Riolunato', { exact: true }).waitFor()
    await page.waitForTimeout(1000)
    assert.equal(data.loghi[0].rapporto, 0.5)
    assert.ok(data.loghi[0].dataUrl.length < 36000)
    assert.deepEqual(seasons, ['globale'])
    await page.reload()
    await page.getByAltText('Logo U.S. Riolunato', { exact: true }).waitFor()
    await page.goto('http://127.0.0.1:5182/#/classifica')
    await page.getByAltText('Logo U.S. Riolunato', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'Squadra senza logo', exact: true }).waitFor()
    await page.goto('http://127.0.0.1:5182/#/social')
    await page.getByRole('combobox', { name: 'Logo dalla libreria', exact: true }).waitFor()
    await page.goto('http://127.0.0.1:5182/#/loghi')
    await page.getByRole('button', { name: 'Modifica', exact: true }).click()
    await page.getByLabel('Squadra del logo', { exact: true }).fill('Riolunato Calcio')
    await page.getByRole('button', { name: 'Salva modifiche logo', exact: true }).click()
    await page.getByAltText('Logo Riolunato Calcio', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Elimina', exact: true }).click()
    await page.locator('.ant-popconfirm').getByRole('button', { name: 'Elimina', exact: true }).click()
    await page.getByText('Carica il primo logo per riutilizzarlo nelle grafiche e nella classifica API.', { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('Loghi: caricamento trasparente, persistenza globale, classifica, libreria grafiche, modifica ed eliminazione verificati desktop/mobile')
} finally { await browser?.close(); await server.close() }
