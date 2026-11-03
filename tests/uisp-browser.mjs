import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5183, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), data = fixtures(), errors = []
    let saved, downloads = 0
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => { localStorage.setItem('usriolunato:__secret', 'test-only'); localStorage.setItem('usriolunato:__management_token', 'test-session') })
    await context.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
      if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] || [] }))
      if (b.action === 'list') res.items = data[b.collection] || []
      if (b.action === 'managementDevices') res.devices = []
      if (b.action === 'managementActivities') Object.assign(res, { activities: [], total: 0 })
      if (b.action === 'managementStandingsConfig') res.config = { tipo: 'uisp', categoria: '3', girone: 'B' }
      if (b.action === 'managementSaveStandings') saved = b.config
      if (b.action === 'standings') Object.assign(res, { tipo: 'uisp', categoria: '3', girone: 'B', pdfUrl: 'https://calcio.uispmodena.it/upload/c_allegati/file/1/995.pdf', comunicato: '2026-10-28' })
      if (b.action === 'standingsPdf') { downloads++; Object.assign(res, { pdfUrl: 'https://calcio.uispmodena.it/upload/c_allegati/file/1/995.pdf', dataBase64: readFileSync(new URL('./fixtures/uisp-girone.base64.txt', import.meta.url), 'utf8').trim() }) }
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5183/#/management')
    await page.getByRole('tab', { name: 'Classifica', exact: true }).click()
    await page.getByRole('combobox', { name: 'Categoria UISP', exact: true }).waitFor()
    assert.equal(await page.getByLabel('URL HTTPS dell’API', { exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Salva fonte per 2026/27', exact: true }).click()
    await page.waitForTimeout(300)
    assert.equal(saved.tipo, 'uisp')
    assert.equal(saved.categoria, '3')
    assert.equal(saved.girone, 'B')
    await page.goto('http://127.0.0.1:5183/#/classifica')
    await page.getByRole('cell', { name: 'RIOLUNATO U.S', exact: true }).waitFor({ timeout: 20000 })
    await page.getByRole('heading', { name: 'Risultati del girone', exact: true }).waitFor()
    assert.equal(await page.locator('iframe').count(), 0)
    const tables = page.locator('.ant-table-tbody')
    assert.equal(await tables.nth(0).locator('tr[data-row-key]').count(), 10)
    assert.equal(await tables.nth(1).locator('tr[data-row-key]').count(), 4)
    await page.getByText(/Aggiornamento settimanale, non in tempo reale/).waitFor()
    assert.equal(downloads, 1)
    await page.getByRole('button', { name: 'Aggiorna', exact: true }).click()
    await page.waitForTimeout(1000)
    assert.equal(downloads, 2, 'aggiornamento esplicito rilegge anche un PDF corretto con lo stesso URL')
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('UISP: configurazione senza API, lettura PDF, classifica e risultati verificati desktop/mobile')
} finally { await browser?.close(); await server.close() }
