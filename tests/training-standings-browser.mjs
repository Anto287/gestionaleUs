import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5181, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ headless: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), data = fixtures(), errors = []
    let saved, config = { tipo: 'nessuna', url: '' }, cleared = false
    data.allenamenti = [{ id: 'seduta-test', data: '2026-10-30', presenze: {} }]
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      localStorage.setItem('usriolunato:__secret', 'test-only')
      localStorage.setItem('usriolunato:__management_token', JSON.stringify('test-session'))
    })
    await context.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
      if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] || [] }))
      if (b.action === 'list') res.items = data[b.collection] || []
      if (b.action === 'put' && b.collection === 'allenamenti') { saved = b.record; data.allenamenti = [saved] }
      if (b.action === 'standings') Object.assign(res, { tipo: 'api', righe: [{ squadra: 'U.S. Riolunato', punti: 12 }], aggiornato: new Date().toISOString() })
      if (b.action === 'managementDevices') res.devices = []
      if (b.action === 'managementActivities') Object.assign(res, { activities: [], total: 0 })
      if (b.action === 'managementStandingsConfig') res.config = config
      if (b.action === 'managementSaveStandings') config = b.config
      if (b.action === 'managementClearActivities') cleared = true
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5181/#/allenamenti?seduta=seduta-test')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Genera esercizi', exact: true }).click()
    assert.match(await page.getByLabel('Programma di allenamento', { exact: true }).inputValue(), /90 minuti/)
    await page.getByLabel('Attività svolta e osservazioni', { exact: true }).fill('Lavoro sul possesso eseguito')
    await page.getByRole('button', { name: 'Salva programma e resoconto', exact: true }).click()
    await page.waitForTimeout(1000)
    assert.match(saved.programma, /90 minuti/)
    assert.equal(saved.svolto, 'Lavoro sul possesso eseguito')
    await page.goto('http://127.0.0.1:5181/#/classifica')
    await page.getByRole('cell', { name: 'U.S. Riolunato', exact: true }).waitFor()
    await page.goto('http://127.0.0.1:5181/#/management')
    await page.getByRole('button', { name: 'Elimina tutti i LOG', exact: true }).click()
    await page.getByRole('button', { name: 'Elimina tutti', exact: true }).click()
    await page.waitForTimeout(500)
    assert.equal(cleared, true)
    await page.getByRole('tab', { name: 'Classifica', exact: true }).click()
    await page.getByLabel('URL HTTPS del widget o dell’API', { exact: true }).fill('https://www.tuttocampo.it/WidgetV2/Classifica/demo')
    await page.getByRole('button', { name: 'Salva fonte per 2026/27', exact: true }).click()
    await page.waitForTimeout(500)
    assert.match(config.url, /tuttocampo/)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: `/private/tmp/training-standings-${width}.png`, fullPage: true })
    await context.close()
  }
  console.log('Programma, resoconto, classifica, configurazione e pulizia log verificati su desktop e mobile')
} finally { await browser?.close(); await server.close() }
