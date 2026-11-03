import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const server = await createServer({ server: { host: '127.0.0.1', port: 5183, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), errors = [], data = fixtures(), calls = []
    let seasons = { stagioni: ['2026/27'], attiva: '2026/27' }
    page.on('pageerror', (e) => errors.push(e.message))
    page.setDefaultTimeout(12000)
    await page.addInitScript(() => localStorage.setItem('usriolunato:__secret', 'test-only'))
    const key = (b) => `${b.season}/${b.collection}`
    const records = {}
    await context.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      calls.push(b)
      if (b.action === 'seasons') Object.assign(res, seasons)
      else if (b.action === 'setSeasons') { assert.equal(b.adminToken, 'test-admin'); seasons = { stagioni: b.stagioni, attiva: b.attiva } }
      else if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: records[key(r)] || data[r.collection] || [] }))
      else if (b.action === 'put') { const k = key(b), items = records[k] ||= []; records[k] = [...items.filter((r) => r.id !== b.record.id), b.record] }
      else if (b.action === 'delete') { const k = key(b); records[k] = (records[k] || []).filter((r) => r.id !== b.id) }
      else if (b.action === 'managementStandingsConfig') res.config = { tipo: 'nessuna' }
      else if (b.action === 'managementDevices') res.devices = []
      else if (b.action === 'managementActivities') Object.assign(res, { activities: [], total: 0 })
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5183/#/impostazioni')
    await page.getByRole('tab', { name: 'Generali', exact: true }).waitFor()
    assert.equal(await page.getByRole('tab', { name: 'Classifica', exact: true }).count(), 0)
    assert.equal(await page.getByRole('tab', { name: 'Stagioni', exact: true }).count(), 0)
    assert.equal(calls.some((b) => b.action === 'setSeasons'), false)
    // Admin session restored, same flow already covered by management-browser login tests.
    await page.evaluate(() => localStorage.setItem('usriolunato:__management_token', 'test-admin'))
    await page.reload()
    await page.getByRole('tab', { name: 'Classifica', exact: true }).click()
    await page.getByRole('button', { name: 'Salva fonte per 2026/27', exact: true }).waitFor()
    await page.getByRole('tab', { name: 'Stagioni', exact: true }).click()
    await page.getByLabel('Nuova stagione', { exact: true }).fill('2027/28')
    await page.getByRole('button', { name: /Crea stagione$/ }).click()
    await page.waitForFunction(() => document.body.textContent.includes('Stagione 2027/28 creata'))
    await page.getByRole('tab', { name: 'Stagioni', exact: true }).click()
    const selezioneSalvata = page.waitForResponse((response) => {
      const body = response.request().postDataJSON()
      return body?.action === 'setSeasons' && body.attiva === '2026/27'
    })
    await page.getByRole('button', { name: 'Rendi attiva', exact: true }).click()
    await selezioneSalvata
    await page.getByRole('tab', { name: 'Generali', exact: true }).waitFor()
    assert.equal(seasons.attiva, '2026/27')
    await page.goto('http://127.0.0.1:5183/#/management')
    await page.getByRole('tab', { name: 'Dispositivi', exact: true }).waitFor()
    assert.equal(await page.getByRole('tab', { name: 'Classifica', exact: true }).count(), 0)
    await page.goto('http://127.0.0.1:5183/#/liste')
    await page.getByRole('button', { name: /Nuova lista$/ }).click()
    await page.getByLabel('Nome lista', { exact: true }).fill('Lista test')
    await page.getByLabel('Nome campo 1', { exact: true }).fill('Partecipante')
    await page.getByRole('checkbox', { name: 'Obbligatorio', exact: true }).check()
    await page.getByRole('button', { name: /Aggiungi campo$/ }).click()
    await page.getByLabel('Nome campo 2', { exact: true }).fill('Pagato')
    await page.locator('.liste-campo').nth(1).locator('.ant-select-selector').click()
    await page.getByText('Sì / No', { exact: true }).click()
    await page.getByRole('button', { name: 'Salva lista', exact: true }).click()
    await page.getByRole('button', { name: /Aggiungi voce$/ }).click()
    let drawer = page.getByRole('dialog', { name: 'Nuova voce', exact: true })
    await drawer.getByRole('button', { name: 'Salva voce', exact: true }).click()
    await drawer.getByText('Compila «Partecipante»', { exact: true }).waitFor()
    await drawer.getByLabel('Partecipante', { exact: true }).fill('Persona test')
    await drawer.locator('.ant-select-selector').click()
    await page.locator('.ant-select-item-option-content').getByText('No', { exact: true }).click()
    await drawer.getByRole('button', { name: 'Salva voce', exact: true }).click()
    await page.getByText('Persona test', { exact: true }).waitFor()
    await page.reload()
    await page.getByText('Persona test', { exact: true }).waitFor()
    assert.equal(Object.values(records).flat().find((r) => r.listaId)?.valori[Object.values(records).flat().find((r) => r.campi)?.campi[1].id], false)
    await page.getByRole('button', { name: /Modifica voce$/ }).click()
    drawer = page.getByRole('dialog', { name: /Modifica voce$/ })
    assert.equal(await drawer.getByText('No', { exact: true }).count(), 1)
    await drawer.getByLabel('Partecipante', { exact: true }).fill('Persona modificata')
    await drawer.getByRole('button', { name: 'Salva voce', exact: true }).click()
    await page.getByText('Persona modificata', { exact: true }).waitFor()
    await page.getByRole('button', { name: /Modifica lista$/ }).click()
    assert.equal(await page.getByLabel('Tipo campo 2', { exact: true }).isDisabled(), true)
    await page.getByLabel('Nome lista', { exact: true }).fill('Lista rinominata')
    await page.getByLabel('Nome campo 1', { exact: true }).fill('Nome completo')
    await page.getByRole('button', { name: 'Salva lista', exact: true }).click()
    await page.getByText('Persona modificata', { exact: true }).waitFor()
    await page.getByLabel('Cerca nelle voci', { exact: true }).fill('inesistente')
    await page.getByText('Nessuna voce trovata', { exact: true }).waitFor()
    await page.getByLabel('Cerca nelle voci', { exact: true }).fill('persona')
    await page.getByText('Persona modificata', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.screenshot({ path: join(tmpdir(), `gestionale-liste-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: /Elimina voce$/ }).click()
    await page.getByRole('tooltip').getByRole('button', { name: /Elimina voce$/ }).click()
    await page.getByText('Nessuna voce. Aggiungi la prima voce compilando i campi della lista.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Elimina lista Lista rinominata', exact: true }).click()
    await page.getByRole('tooltip').getByRole('button', { name: 'Elimina lista', exact: true }).click()
    await page.getByRole('button', { name: /Nuova lista$/ }).waitFor()
    assert.deepEqual(errors, [])
    console.log(`Liste e impostazioni verificate a ${width}px: permessi, stagioni, CRUD, campi, persistenza, ricerca e layout`)
    await context.close()
  }
} finally { await browser?.close(); await server.close() }
