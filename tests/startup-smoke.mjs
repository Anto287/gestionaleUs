import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const data = fixtures()
  let fail = false, partial = false, block = false
  const releases = []
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('usriolunato:__secret', 'test-only'))
  await page.route('https://script.google.com/**', async (route) => {
    const b = route.request().postDataJSON(), res = { ok: true }
    if (b.action === 'seasons') Object.assign(res, { stagioni: ['2026/27'], attiva: '2026/27' })
    if (b.action === 'listAll') {
      if (block) await new Promise((resolve) => releases.push(resolve))
      res.liste = b.richieste.map((r) => ({ collection: r.collection, ...(partial && r.collection === 'conti' ? {} : { items: data[r.collection] ?? [] }) }))
    }
    if (b.action === 'list') {
      if (fail) res.items = 'risposta non valida'
      else res.items = data[b.collection] ?? []
    }
    await route.fulfill({ json: res })
  })
  // Una sola tabella non letta impedisce l'accesso, anche se le altre 16 sono disponibili.
  partial = true; fail = true
  await page.goto('http://127.0.0.1:5174/#/conti')
  await page.getByText('Sincronizzazione non completata', { exact: true }).waitFor()
  assert.equal(await page.locator('.app-container').count(), 0)
  assert.equal(await page.locator('.app-sider').count(), 0)
  await page.screenshot({ path: '/tmp/us-startup-error.png' })
  fail = false
  await page.getByRole('button', { name: 'Riprova', exact: true }).click()
  await page.getByText('12 di 12 movimenti').waitFor()
  // La cache è completa ma non è un lasciapassare per l'avvio successivo.
  await page.waitForFunction(() => !!localStorage.getItem('usriolunato:__dati/globale/conti'))
  block = true; partial = false
  await page.reload()
  await page.getByText('Sincronizzazione iniziale', { exact: true }).waitFor()
  assert.equal(await page.locator('.app-container').count(), 0)
  assert.equal(await page.getByRole('button', { name: /Nuovo movimento/ }).count(), 0)
  await page.screenshot({ path: '/tmp/us-startup-loading.png' })
  block = false
  for (const release of releases.splice(0)) release()
  await page.getByText('12 di 12 movimenti').waitFor()
  // Dopo l'avvio le riletture non chiudono l'app o i moduli aperti.
  block = true
  await page.getByRole('button', { name: /Aggiorna/ }).click()
  await page.getByRole('button', { name: /Nuovo movimento/ }).click()
  await page.getByRole('dialog', { name: 'Nuovo movimento' }).waitFor()
  block = false
  for (const release of releases.splice(0)) release()
  assert.deepEqual(errors, [])
  console.log('Avvio verificato: cache bloccata, errore parziale bloccante, recupero e refresh in sottofondo corretti')
} finally { await browser?.close(); await server.close() }
