import test from 'node:test'
import assert from 'node:assert/strict'
import { generaProgramma } from '../src/lib/programma.ts'
test('programma: tempi esatti per ogni durata e obiettivo, parametri limitati', () => {
  for (const obiettivo of ['Possesso', 'Finalizzazione', 'Difesa']) {
    for (let minuti = 30; minuti <= 150; minuti++) {
      const text = generaProgramma(minuti, 15, obiettivo)
      assert.equal([...text.matchAll(/\d+\. (\d+) min/g)].reduce((sum, m) => sum + Number(m[1]), 0), minuti)
      assert.match(text, /15 giocatori/)
    }
  }
  assert.throws(() => generaProgramma(0, 1, 'Possesso'))
})
