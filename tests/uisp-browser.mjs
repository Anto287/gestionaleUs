import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
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
    let saved, downloads = 0, next = false, offline = false
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => { localStorage.setItem('usriolunato:__secret', 'test-only'); localStorage.setItem('usriolunato:__management_token', 'test-session') })
    await context.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      if (offline && b.action === 'standings') return route.abort()
      if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
      if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] || [] }))
      if (b.action === 'list') res.items = data[b.collection] || []
      if (b.action === 'managementDevices') res.devices = []
      if (b.action === 'managementActivities') Object.assign(res, { activities: [], total: 0 })
      if (b.action === 'managementStandingsConfig') res.config = { tipo: 'uisp', categoria: '3', girone: 'B' }
      if (b.action === 'managementSaveStandings') saved = b.config
      if (b.action === 'standings') Object.assign(res, { tipo: 'uisp', categoria: '3', girone: 'B', pdfUrl: `https://calcio.uispmodena.it/upload/c_allegati/file/1/${next ? 996 : 995}.pdf`, comunicato: next ? '2026-11-04' : '2026-10-28' })
      if (b.action === 'standingsPdf') { downloads++; Object.assign(res, { pdfUrl: `https://calcio.uispmodena.it/upload/c_allegati/file/1/${next ? 996 : 995}.pdf`, dataBase64: readFileSync(new URL('./fixtures/uisp-girone.base64.txt', import.meta.url), 'utf8').trim() }) }
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5183/#/impostazioni')
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
    await page.getByRole('button', { name: 'Aggiorna classifica', exact: true }).click()
    await page.getByRole('button', { name: 'Aggiorna classifica', exact: true }).waitFor()
    await page.waitForTimeout(500)
    assert.equal(downloads, 1, 'stesso comunicato: nessun download del PDF')
    await page.reload()
    await page.getByRole('cell', { name: 'RIOLUNATO U.S', exact: true }).waitFor()
    await page.waitForTimeout(500)
    assert.equal(downloads, 1, 'cache persistente anche dopo reload')
    next = true
    await page.getByRole('button', { name: 'Aggiorna classifica', exact: true }).click()
    await page.getByText('Comunicato del 04/11/2026', { exact: true }).waitFor()
    assert.equal(downloads, 2, 'nuovo comunicato scaricato automaticamente')
    await page.getByRole('button', { name: 'Rileggi PDF', exact: true }).click()
    await page.waitForTimeout(1000)
    assert.equal(downloads, 3, 'rilettura esplicita per correzioni allo stesso URL')
    await page.getByRole('button', { name: 'Esporta classifica', exact: true }).click()
    await page.getByRole('button', { name: 'Anteprima Instagram', exact: true }).click()
    const preview = page.getByAltText('Anteprima classifica, pagina 1')
    await preview.waitFor()
    assert.equal(await preview.evaluate((img) => img.naturalWidth), 1080)
    assert.equal(await preview.evaluate((img) => img.naturalHeight), 1350)
    const pagination = await page.evaluate(async () => {
      const { preparaGrafiche } = await import('/src/pages/classifica/esporta.ts')
      const righe = Array.from({ length: 31 }, (_, i) => ({ squadra: `Squadra ${i} con un nome molto lungo e composto`, punti: 31 - i }))
      return (await preparaGrafiche({ tipo: 'api', righe }, '2026/27', [], 'post')).map((c) => [c.width, c.height])
    })
    assert.deepEqual(pagination, [[1080, 1350], [1080, 1350], [1080, 1350]])
    const pngDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: /Scarica PNG/ }).click()
    assert.match((await pngDownload).suggestedFilename(), /\.png$/)
    await page.getByText('Storia · 9:16', { exact: true }).click()
    await page.getByRole('button', { name: 'Anteprima Instagram', exact: true }).click()
    await preview.waitFor()
    assert.equal(await preview.evaluate((img) => img.naturalHeight), 1920)
    const pdfDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Scarica PDF A4', exact: true }).click()
    const pdf = await pdfDownload
    assert.match(pdf.suggestedFilename(), /\.pdf$/)
    const path = await pdf.path()
    assert.ok(readFileSync(path).subarray(0, 5).toString() === '%PDF-')
    mkdirSync('/tmp/us-classifica-preview', { recursive: true })
    await page.screenshot({ path: `/tmp/us-classifica-preview/classifica-${width}.png`, fullPage: true })
    await preview.screenshot({ path: `/tmp/us-classifica-preview/instagram-${width}.png` })
    offline = true
    await page.getByRole('button', { name: 'Aggiorna classifica', exact: true }).click()
    await page.getByText('Mostriamo l’ultima copia salvata', { exact: true }).waitFor()
    await page.getByRole('cell', { name: 'RIOLUNATO U.S', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log('UISP: configurazione senza API, lettura PDF, classifica e risultati verificati desktop/mobile')
} finally { await browser?.close(); await server.close() }
