import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
})
await server.listen()
let browser
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const loaded = [],
    errors = []
  page.on('request', (r) => loaded.push(r.url()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('usriolunato:__secret', 'test-only')
  })
  let archiveReads = 0,
    reads = 0,
    block = false
  const releases = []
  const items = Array.from({ length: 300 }, (_, i) => ({
    id: String(i),
    data: '2026-10-23',
    descrizione: `Movimento ${i}`,
    tipo: 'entrata',
    importo: 1,
    saldato: true,
  }))
  await page.route('https://script.google.com/**', async (route) => {
    const body = route.request().postDataJSON(),
      response = { ok: true }
    if (body.action === 'seasons')
      Object.assign(response, { stagioni: ['2026/27'], attiva: '2026/27' })
    if (body.action === 'listAll') {
      reads++
      if (block) await new Promise((resolve) => releases.push(resolve))
      response.liste = body.richieste.map((r) => ({
        collection: r.collection,
        items: r.collection === 'conti' ? items : [],
      }))
    }
    if (body.action === 'archivioList') {
      archiveReads++
      Object.assign(response, { documenti: [], foto: [] })
    }
    await route.fulfill({ json: response })
  })
  await page.goto('http://127.0.0.1:5174/#/conti')
  await page.getByText('300 di 300 movimenti').waitFor()
  assert.equal(await page.locator('.lista-card').count(), 50)
  assert.equal(
    archiveReads,
    0,
    'I conti non devono richiedere foto e documenti dei tesserati',
  )
  assert.equal(
    loaded.some(
      (u) =>
        u.includes('/conti/BilancioMensile.tsx') ||
        u.includes('/conti/PerCategoria.tsx'),
    ),
    false,
  )
  assert.equal(
    loaded.some((u) => u.includes('/conti/EsportaConti.tsx')),
    false,
  )
  await page.getByRole('button', { name: /Mostra altri 50/ }).click()
  assert.equal(await page.locator('.lista-card').count(), 100)
  await page.locator('.lista-cerca input').fill('Movimento 299')
  await page.getByText('1 di 300 movimenti').waitFor()
  assert.equal(await page.locator('.lista-card').count(), 1)
  await page.getByRole('button', { name: /Mostra tutti/ }).click()
  await page.getByText('300 di 300 movimenti').waitFor()
  assert.equal(await page.locator('.lista-card').count(), 50)
  await page.getByText('Analisi del bilancio e categorie').click()
  await page.locator('.recharts-wrapper').first().waitFor()
  assert.equal(
    loaded.some((u) => u.includes('/conti/BilancioMensile.tsx')),
    true,
  )
  await page.getByRole('button', { name: /Esporta PDF/ }).click()
  await page.getByText('300 movimenti selezionati').waitFor()
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  // Una risposta lenta non deve bloccare i dati già presenti e i comandi.
  block = true
  await page.getByRole('button', { name: /Aggiorna/ }).click()
  await page.getByRole('button', { name: /Nuovo movimento/ }).click()
  await page.getByRole('dialog', { name: 'Nuovo movimento' }).waitFor()
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  for (const release of releases.splice(0)) release()
  await page.waitForFunction(
    () => !!localStorage.getItem('usriolunato:__dati/globale/conti'),
  )
  // Riapertura con cache: i 300 movimenti compaiono prima che il Drive risponda.
  await page.reload()
  await page.getByText('300 di 300 movimenti').waitFor()
  assert.equal(archiveReads, 0)
  block = false
  for (const release of releases.splice(0)) release()
  const archivioPronto = page.waitForResponse((r) =>
    r.request().postData()?.includes('archivioList'),
  )
  await page.goto('http://127.0.0.1:5174/#/rosa')
  await archivioPronto
  assert.ok(
    archiveReads > 0,
    'L’archivio si deve aggiornare quando si entra nella Rosa',
  )
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      movements: 300,
      initialMobileRows: 50,
      archiveReads,
      reads,
      errors,
    }),
  )
} finally {
  await browser?.close()
  await server.close()
}
