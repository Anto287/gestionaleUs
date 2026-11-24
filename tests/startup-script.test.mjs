import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

function setup({ fail = [], cache = new Map(), rejectBatch = false } = {}) {
  const batches = [], retried = [], searches = []
  const context = vm.createContext({
    FILE_RADICE: { conti: 'Bilancio' }, DATO_COL: 'dato_json',
    seasonKey_: (s) => s.replaceAll('/', '-'),
    serviziVeloci_: () => true,
    cercaPerNome_: (...args) => { searches.push(args); return null },
    cacheChiave_: (c, s) => `${c}/${s}`,
    cacheLeggi_: (k) => cache.get(k) ?? null,
    cacheScrivi_: (k, v) => cache.set(k, v),
    fileIdSezione_: (c) => c === 'missing' ? null : c,
    recordDaRighe_: (rows) => (rows ?? []).slice(1).filter((r) => r[0]).map((r) => JSON.parse(r[0])),
    listAllItems: (rs) => rs.flatMap((r) => {
      retried.push(r.collection)
      return r.collection === 'broken' ? [] : [{ collection: r.collection, items: [{ id: 'fallback' }] }]
    }),
    ScriptApp: { getOAuthToken: () => 'test-token' },
    UrlFetchApp: { fetchAll: (requests) => {
      batches.push(requests)
      if (rejectBatch) throw Error('network')
      return requests.map((r) => ({
        getResponseCode: () => fail.some((c) => r.url.includes(`/${c}/`)) ? 403 : 200,
        getContentText: () => JSON.stringify({ range: 'A1:B2', values: [['dato_json'], ['{"id":"live"}']] }),
      }))
    } },
  })
  vm.runInContext(readFileSync(new URL('../docs/apps-script-avvio-veloce.gs', import.meta.url), 'utf8'), context)
  const read = (collections) => JSON.parse(JSON.stringify(context.listAllItems(collections.map((collection) => ({ collection, season: '2026/27' })))))
  return { context, read, batches, retried, searches }
}

test('19 fogli senza cache: tre lotti invece di 19 letture seriali', () => {
  const s = setup()
  assert.equal(s.read(Array.from({ length: 19 }, (_, i) => `c${i}`)).length, 19)
  assert.deepEqual(s.batches.map((b) => b.length), [8, 8, 3])
  assert.deepEqual(s.retried, [])
  assert.ok(s.batches[0][0].headers.Authorization === 'Bearer test-token')
})
test('cache, file assente e ripiego del singolo errore', () => {
  const s = setup({ fail: ['broken'], cache: new Map([['cached/2026/27', []]]) })
  const result = s.read(['cached', 'missing', 'live', 'broken', 'documenti'])
  assert.equal(result.length, 4, 'il foglio fallito non diventa una tabella vuota')
  assert.deepEqual(s.retried, ['documenti', 'broken'])
  assert.equal(s.batches[0].length, 2)
})
test('fetchAll indisponibile: ripiego senza perdere tabelle', () => {
  const s = setup({ rejectBatch: true })
  assert.equal(s.read(['giocatori', 'conti']).length, 2)
  assert.deepEqual(s.retried, ['giocatori', 'conti'])
})
test('cartella mancante cercata una sola volta per esecuzione', () => {
  const s = setup()
  s.context.cercaPerNome_('root', '2026-27', 'folder')
  s.context.cercaPerNome_('root', '2026-27', 'folder')
  assert.equal(s.searches.length, 1)
})

test('ripiego legge solo intestazione e colonna JSON fino all’ultima riga', () => {
  const s = setup(), ranges = []
  s.context.findSheet_ = () => ({
    getLastRow: () => 3,
    getLastColumn: () => 6,
    getRange: (...args) => {
      ranges.push(args)
      return { getValues: () => args[0] === 1 ? [['Nome', 'Cognome', 'Ruolo', 'Certificato', 'Scadenza', 'dato_json']] : [['{"id":"a"}'], ['{"id":"b"}']] }
    },
  })
  assert.equal(s.context.listDalFoglio_('giocatori', '2026-27').length, 2)
  assert.deepEqual(ranges, [[1, 1, 1, 6], [2, 6, 2, 1]])
})
test('servizi avanzati assenti: conserva la compatibilità con lo script precedente', () => {
  const s = setup()
  s.context.serviziVeloci_ = () => false
  assert.equal(s.read(['giocatori']).length, 1)
  assert.equal(s.batches.length, 0)
  assert.deepEqual(s.retried, ['giocatori'])
})
test('blocco nel file completo e nel file da incollare identici', () => {
  const patch = readFileSync(new URL('../docs/apps-script-avvio-veloce.gs', import.meta.url), 'utf8')
  assert.ok(readFileSync(new URL('../docs/apps-script.gs', import.meta.url), 'utf8').endsWith(patch))
})

test('cache ID scaduta: elenca una volta per cartella, con paginazione', () => {
  const s = setup(), calls = [], cache = new Map()
  Object.assign(s.context, {
    PARENT_FOLDER_ID: 'root', MIME_CARTELLA: 'folder', MIME_FOGLIO: 'sheet',
    FILE_STAGIONE: { giocatori: 'Giocatori', partite: 'Partite' }, CACHE_FILE_SECONDI: 21600,
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k), put: (k, v) => cache.set(k, v) }) },
    cercaPerNome_: () => 'season-folder',
    Drive: { Files: { list: (options) => {
      calls.push(options)
      return options.pageToken ? { files: [{ name: 'Partite', id: 'p' }] } : { files: [{ name: 'Giocatori', id: 'g' }], nextPageToken: 'next' }
    } } },
  })
  assert.equal(s.context.fileIdSezione_('giocatori', '2026/27'), 'g')
  assert.equal(s.context.fileIdSezione_('partite', '2026/27'), 'p')
  assert.equal(s.context.fileIdSezione_('giocatori', '2026/27'), 'g')
  assert.equal(calls.length, 2, 'due pagine una sola volta, anche per più raccolte')
  assert.equal(calls[1].pageToken, 'next')
  assert.ok(calls[0].q.includes("mimeType = 'sheet'"))
})
