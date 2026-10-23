import test from 'node:test'
import assert from 'node:assert/strict'
import { filtraMovimento, totaliReport } from '../src/lib/contiReport.ts'
import type { Movimento } from '../src/types.ts'
const items: Movimento[] = [
  {
    id: '1',
    data: '2026-10-01',
    descrizione: 'Incasso Bar',
    tipo: 'entrata',
    importo: 100.1,
    saldato: true,
    categoria: 'Bar',
  },
  {
    id: '2',
    data: '2026-10-23',
    descrizione: 'Acquisto bevande',
    controparte: 'Fornitore',
    tipo: 'uscita',
    importo: 20.1,
    saldato: true,
    categoria: 'Bar',
    allegati: [
      {
        id: 'doc',
        nome: 'scontrino.jpg',
        tipo: 'image/jpeg',
        dimensione: 100,
        caricatoIl: '2026-10-23',
      },
    ],
  },
  {
    id: '3',
    data: '2026-11-01',
    descrizione: 'Sponsor',
    tipo: 'entrata',
    importo: 500,
    saldato: false,
  },
  {
    id: '4',
    data: '2026-10-23',
    descrizione: 'Arbitro',
    tipo: 'uscita',
    importo: 40,
    saldato: false,
  },
]
test('periodo inclusivo e intersezione di categoria e stato', () => {
  assert.deepEqual(
    items
      .filter((m) =>
        filtraMovimento(m, {
          da: '2026-10-01',
          a: '2026-10-23',
          categoria: 'Bar',
          stato: 'saldato',
        }),
      )
      .map((m) => m.id),
    ['1', '2'],
  )
})
test('ricerca, soglie inclusive, controparte e ricevute', () => {
  assert.equal(
    filtraMovimento(items[1], {
      q: ' FORNITORE ',
      controparte: 'Fornitore',
      allegati: true,
      importo: 20.1,
      importoOp: 'minore',
    }),
    true,
  )
  assert.equal(filtraMovimento(items[0], { allegati: true }), false)
  assert.equal(filtraMovimento(items[1], { importo: 21 }), false)
})
test('anno, mese, entrate aperte e senza categoria', () => {
  assert.deepEqual(
    items
      .filter((m) =>
        filtraMovimento(m, {
          anno: '2026',
          mese: '2026-11',
          tipo: 'entrata',
          stato: 'aperto',
          categoria: 'Senza categoria',
        }),
      )
      .map((m) => m.id),
    ['3'],
  )
  assert.equal(filtraMovimento(items[0], { anno: '2025' }), false)
})
test('netto della selezione separato dai movimenti da saldare e arrotondato', () => {
  assert.deepEqual(totaliReport(items), {
    entrate: 100.1,
    uscite: 20.1,
    netto: 80,
    daIncassare: 500,
    daPagare: 40,
  })
  assert.deepEqual(totaliReport([]), {
    entrate: 0,
    uscite: 0,
    netto: 0,
    daIncassare: 0,
    daPagare: 0,
  })
})
