import test from 'node:test'
import assert from 'node:assert/strict'
import { colonneModello, csvLista, validaValori } from '../src/lib/liste.ts'
import { validaCampionato } from '../src/lib/campionato.ts'
test('liste: modello tombola, zero euro e No sono valori validi, scelte errate rifiutate',()=>{
 const colonne=colonneModello('tombola')
 assert.equal(validaValori(colonne,{negozio:'Bar',volantino:false,valore:0,stato:'Confermato'}),undefined)
 assert.match(validaValori(colonne,{negozio:''})!,/Negozio/)
 assert.match(validaValori(colonne,{negozio:'Bar',stato:'Inesistente'})!,/Scelta/)
 assert.match(validaValori(colonne,{negozio:'Bar',valore:NaN})!,/Numero/)
})
test('CSV liste: mantiene accenti, citazioni, righe multiple e neutralizza formule',()=>{
 const csv=csvLista({id:'l',nome:'Lista',colonne:[{id:'a',nome:'Attività',tipo:'testo'}]},[{id:'r',listaId:'l',valori:{a:'=HYPERLINK("x")\nNota'},aggiornatoDa:'A',aggiornatoIl:''}])
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=HYPERLINK("));assert.ok(csv.includes('""x""'))
})
test('campionato: nessun dato incompleto pubblicato come classifica',()=>{
 assert.throws(()=>validaCampionato({classifica:[{squadra:'Riolunato'}],partite:[]}))
 assert.equal(validaCampionato({classifica:[{squadra:'Riolunato',punti:0,giocate:0}],partite:[]}).classifica[0].punti,0)
})
