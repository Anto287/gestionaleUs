import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    let saved, config = { tipo: 'api', url: '' }, cleared = false, legacy = false
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
      if (b.action === 'standings') Object.assign(res, { tipo: legacy ? 'widget' : 'api', righe: [{ squadra: 'U.S. Riolunato', punti: 12 }], aggiornato: new Date().toISOString() })
      if (b.action === 'managementDevices') res.devices = []
      if (b.action === 'managementActivities') Object.assign(res, { activities: [], total: 0 })
      if (b.action === 'managementStandingsConfig') res.config = legacy ? { tipo: 'widget', url: 'https://www.tuttocampo.it/WidgetV2/Classifica/demo' } : config
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
    assert.equal(await page.locator('iframe').count(), 0)
    await page.goto('http://127.0.0.1:5181/#/management')
    await page.getByRole('button', { name: 'Elimina tutti i LOG', exact: true }).click()
    await page.getByRole('button', { name: 'Elimina tutti', exact: true }).click()
    await page.waitForTimeout(500)
    assert.equal(cleared, true)
    await page.goto('http://127.0.0.1:5181/#/impostazioni')
    await page.getByRole('heading', { name: 'Classifica', exact: true }).waitFor()
    await page.getByLabel('URL HTTPS dell’API', { exact: true }).fill('https://api.example.com/standings')
    await page.getByRole('button', { name: 'Salva fonte per 2026/27', exact: true }).click()
    await page.waitForTimeout(500)
    assert.match(config.url, /api.example.com/)
    legacy = true
    await page.goto('http://127.0.0.1:5181/#/classifica')
    await page.getByText('La fonte di questa stagione usa ancora un widget', { exact: true }).waitFor()
    assert.equal(await page.locator('iframe').count(), 0)
    await page.goto('http://127.0.0.1:5181/#/impostazioni')
    await page.getByRole('heading', { name: 'Classifica', exact: true }).waitFor()
    await page.getByText('Sostituisci il precedente widget con una fonte dati', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('URL HTTPS dell’API', { exact: true }).count(), 0)
    await page.getByRole('combobox', { name: 'Categoria UISP', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    await page.screenshot({ path: join(tmpdir(), `training-standings-${width}.png`), fullPage: true })
    await context.close()
  }
  console.log('Programma, resoconto, classifica, configurazione e pulizia log verificati su desktop e mobile')
} finally { await browser?.close(); await server.close() }
