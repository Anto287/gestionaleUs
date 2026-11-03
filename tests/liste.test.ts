import test from 'node:test'
import assert from 'node:assert/strict'
import { erroreSchema, filtraRighe, valoreTesto } from '../src/pages/liste/model.ts'
import type { CampoLista, RigaLista } from '../src/pages/liste/model.ts'
const campo: CampoLista = { id: 'pagato', nome: 'Pagato', tipo: 'booleano', obbligatorio: true, opzioni: [] }
test('liste: valori falsi e zero restano distinguibili da valori non compilati', () => {
  assert.equal(valoreTesto(campo, false), 'No')
  assert.equal(valoreTesto(campo, true), 'Sì')
  assert.equal(valoreTesto(campo, null), '')
  assert.equal(valoreTesto({ ...campo, tipo: 'numero' }, 0), '0')
  const righe: RigaLista[] = [false, true, null].map((value, i) => ({ id: String(i), listaId: 'l1', valori: { pagato: value } }))
  assert.deepEqual(filtraRighe(righe, [campo], 'no').map((r) => r.id), ['0'])
})
test('liste: nomi vuoti, duplicati e scelte vuote non sono salvabili', () => {
  const schema = { nome: 'Attività', descrizione: '', campi: [campo] }
  assert.equal(erroreSchema(schema), undefined)
  assert.ok(erroreSchema({ ...schema, nome: ' ' }))
  assert.ok(erroreSchema({ ...schema, campi: [] }))
  assert.ok(erroreSchema({ ...schema, campi: [campo, { ...campo, id: 'altro', nome: ' PAGATO ' }] }))
  assert.ok(erroreSchema({ ...schema, campi: [{ ...campo, tipo: 'scelta' }] }))
})
