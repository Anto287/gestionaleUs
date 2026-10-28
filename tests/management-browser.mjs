import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'

const server = await createServer({ server: { host: '127.0.0.1', port: 5177, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true })
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' })
    const page = await context.newPage(), data = fixtures(), errors = [], calls = []
    let device, nome = '', token = '', requestIds = []
    page.setDefaultTimeout(10000)
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('usriolunato:__secret', 'test-only'))
    await page.route('https://script.google.com/**', async (route) => {
      const b = route.request().postDataJSON(), res = { ok: true }
      calls.push(b.action)
      if (b.device) device = b.device
      if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
      else if (b.action === 'listAll') res.liste = b.richieste.map((r) => ({ collection: r.collection, items: data[r.collection] || [] }))
      else if (b.action === 'list') res.items = data[b.collection] || []
      else if (b.action === 'managementLogin') {
        if (b.password !== 'test-admin') Object.assign(res, { ok: false, error: 'Password amministratore errata.' })
        else { token = 'test-session'; Object.assign(res, { token, expiresIn: 1800 }) }
      } else if (b.action.startsWith('management')) {
        if (!token || b.adminToken !== token) Object.assign(res, { ok: false, code: 'ADMIN_AUTH', error: 'Sessione scaduta' })
        else if (b.action === 'managementLogout') token = ''
        else if (b.action === 'managementDevices') res.devices = [{ ...device, nome, primoAccesso: '2026-10-28T10:00:00Z', ultimoAccesso: '2026-10-28T12:00:00Z' }]
        else if (b.action === 'managementRenameDevice') { nome = b.nome; res.device = { ...device, nome, primoAccesso: '2026-10-28T10:00:00Z', ultimoAccesso: '2026-10-28T12:00:00Z' } }
        else if (b.action === 'managementActivities') { res.total = 1; res.activities = [{ id: 'activity-test', deviceId: device.id, data: '2026-10-28T12:00:00Z', azione: 'Modifica', sezione: 'conti', stagione: 'globale', elemento: 'Movimento di prova', esito: 'riuscita', dettagli: [{ campo: 'importo', prima: '100', dopo: '120' }] }] }
      } else if (b.action === 'put') {
        requestIds.push(b.requestId)
        // Primo tentativo fallito, il secondo simula il replay della risposta.
        if (requestIds.length === 1) Object.assign(res, { ok: false, error: 'risposta persa di prova' })
      }
      await route.fulfill({ json: res })
    })
    await page.goto('http://127.0.0.1:5177/#/management')
    await page.locator('.app-container').waitFor()
    await page.waitForURL('**/#/')
    assert.equal(await page.getByRole('menuitem', { name: 'Management', exact: true }).count(), 0)
    assert.equal(calls.includes('managementDevices'), false)
    const logo = page.locator(width > 1000 ? '.brand-logo' : '.topbar-logo')
    for (let i = 0; i < 4; i++) await logo.click()
    assert.equal(await page.getByRole('dialog', { name: 'Accesso Management' }).count(), 0)
    await logo.click()
    const dialog = page.getByRole('dialog', { name: 'Accesso Management' })
    await dialog.getByLabel('Password amministratore', { exact: true }).fill('errata')
    await dialog.getByRole('button', { name: 'Accedi', exact: true }).click()
    await page.getByText('Password amministratore errata.', { exact: true }).waitFor()
    await dialog.getByLabel('Password amministratore', { exact: true }).fill('test-admin')
    await dialog.getByRole('button', { name: 'Accedi', exact: true }).click()
    await page.getByRole('tab', { name: 'Dispositivi', exact: true }).waitFor()
    await page.getByText('Movimento di prova', { exact: true }).waitFor()
    await page.locator('.ant-table-row-expand-icon').first().click()
    await page.getByText('importo', { exact: true }).waitFor()
    await page.screenshot({ path: `/tmp/team-management-activities-${width}.png`, fullPage: true })
    await page.getByRole('tab', { name: 'Dispositivi', exact: true }).click()
    await page.getByRole('button', { name: 'Rinomina', exact: true }).click()
    await page.getByLabel('Nome dispositivo', { exact: true }).fill('PC Lavoro')
    await page.getByRole('button', { name: 'Salva', exact: true }).click()
    await page.getByRole('tabpanel', { name: 'Dispositivi', exact: true }).getByText('PC Lavoro', { exact: true }).waitFor()
    await page.screenshot({ path: `/tmp/team-management-devices-${width}.png`, fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'nessun overflow della pagina')
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('test-session')), false, 'token non conservato nel browser')
    await page.getByRole('button', { name: 'Chiudi Management' }).click()
    await page.waitForURL('**/#/')
    await page.waitForFunction(() => !document.querySelector('h3')?.textContent?.includes('Management'))
    assert.equal(calls.includes('managementLogout'), true)
    // Una scrittura ritentata conserva lo stesso requestId.
    await page.goto('http://127.0.0.1:5177/#/conti')
    await page.getByText('12 di 12 movimenti').waitFor()
    await page.getByRole('button', { name: /Nuovo movimento/ }).click()
    const spaced = (text) => text.split(/(\s+)/).map((part) => /\s/.test(part) ? part : [...part].join('\u2060')).join('')
    await page.getByPlaceholder(spaced('es. Sponsor, Pagamento campo…')).fill('Prova identificativo richiesta')
    await page.getByLabel(spaced('Importo (€)'), { exact: true }).fill('8')
    await page.getByRole('button', { name: /Registra/ }).click()
    await page.getByRole('button', { name: /Riprova salvataggio/ }).click()
    await page.getByRole('button', { name: /Riprova salvataggio/ }).waitFor({ state: 'hidden' })
    assert.equal(requestIds.length, 2)
    assert.ok(requestIds[0])
    assert.equal(requestIds[0], requestIds[1], 'stesso requestId al ritentativo')
    const firstId = await page.evaluate(() => localStorage.getItem('usriolunato:__device_id'))
    await page.reload()
    await page.getByText('12 di 12 movimenti').waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('usriolunato:__device_id')), firstId)
    assert.deepEqual(errors, [])
    console.log(`Management verificato a ${width}px: accesso diretto bloccato, cinque click, password errata, login, dettagli, rinomina, revoca e persistenza dispositivo`)
    await context.close()
  }
} finally { await browser?.close(); await server.close() }
