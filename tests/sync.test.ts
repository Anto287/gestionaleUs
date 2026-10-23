import test from 'node:test'
import assert from 'node:assert/strict'
import { SyncGuard } from '../src/lib/syncGuard.ts'

test('le modifiche online sono applicabili quando non ci sono modifiche locali', () => {
  const g = new SyncGuard()
  assert.equal(g.canApply('conti', g.snapshot()), true)
})
test('una lettura partita prima della modifica locale non la sovrascrive', () => {
  const g = new SyncGuard(),
    snapshot = g.snapshot()
  g.changed('conti')
  assert.equal(g.canApply('conti', snapshot), false)
  assert.equal(g.canApply('rosa', snapshot), true)
})
test('una scrittura in viaggio protegge anche dalle letture successive', async () => {
  const g = new SyncGuard()
  let completa!: () => void
  const scrittura = g.write(
    'conti',
    () =>
      new Promise<void>((res) => {
        completa = res
      }),
  )
  assert.equal(g.canApply('conti', g.snapshot()), false)
  completa()
  await scrittura
  assert.equal(g.canApply('conti', g.snapshot()), true)
})
test('una modifica fallita resta protetta anche dopo un’altra scrittura riuscita', async () => {
  const g = new SyncGuard()
  await assert.rejects(
    g.write('conti', async () => {
      throw new Error('offline')
    }),
  )
  await g.write('conti', async () => {})
  assert.equal(g.canApply('conti', g.snapshot()), false)
  assert.equal(g.canApply('rosa', g.snapshot()), true)
})
test('due scritture concorrenti devono terminare entrambe', async () => {
  const g = new SyncGuard()
  let completa!: () => void
  const prima = g.write(
    'conti',
    () =>
      new Promise<void>((res) => {
        completa = res
      }),
  )
  await g.write('conti', async () => {})
  assert.equal(g.canApply('conti', g.snapshot()), false)
  completa()
  await prima
  assert.equal(g.canApply('conti', g.snapshot()), true)
})
