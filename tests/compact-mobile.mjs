import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures, mockDrive } from './fixtures.mjs'
import { mkdirSync } from 'node:fs'
const server = await createServer({ server: { host: '127.0.0.1', port: 5186, strictPort: true } })
await server.listen()
let browser
try {
 browser = await chromium.launch({ headless: true })
 mkdirSync('/tmp/us-compatta', { recursive: true })
 for (const theme of ['chiaro', 'scuro']) for (const width of [320, 390, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' })
  const data = fixtures(), seed = data.giocatori[1], errors = []
  data.giocatori = Array.from({ length: 36 }, (_, i) => ({ ...seed, id: `compact-${i}`, nome: i === 0 ? 'Nome composto particolarmente lungo' : 'Davide', cognome: i === 0 ? 'Cognome composto molto lungo' : `Cognome di prova ${i}`, numeroMaglia: i + 1, ruoloPreferito: 'CC', ruoliAdattati: ['COC', 'CDC', 'AD', 'AS', 'ATT', 'SP'], certificatoMedico: false, tessera: i < 2 ? '' : `270${i}`, quotaImporto: undefined, quotaPagata: false, infortunato: false }))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript((t) => localStorage.setItem('usriolunato:tema', t), theme)
  await mockDrive(page, data)
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${theme} ${width}: pagina larga`)
  await page.goto('http://127.0.0.1:5186/#/')
  const summary = page.locator('.dafare-riga').filter({ hasText: 'Certificati medici da regolarizzare' })
  await summary.waitFor()
  assert.equal(await summary.locator('.dafare-dettaglio').evaluate((e) => e.clientHeight <= parseFloat(getComputedStyle(e).lineHeight) * 2 + 1), true)
  await noOverflow()
  if (width < 576) await summary.screenshot({ path: `/tmp/us-compatta/panoramica-${theme}-${width}.png` })
  await page.goto('http://127.0.0.1:5186/#/formazione')
  const warning = page.locator('.elenco-compatto').filter({ hasText: 'Certificati da regolarizzare' })
  await warning.waitFor()
  assert.equal(await warning.getAttribute('open'), null)
  assert.ok((await warning.boundingBox()).height < 100)
  await warning.locator('summary').click()
  assert.equal(await warning.locator('li').count(), 34)
  assert.ok(await warning.locator('ul').evaluate((e) => e.clientHeight <= 241 && e.scrollHeight > e.clientHeight))
  await warning.locator('summary').click()
  await noOverflow()
  if (width < 576) await page.locator('.formazione-avvisi').screenshot({ path: `/tmp/us-compatta/formazione-${theme}-${width}.png` })
  await page.goto('http://127.0.0.1:5186/#/rosa')
  if (width < 576) {
   const card = page.locator('.rosa-card').first(); await card.waitFor()
   assert.ok((await card.boundingBox()).height < 300)
   const details = card.locator('details')
   assert.equal(await details.getAttribute('open'), null)
   assert.equal(await card.getByRole('button', { name: /Elimina/ }).isVisible(), false)
   await details.locator('summary').click()
   await card.getByText('Ruoli adattati', { exact: true }).waitFor()
   assert.equal(await card.getByRole('button', { name: /Elimina/ }).isVisible(), true)
   await details.locator('summary').click()
   await card.evaluate((e) => e.scrollIntoView({ block: 'center' }))
   await card.locator('.rosa-card-quota .ant-select-selector').click()
   await page.getByRole('option', { name: 'Esente', exact: true }).click()
   assert.ok(page.url().endsWith('/rosa'))
   if (width < 576) await page.locator('.lista-mobile').screenshot({ path: `/tmp/us-compatta/rosa-${theme}-${width}.png` })
   await card.getByRole('link').click()
   assert.ok(page.url().endsWith('/rosa/compact-0'))
  }
  await noOverflow()
  await page.goto('http://127.0.0.1:5186/#/social')
  const kinds = page.locator('.social-kind'); await kinds.waitFor()
  const initial = await kinds.boundingBox()
  for (const name of ['Risultato', 'Formazione', 'Mese', 'Partita del giorno', 'Formazione', 'Risultato']) {
   await kinds.getByText(name, { exact: true }).click()
   assert.equal(await kinds.getByRole('radio', { name, exact: true }).isChecked(), true)
   assert.equal(await kinds.locator('.ant-segmented-thumb').count(), 0)
   const current = await kinds.boundingBox()
   assert.ok(Math.abs(current.width - initial.width) <= 1 && Math.abs(current.height - initial.height) <= 1)
   await page.locator('.ed-stage-wrap canvas').first().waitFor()
   await noOverflow()
  }
  if (width < 576) await kinds.screenshot({ path: `/tmp/us-compatta/social-${theme}-${width}.png` })
  assert.deepEqual(errors, [])
  await page.close()
 }
 console.log('Sintesi, avvisi apribili, card Rosa, quota e cambio grafiche verificati con 36 giocatori nei due temi a 320/390/768/1440px')
} finally { await browser?.close(); await server.close() }
