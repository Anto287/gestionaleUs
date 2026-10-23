import test from 'node:test'
import assert from 'node:assert/strict'
import { riusaLista } from '../src/lib/riusaLista.ts'

test('un refresh identico conserva il riferimento, anche per gli allegati annidati', () => {
  const prima = [
    {
      id: '1',
      importo: 12.5,
      allegati: [{ id: 'foto', nome: 'scontrino.jpg' }],
    },
  ]
  assert.equal(riusaLista(prima, JSON.parse(JSON.stringify(prima))), prima)
  assert.equal(riusaLista(prima, prima), prima)
})
test('aggiunte, modifiche, rimozioni e riordinamenti arrivati online sono applicati', () => {
  const prima = [
    { id: '1', importo: 12.5 },
    { id: '2', importo: 10 },
  ]
  for (const nuovi of [
    [...prima, { id: '3', importo: 3 }],
    [{ id: '1', importo: 20 }],
    [],
    [...prima].reverse(),
  ]) {
    assert.equal(riusaLista(prima, nuovi), nuovi)
  }
})
test('prima apertura e liste vuote', () => {
  const nuovi: unknown[] = []
  assert.equal(riusaLista(undefined, nuovi), nuovi)
  const prima: unknown[] = []
  assert.equal(riusaLista(prima, nuovi), prima)
})
