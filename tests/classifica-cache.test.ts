import test from 'node:test'
import assert from 'node:assert/strict'
import { leggiClassificaCache, salvaClassificaCache, stessoComunicato, richiestaClassifica } from '../src/lib/classificaCache.ts'
const items = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => items.set(k, v), removeItem: (k: string) => items.delete(k) } })
const dati = { tipo: 'uisp', pdfUrl: 'https://example.org/1.pdf', comunicato: '2026-10-28', categoria: '3', girone: 'B', righe: [{ squadra: 'Riolunato', punti: 4 }] }
test('cache persistente per stagione, invalidazione per fonte e comunicato', () => {
  salvaClassificaCache('2026/27', dati)
  assert.deepEqual(leggiClassificaCache('2026-27'), dati)
  assert.equal(leggiClassificaCache('2027/28'), undefined)
  assert.equal(stessoComunicato(dati, { ...dati }), true)
  for (const change of [{ comunicato: '2026-11-04' }, { pdfUrl: 'https://example.org/2.pdf' }, { girone: 'A' }, { categoria: '2' }, { tipo: 'api' }]) assert.equal(stessoComunicato(dati, { ...dati, ...change }), false)
  salvaClassificaCache('2026/27', { tipo: 'nessuna' })
  assert.equal(leggiClassificaCache('2026/27'), undefined)
  items.set('usriolunato:classifica:v1:2026-27', '{broken')
  assert.equal(leggiClassificaCache('2026/27'), undefined)
})
test('richieste simultanee condivise, errore ritentabile', async () => {
  let calls = 0
  const load = async () => { calls++; return dati }
  await Promise.all([richiestaClassifica('same', load), richiestaClassifica('same', load)])
  assert.equal(calls, 1)
  await assert.rejects(richiestaClassifica('fail', async () => { throw Error('offline') }))
  assert.deepEqual(await richiestaClassifica('fail', load), dati)
})
