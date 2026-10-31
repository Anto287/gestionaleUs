import './register-ts.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
const { buildScene } = await import('../src/pages/social/editor/scene.ts')
test('rinvio: post e storia mostrano soltanto squadre, rinvio e due stemmi entro i bordi',()=>{
 for (const h of [1350,1920]) {
  const scena=buildScene({kind:'rinvio',formato:{w:1080,h},crestSrc:'nostro.png',crestAvversarioSrc:'avversario.png',crestAvversarioRapporto:1.5,piede:'#FORZARIOLUNATO',giorno:{avversario:'San Damaso',dataTxt:'31 OTTOBRE',dove:'IN CASA',nota:'Campo impraticabile',recupero:'10 NOVEMBRE'}},'notte','#c22026')
  const testi=scena.elementi.filter(e=>e.tipo==='testo').map(e=>e.testo)
  assert.ok(testi.includes('RINVIATA'));assert.ok(!testi.includes('Campo impraticabile'));assert.ok(!testi.some(t=>t.includes('RECUPERO') || t.includes('31 OTTOBRE') || t.includes('DATA DA DEFINIRE')))
  assert.equal(scena.elementi.filter(e=>e.tipo==='immagine').length,2)
  for(const e of scena.elementi){ assert.ok(e.x >= 0 && e.y >= 0 && e.y < h);if(e.tipo==='testo')assert.ok(e.x+e.width<=1080) }
 }
})
