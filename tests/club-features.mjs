import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fixtures } from './fixtures.mjs'
const server = await createServer({server:{host:'127.0.0.1',port:5185,strictPort:true}})
await server.listen()
let browser
let widget = false
try {
 browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true})
 const spaced = t => t.split(/(\s+)/).map(p => /\s/.test(p) ? p : [...p].join('\u2060')).join('')
 const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}), data = fixtures(), errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>localStorage.setItem('usriolunato:__secret','test-only'))
 await page.route('https://script.google.com/**',async route=>{
  const b=route.request().postDataJSON(), res={ok:true}
  if(b.action==='seasons')Object.assign(res,{stagioni:['2026/27'],attiva:'2026/27'})
  if(b.action==='listAll')res.liste=b.richieste.map(r=>({collection:r.collection,items:data[r.collection] || []}))
  if(b.action==='list')res.items=data[b.collection] || []
  if(b.action==='archivioList')Object.assign(res,{documenti:[],foto:[]})
  if(b.action==='campionato' && widget) res.dati={titolo:'Classifica',widgetUrl:'https://www.tuttocampo.it/WidgetV2/Classifica/2720a2d7-997c-43e2-b728-0ff49e1d97bf',classifica:[],partite:[]}
  if(b.action==='campionato' && !widget)res.dati={titolo:'Girone B',classifica:[{squadra:'U.S. Riolunato',punti:12,giocate:5}],partite:[]}
  if(b.action==='listaSalva') {data[b.collection] ||= [];data[b.collection]=[...data[b.collection].filter(r=>r.id!==b.record.id),b.record];res.item=b.record}
  await route.fulfill({json:res})
 })
 const visit = async path => {await page.goto(`http://127.0.0.1:5185/#${path}`);await page.locator('.app-container').waitFor();await page.locator('.pagina-in-arrivo').waitFor({state:'hidden'})}
 await visit('/liste')
 await page.getByRole('button',{name:/Nuova lista/}).click()
 let modal=page.getByRole('dialog')
 await modal.getByLabel(spaced('Nome lista'),{exact:true}).fill('Tombola del paese')
 await modal.getByRole('button',{name:'Salva lista',exact:true}).click()
 await modal.waitFor({state:'hidden'})
 await page.getByRole('button',{name:'Aggiungi riga',exact:true}).click()
 modal=page.getByRole('dialog')
 await modal.getByLabel(spaced('Nome'),{exact:true}).fill('Forno di prova')
 await modal.getByRole('button',{name:'Salva riga',exact:true}).click()
 await modal.waitFor({state:'hidden'})
 assert.equal(data.righeListe.length,1)
 assert.equal(await page.getByRole('cell',{name:'Forno di prova',exact:true}).count(),1)
 await page.reload();await page.getByRole('combobox',{name:'Scegli lista'}).click()
 await page.locator('.ant-select-item-option').filter({hasText:'Tombola del paese'}).click()
 await page.getByRole('cell',{name:'Forno di prova',exact:true}).waitFor()
 for(const path of ['/liste','/loghi','/campionato','/social?kind=rinvio']) {
  await visit(path)
  if(path==='/campionato') {await page.getByRole('cell',{name:'U.S. Riolunato',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Modifica classifica e calendario'}).count(),0)}
  if(path.startsWith('/social')) {assert.equal(await page.getByText('Motivo del rinvio',{exact:true}).count(),0);assert.equal(await page.getByText('Data del recupero (facoltativa)',{exact:true}).count(),0);await page.locator('canvas').first().waitFor();await page.getByRole('combobox',{name:'Partita da rinviare'}).waitFor()}
  for(const width of [320,768,1440]) {await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.app-container *')].map(e=>({tag:e.tagName,cls:String(e.className).slice(0,100),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(r=>r.right>innerWidth+1&&r.width>0).slice(0,20)}));assert.ok(layout.scroll<=layout.width+1,`${path} overflow ${width}: ${JSON.stringify(layout)}`)}
 }
 widget=true
 await page.route('https://www.tuttocampo.it/**',route=>route.fulfill({contentType:'text/html',body:'<p>Classifica del girone (fixture)</p>'}))
 await visit('/campionato')
 await page.locator('iframe[title="Classifica TuttoCampo"]').waitFor()
 assert.equal(await page.getByText('Fonte della classifica · solo Admin',{exact:true}).count(),0)
 assert.equal(await page.getByRole('tab',{name:'Risultati e calendario'}).count(),0)
 assert.deepEqual(errors,[])
 console.log('Club features: creazione lista, riga persistente, campionato non Admin, grafica rinvio e layout a 320/768/1440 verificati.')
} finally {await browser?.close();await server.close()}
