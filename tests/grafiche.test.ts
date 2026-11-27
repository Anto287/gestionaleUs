import './register-ts.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const { buildScene } = await import('../src/pages/social/editor/scene.ts')

test('Match Day mantiene il manifesto originale e riserva al campo una colonna libera', () => {
  const dove = 'Campo sportivo comunale di San Pietro in Casale · Via dei Caduti della Resistenza 128, ingresso dal parcheggio nord'
  for (const h of [1350, 1920]) {
    const scena = buildScene({
      kind: 'annuncio', formato: { w: 1080, h }, crestSrc: '', piede: '#RIOLUNATO',
      giorno: { avversario: 'Samone', dataTxt: '', dove },
    }, 'notte', '#e5a800')
    const testi = scena.elementi.filter((el) => el.tipo === 'testo')
    const match = testi.find((el) => el.testo === 'MATCH')
    const avversario = testi.find((el) => el.testo === 'SAMONE')
    const day = testi.find((el) => el.testo === 'DAY')
    const campo = testi.find((el) => el.testo === dove)
    const stagione = testi.find((el) => el.testo.startsWith('STAGIONE'))
    const sy = (y: number) => Math.round(y * h / 1350)
    assert.ok(match && day && campo && stagione && avversario)
    assert.deepEqual([match.x, match.y, day.x, day.y, campo.x, campo.y], [54, sy(560), 638, sy(612), 62, sy(738)])
    assert.equal(avversario.fontSize, 64)
    assert.equal(campo.letterSpacing, 3)
    assert.ok(campo.x + campo.width < day.x)
    assert.ok(campo.y + 4 * campo.fontSize < stagione.y)
  }
})
