import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leggiUisp } from '../src/lib/uisp.ts'
const righe = JSON.parse(readFileSync(new URL('./fixtures/uisp-righe.json', import.meta.url), 'utf8'))
test('UISP: classifica e risultati reali, coppe escluse e gruppo verificato', () => {
  const coppa = righe.map((r: string) => r.replace('CAMPIONATO', 'COPPA DI LEGA'))
  const r = leggiUisp([{ righe: coppa }, { righe }], '3', 'B')
  assert.equal(r.righe.length, 10)
  assert.equal(r.righe[0].squadra, 'ATLETIC VIGNOLA')
  assert.equal(r.righe.find((r) => r.squadra === 'RIOLUNATO U.S')?.punti, 4)
  assert.equal(r.risultati.length, 4)
  assert.deepEqual(r.risultati[0], { id: "2026-10-22|SANPA|ALBERO D'ORO POL.", data: '2026-10-22', ora: '21:15', casa: 'SANPA', ospite: "ALBERO D'ORO POL.", golCasa: 1, golOspite: 2, giornata: '5 - ANDATA' })
  assert.throws(() => leggiUisp([{ righe }], '2', 'B'), /non contiene/)
  assert.throws(() => leggiUisp([{ righe }], '3', 'D'), /non contiene/)
  assert.throws(() => leggiUisp([{ righe: coppa }], '3', 'B'), /non contiene/)
})
test('UISP: formato cambiato e risultati ambigui non diventano dati inventati', () => {
  const errate = righe.map((r: string) => r.replace('15 5 5 0 0', '15 5 4 0 0'))
  assert.throws(() => leggiUisp([{ righe: errate }], '3', 'B'), /Formato classifica/)
  const partite = righe.map((r: string) => r.replace('SANPA ALBERO', 'NOME SCONOSCIUTO ALBERO'))
  const parziale = leggiUisp([{ righe: partite }], '3', 'B')
  assert.equal(parziale.righe.length, 10)
  assert.equal(parziale.risultati.length, 3)
  assert.match(parziale.avvisoRisultati!, /Alcuni risultati non sono leggibili/)
})

test('UISP: estrazione PDF.js reale con intestazione separata e segni meno distanziati', () => {
  const righe = JSON.parse(readFileSync(new URL('./fixtures/uisp-righe-pdfjs.json', import.meta.url), 'utf8'))
  const r = leggiUisp([{ righe }], '3', 'B')
  assert.equal(r.righe.length, 10)
  assert.equal(r.risultati.length, 4)
  assert.equal(r.avvisoRisultati, undefined)
})
