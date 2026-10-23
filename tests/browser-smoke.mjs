import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
const server = spawn(
  'node',
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
  { cwd: new URL('..', import.meta.url).pathname },
)
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { server.kill(); reject(new Error('Vite startup timed out')) }, 15_000)
  server.once('error', reject)
  server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Vite exited: ${code}`)) })
  server.stdout.on('data', (data) => {
    if (data.toString().includes('Local:')) { clearTimeout(timeout); resolve() }
  })
})
process.on('exit', () => server.kill())
let browser
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  const spaced = (t) =>
    t
      .split(/(\s+)/)
      .map((p) => (/\s/.test(p) ? p : [...p].join('\u2060')))
      .join('')
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error('Browser error:', e.message)
  })
  let movimenti = [
    {
      id: '1',
      data: '2026-10-01',
      descrizione: 'Incasso bar partita Riolunato',
      tipo: 'entrata',
      importo: 245.5,
      saldato: true,
      categoria: 'Bar',
    },
    {
      id: '2',
      data: '2026-10-23',
      descrizione: 'Acquisto bevande e materiali per il campo',
      tipo: 'uscita',
      importo: 42.25,
      saldato: true,
      categoria: 'Bar',
      controparte: 'Fornitore',
    },
    {
      id: '3',
      data: '2026-10-23',
      descrizione: 'Contributo sponsor da incassare',
      tipo: 'entrata',
      importo: 500,
      saldato: false,
      categoria: 'Sponsor',
    },
  ]
  let reads = 0,
    uploads = 0,
    rejectWrite = false
  const docs = []
  await page.addInitScript(() => {
    localStorage.setItem('usriolunato:__secret', 'test-only')
  })
  await page.route('https://script.google.com/**', async (route) => {
    const b = route.request().postDataJSON()
    let data = { ok: true }
    if (b.action === 'seasons')
      Object.assign(data, { stagioni: ['2026/27'], attiva: '2026/27' })
    else if (b.action === 'listAll') {
      reads++
      data.liste = b.richieste.map((r) => ({
        collection: r.collection,
        items:
          r.collection === 'conti'
            ? movimenti
            : r.collection === 'documenti'
              ? docs
              : [],
      }))
    } else if (b.action === 'archivioList')
      Object.assign(data, { documenti: [], foto: [] })
    else if (b.action === 'put' && b.collection === 'conti') {
      if (rejectWrite)
        return route.fulfill({
          json: { ok: false, error: 'Errore scrittura test' },
        })
      const i = movimenti.findIndex((m) => m.id === b.record.id)
      if (i < 0) movimenti.push(b.record)
      else movimenti[i] = b.record
    } else if (b.action === 'upload') {
      uploads++
      data.item = {
        id: 'doc-' + uploads,
        nome: b.nome,
        tipo: b.tipo,
        dimensione: 100,
        caricatoIl: '2026-10-23',
        dataUrl: `data:${b.tipo};base64,${b.dataBase64}`,
      }
      docs.push(data.item)
    }
    await route.fulfill({ json: data })
  })
  await page.goto('http://127.0.0.1:5174/#/conti')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: /Nuovo movimento/ }).waitFor()
  await page.getByText('3 di 3 movimenti').waitFor()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '/tmp/us-desktop.png', fullPage: true })
  // Manual refresh pulls externally changed rows.
  movimenti = [
    ...movimenti,
    {
      id: '4',
      data: '2026-10-23',
      descrizione: 'Aggiornamento da altro dispositivo',
      tipo: 'uscita',
      importo: 10,
      saldato: false,
    },
  ]
  await page.getByRole('button', { name: /Aggiorna/ }).click()
  await page.getByText('4 di 4 movimenti').waitFor()
  // Receipt upload and persistence in the movement.
  await page.getByRole('button', { name: /Nuovo movimento/ }).click()
  await page
    .getByPlaceholder(spaced('es. Sponsor, Pagamento campo…'))
    .fill('Scontrino di prova')
  await page.getByLabel(spaced('Importo (€)'), { exact: true }).fill('12,30')
  await page
    .locator('input[type=file][multiple]')
    .setInputFiles({
      name: 'ricevuta.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFCkAAAAASUVORK5CYII=',
        'base64',
      ),
    })
  await page.getByRole('button', { name: /Registra/ }).click()
  await page.getByText('5 di 5 movimenti').waitFor()
  if (
    !movimenti.find((m) => m.descrizione === 'Scontrino di prova')?.allegati
      ?.length
  )
    throw Error('Receipt not persisted')
  // Preview and download printable PDF.
  await page.getByRole('button', { name: /Esporta PDF/ }).click()
  await page.getByRole('button', { name: /Genera PDF/ }).click()
  await page.getByRole('link', { name: /Scarica PDF/ }).waitFor()
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /Scarica PDF/ }).click()
  await (await download).saveAs('/tmp/us-report.pdf')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '/tmp/us-pdf-preview.png', fullPage: true })
  await page.getByRole('button', { name: /Close/ }).click()
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `/tmp/us-${width}.png`, fullPage: true })
    const dims = await page.evaluate(() => ({
      w: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    if (dims.scroll > dims.w + 1)
      throw Error('Page overflow ' + JSON.stringify(dims))
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Nuovo movimento/ }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page
    .locator('.ant-modal')
    .filter({ visible: true })
    .waitFor({ state: 'visible' })
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/us-mobile-form.png', fullPage: true })
  await page.getByRole('button', { name: /Annulla/ }).click()
  await page.getByRole('button', { name: /Passa al tema scuro/ }).click()
  await page.waitForTimeout(350)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '/tmp/us-mobile-dark.png', fullPage: true })
  await page.getByRole('button', { name: /Esporta PDF/ }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/us-mobile-pdf.png', fullPage: true })
  await page.getByRole('button', { name: /Annulla/ }).click()
  // A failed write survives remote refresh, then can be retried safely.
  rejectWrite = true
  await page.getByRole('button', { name: /Nuovo movimento/ }).click()
  await page
    .getByPlaceholder(spaced('es. Sponsor, Pagamento campo…'))
    .fill('Salvataggio da riprovare')
  await page.getByLabel(spaced('Importo (€)'), { exact: true }).fill('8')
  await page.getByRole('button', { name: /Registra/ }).click()
  await page.getByRole('button', { name: /Riprova salvataggio/ }).waitFor()
  await page.getByRole('button', { name: /Aggiorna/ }).click()
  await page.getByText('6 di 6 movimenti').waitFor()
  rejectWrite = false
  await page.getByRole('button', { name: /Riprova salvataggio/ }).click()
  await page
    .getByRole('button', { name: /Riprova salvataggio/ })
    .waitFor({ state: 'hidden' })
  if (!movimenti.find((m) => m.descrizione === 'Salvataggio da riprovare'))
    throw Error('Retry did not save')
  // Focus and periodic updates are deterministic with a virtual browser clock.
  await page.clock.install()
  await page.clock.fastForward(6000)
  movimenti.push({
    id: 'focus',
    data: '2026-10-23',
    descrizione: 'Aggiornato al rientro',
    tipo: 'entrata',
    importo: 1,
    saldato: true,
  })
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByText('7 di 7 movimenti').waitFor()
  movimenti.push({
    id: 'poll',
    data: '2026-10-23',
    descrizione: 'Aggiornato automaticamente',
    tipo: 'entrata',
    importo: 1,
    saldato: true,
  })
  await page.clock.fastForward(61000)
  await page.getByText('8 di 8 movimenti').waitFor()
  // Generate a long report, including a row taller than a page.
  const longPdf = await page.evaluate(async () => {
    const { creaReportPdf } = await import('/src/pages/conti/reportPdf.ts')
    const rows = Array.from({ length: 160 }, (_, i) => ({
      id: String(i),
      data: '2026-10-23',
      descrizione:
        i === 80 ? 'Descrizione molto lunga '.repeat(1400) : 'Ricevuta ' + i,
      tipo: i % 2 ? 'entrata' : 'uscita',
      importo: 10.25,
      saldato: i % 3 !== 0,
    }))
    const doc = creaReportPdf(rows, {})
    return {
      base64: doc.output('datauristring').split(',')[1],
      pages: doc.getNumberOfPages(),
    }
  })
  await fs.writeFile(
    '/tmp/us-report-long.pdf',
    Buffer.from(longPdf.base64, 'base64'),
  )
  if (longPdf.pages < 4) throw Error('Long PDF did not paginate')
  // Shared layout smoke check across the other operational sections.
  await page.clock.resume()
  for (const route of ['/rosa', '/magazzino', '/partite', '/spese', '/documenti', '/calendario']) {
    await page.goto(`http://127.0.0.1:5174/#${route}`)
    await page.locator('.app-container .page-title').waitFor()
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `/tmp/us-${route.slice(1)}-${width}.png`, fullPage: true })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      if (overflow) throw Error(`Overflow in ${route} at ${width}px`)
    }
  }
  console.log(
    JSON.stringify({
      reads,
      uploads,
      errors,
      rows: movimenti.length,
      pages: longPdf.pages,
    }),
  )
  if (errors.length) throw Error(errors.join('\n'))
} finally {
  await browser?.close()
  server.kill()
}
