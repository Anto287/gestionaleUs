import test from 'node:test'
import assert from 'node:assert/strict'
import { chiaveSquadra, logoSquadra } from '../src/lib/loghi.ts'
const loghi = [{ id: '1', nome: 'U.S. Riolunato', alias: ['Riolunàto Calcio'], dataUrl: 'data:image/png;base64,AA==', rapporto: 1 }]
test('loghi: accenti, punteggiatura, alias e assenza di abbinamenti parziali', () => {
  assert.equal(chiaveSquadra(' U.S. Riolunàto '), 'usriolunato')
  assert.equal(logoSquadra(loghi, 'us riolunato')?.id, '1')
  assert.equal(logoSquadra(loghi, 'RIOLUNATO CALCIO')?.id, '1')
  assert.equal(logoSquadra(loghi, 'Riolunato'), undefined)
  assert.equal(logoSquadra(loghi, ''), undefined)
})
