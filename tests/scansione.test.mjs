import assert from 'node:assert/strict'
import test from 'node:test'
import { leggiCartaIdentita, leggiPatente, leggiMrz, trovaDate, unisciLetture } from '../src/lib/scansione.ts'

test('CIE: etichette bilingue, valori su righe diverse e nomi composti', () => {
  const dati = leggiCartaIdentita(`COGNOME / SURNAME
D'AMICO
NOME / GIVEN NAMES
MARIA LUISA
LUOGO E DATA DI NASCITA / PLACE AND DATE OF BIRTH
MODENA 12.05.1999
SCADENZA / EXPIRY
12.05.2032
CA12345AB`)
  assert.equal(dati.cognome, "D'Amico")
  assert.equal(dati.nome, 'Maria Luisa')
  assert.equal(dati.nascita, '1999-05-12')
  assert.equal(dati.scadenzaDocumento, '2032-05-12')
  assert.equal(dati.documento, 'CA12345AB')
})

test('CIE: non assegna il nome al cognome quando il cognome è illeggibile', () => {
  const dati = leggiCartaIdentita('COGNOME / SURNAME\nNOME / NAME\nMARIO')
  assert.equal(dati.cognome, undefined)
  assert.equal(dati.nome, 'Mario')
})

test('patente: campi senza punto e valori su righe successive', () => {
  const dati = leggiPatente(`1
ROSSI
2 MARIO
3
12.05.99 MODENA
4a. 01.01.24 4b. 12.05.32
5
MO1234567X`)
  assert.equal(dati.cognome, 'Rossi')
  assert.equal(dati.nome, 'Mario')
  assert.equal(dati.nascita, '1999-05-12')
  assert.equal(dati.scadenzaDocumento, '2032-05-12')
  assert.equal(dati.documento, 'MO1234567X')
})

test('patente: campi numerati sulla stessa riga rimangono separati', () => {
  const dati = leggiPatente('1. ROSSI 2. MARIO\n3. 12/05/1999 MODENA\n4b. 12/05/2032\n5. MO1234567X 9. B')
  assert.equal(dati.cognome, 'Rossi')
  assert.equal(dati.nome, 'Mario')
  assert.equal(dati.documento, 'MO1234567X')
})

function controllo(campo) {
  return [...campo].reduce((n, c, i) => n + (c === '<' ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55) * [7, 3, 1][i % 3], 0) % 10
}
const doc = 'CA12345AB', nascita = '990512', scadenza = '320512'
const r1 = `C<ITA${doc}${controllo(doc)}`.padEnd(30, '<')
const r2 = `${nascita}${controllo(nascita)}M${scadenza}${controllo(scadenza)}ITA`.padEnd(29, '<') + '0'
const r3 = 'ROSSI<<MARIO'.padEnd(30, '<')

test('MRZ completa: numero documento, date e nome dai dati di controllo', () => {
  const dati = leggiCartaIdentita([r1, r2, r3].join('\n'))
  assert.equal(dati.mrzValido, true)
  assert.equal(dati.documento, doc)
  assert.equal(dati.nascita, '1999-05-12')
  assert.equal(dati.scadenzaDocumento, '2032-05-12')
  assert.equal(dati.nome, 'Mario')
  assert.equal(dati.cognome, 'Rossi')
})

test('MRZ parziale: le sole date non certificano il numero documento', () => {
  assert.equal(leggiMrz([r2, r3].join('\n')).valido, false)
})

test('fronte e retro: il codice verificato corregge la prima lettura', () => {
  const dati = unisciLetture([
    leggiCartaIdentita('COGNOME ROSSI\nNOME MARLO\nCA12345AC'),
    leggiCartaIdentita([r1, r2, r3].join('\n')),
  ])
  assert.equal(dati.nome, 'Mario')
  assert.equal(dati.documento, doc)
})

test('date OCR: corregge lettere nelle cifre e scarta date impossibili', () => {
  assert.equal(trovaDate('12.O5.1999')[0].iso, '1999-05-12')
  assert.deepEqual(trovaDate('31.02.2030'), [])
})


test('CIE: etichette nome e cognome riunite sulla stessa riga', () => {
  const dati = leggiCartaIdentita('COGNOME ROSSI NOME MARIO')
  assert.equal(dati.cognome, 'Rossi')
  assert.equal(dati.nome, 'Mario')
})

test('CIE: etichette inglesi senza traduzione italiana', () => {
  const dati = leggiCartaIdentita('SURNAME\nROSSI\nGIVEN NAMES\nMARIO')
  assert.equal(dati.nome, 'Mario')
  assert.equal(dati.cognome, 'Rossi')
})

test('patente: date non riempite con zeri su righe separate', () => {
  const dati = leggiPatente('1. ROSSI\n2. MARIO\n3.\n1.5.1999\n4b.\n1.5.2032')
  assert.equal(dati.nascita, '1999-05-01')
  assert.equal(dati.scadenzaDocumento, '2032-05-01')
})
