import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'

const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } })
await server.listen()
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    headless: true,
  })
  const data = fixtures()
  data.giocatori = [
    { id: 'oggi', nome: 'Mario', cognome: 'Rossi', categoria: 'dirigente', nascita: '27/11/1990' },
    { id: 'ieri', nome: 'Luca', cognome: 'Verdi', nascita: '1992-11-26' },
    { id: 'ospite', nome: 'Anna', cognome: 'Neri', nascita: '27/11/1991', soloAllenamento: true },
  ]
  const conferme = new Map()
  let rifiutaScrittura = true
  const url = 'http://127.0.0.1:5174/#/conti'

  async function dispositivo() {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    await page.clock.setFixedTime(new Date('2026-11-26T23:30:00Z'))
    await page.addInitScript(() => localStorage.setItem('usriolunato:__secret', 'test-only'))
    await page.route('https://script.google.com/**', async (route) => {
      const richiesta = route.request().postDataJSON()
      const risposta = { ok: true }
      if (richiesta.action === 'seasons') {
        Object.assign(risposta, { stagioni: ['2026/27'], attiva: '2026/27' })
      }
      if (richiesta.action === 'listAll') {
        risposta.liste = richiesta.richieste.map(({ collection, season }) => {
          if (collection !== 'confermeCompleanni') return { collection, items: data[collection] ?? [] }
          assert.equal(season, 'globale')
          return { collection, items: [...conferme.values()] }
        })
      }
      if (richiesta.action === 'list') risposta.items = data[richiesta.collection] ?? []
      if (richiesta.action === 'put') {
        assert.equal(richiesta.collection, 'confermeCompleanni')
        assert.equal(richiesta.season, 'globale')
        if (rifiutaScrittura) Object.assign(risposta, { ok: false, error: 'errore di prova' })
        else conferme.set(richiesta.record.id, richiesta.record)
      }
      await route.fulfill({ json: risposta })
    })
    await page.goto(url)
    return page
  }

  const primo = await dispositivo()
  const dialogo = (page) => page.getByRole('dialog', { name: 'Promemoria compleanni' })
  const conferma = (page) => dialogo(page).getByRole('button', { name: 'Conferma di aver visto' })
  await dialogo(primo).getByText('Mario Rossi · Oggi').waitFor()
  await dialogo(primo).getByText('Luca Verdi · 26 novembre 2026').waitFor()
  assert.equal(await dialogo(primo).getByText('Anna Neri', { exact: false }).count(), 0)
  await dialogo(primo).getByRole('button', { name: 'Ricordamelo al prossimo accesso' }).click()
  await dialogo(primo).waitFor({ state: 'hidden' })
  assert.equal(conferme.size, 0)
  await primo.reload()
  await dialogo(primo).waitFor()
  await conferma(primo).click()
  await dialogo(primo).getByRole('alert').waitFor()
  assert.equal(conferme.size, 0)

  rifiutaScrittura = false
  await conferma(primo).click()
  await dialogo(primo).waitFor({ state: 'hidden' })
  assert.deepEqual([...conferme.keys()], ['2026-11-27:oggi', '2026-11-26:ieri'])
  const secondo = await dispositivo()
  await secondo.getByText('12 di 12 movimenti').waitFor()
  assert.equal(await dialogo(secondo).count(), 0)
  console.log('Compleanni verificati su due dispositivi, incluso il rinvio e il recupero dopo un errore Drive')
} finally {
  await browser?.close()
  await server.close()
}
