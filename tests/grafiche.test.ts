import './register-ts.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const { buildScene } = await import('../src/pages/social/editor/scene.ts')

test('Match Day lascia spazio al campo lungo nel post e nella storia', () => {
  const dove = 'Campo sportivo comunale di San Pietro in Casale · Via dei Caduti della Resistenza 128, ingresso dal parcheggio nord'
  for (const h of [1350, 1920]) {
    const scena = buildScene({
      kind: 'annuncio', formato: { w: 1080, h }, crestSrc: '', piede: '#RIOLUNATO',
      giorno: { avversario: 'Associazione Sportiva Dilettantistica San Pietro in Casale', dataTxt: '', dove },
    }, 'notte', '#e5a800')
    const testi = scena.elementi.filter((el) => el.tipo === 'testo')
    const day = testi.find((el) => el.testo === 'DAY')
    const campo = testi.find((el) => el.testo === dove)
    const stagione = testi.find((el) => el.testo.startsWith('STAGIONE'))
    assert.ok(day && campo && stagione)
    assert.ok(campo.y >= day.y + day.fontSize + 32)
    assert.ok(campo.y + 4 * campo.fontSize < stagione.y)
    assert.ok(campo.x + campo.width < 1080 - 98)
  }
})
