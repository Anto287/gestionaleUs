import test from 'node:test'
import assert from 'node:assert/strict'
import { colonneModello, csvLista, validaValori } from '../src/lib/liste.ts'
import { normalizzaWidgetTuttocampo, validaCampionato } from '../src/lib/campionato.ts'
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

test('TuttoCampo: solo widget Classifica ufficiale, anche da codice iframe',()=>{
 const url='https://www.tuttocampo.it/WidgetV2/Classifica/2720a2d7-997c-43e2-b728-0ff49e1d97bf'
 assert.equal(normalizzaWidgetTuttocampo(`<iframe src="${url}"></iframe>`),url)
 assert.equal(validaCampionato({widgetUrl:url}).widgetUrl,url)
 for(const bad of ['https://evil.example/Widget/Classifica/a','javascript:alert(1)',url+'.evil','https://www.tuttocampo.it/EmiliaRomagna/Classifica']) assert.throws(()=>normalizzaWidgetTuttocampo(bad))
})
