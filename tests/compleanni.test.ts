import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compleanniDaVedere, giornoCompleanni } from '../src/lib/compleanni.ts'

test('i compleanni seguono la mezzanotte italiana', () => {
  assert.equal(giornoCompleanni(new Date('2026-11-25T23:00:00Z')), '2026-11-26')
  assert.equal(giornoCompleanni(new Date('2027-07-15T22:00:00Z')), '2027-07-16')
})

test('le ricorrenze restano in sospeso, si distinguono per persona e ritornano l’anno dopo', () => {
  const rosa = [
    { id: 'a', nome: 'Luca', cognome: 'Rossi', nascita: '26/11/1990' },
    { id: 'b', nome: 'Luca', cognome: 'Rossi', nascita: '1998-11-26' },
    { id: 'c', nome: 'Anna', cognome: 'Verdi', nascita: '25-11-1990' },
    { id: 'd', nome: 'Marco', cognome: 'Neri', nascita: '31/11/1990' },
    { id: 'e', nome: 'Sara', cognome: 'Bianchi' },
  ]
  assert.deepEqual(compleanniDaVedere(rosa, '2026-11-27', []).map(({ id }) => id), [
    '2026-11-26:a',
    '2026-11-26:b',
  ])
  assert.deepEqual(compleanniDaVedere(rosa, '2027-11-26', [{ id: '2026-11-26:a' }]).map(({ id }) => id), [
    '2027-11-26:a',
    '2027-11-26:b',
    '2027-11-25:c',
    '2026-11-26:b',
  ])
})
