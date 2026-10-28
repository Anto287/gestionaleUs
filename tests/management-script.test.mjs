import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'

class Sheet {
  rows = []
  constructor(name = '') { this.name = name }
  setName(name) { this.name = name }
  getName() { return this.name }
  appendRow(row) { this.rows.push(row) }
  setFrozenRows() {}
  getLastRow() { return this.rows.length }
  getMaxRows() { return this.maxRows || 1000 }
  insertRowsAfter(_, count) { this.maxRows = this.getMaxRows() + count }
  getRange(row, col, count = 1, columns = 1) {
    const self = this
    return {
      getValue: () => self.rows[row - 1]?.[col - 1] ?? '',
      getValues: () => Array.from({ length: count }, (_, i) => Array.from({ length: columns }, (_, j) => self.rows[row + i - 1]?.[col + j - 1] ?? '')),
      setValues: (values) => values.forEach((r, i) => r.forEach((value, j) => { (self.rows[row + i - 1] ??= [])[col + j - 1] = value })),
      createTextFinder: (id) => {
        const finder = { matchEntireCell: () => finder, matchCase: () => finder, useRegularExpression: () => finder,
          findNext: () => {
            const i = self.rows.findIndex((r, i) => i >= row - 1 && i < row - 1 + count && r[col - 1] === id)
            return i < 0 ? null : { getRow: () => i + 1 }
          } }
        return finder
      },
    }
  }
}
function setup() {
  const props = new Map([['ADMIN_PASSWORD', 'admin-test-123456']]), cache = new Map(), sheets = [new Sheet('Sheet1')]
  const ss = { getId: () => 'private-management-id', getSheets: () => sheets, getSheetByName: (name) => sheets.find((s) => s.name === name), insertSheet: (name) => { const s = new Sheet(name); sheets.push(s); return s } }
  let locked = false, writes = 0, now = Date.now()
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  const context = vm.createContext({ console, Date: ClockDate,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v), deleteProperty: (k) => props.delete(k) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    SpreadsheetApp: { create: () => ss, openById: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false, 'nessun lock annidato'); locked = true }, releaseLock() { locked = false } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ setMimeType() { return this }, getContent: () => text }) },
    Utilities: { getUuid: randomUUID, sleep() {}, DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_, s) => createHash('sha256').update(s).digest(), base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
      formatDate: (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    },
  })
  const source = readFileSync(new URL('../docs/apps-script.gs', import.meta.url), 'utf8').replace("const SECRET = '';", "const SECRET = 'app-test-secret';")
  vm.runInContext(source, context)
  const records = new Map()
  context.listDalFoglio_ = context.listItems = (c, season) => structuredClone(records.get(`${c}/${season}`) || [])
  context.rebuildSheet_ = (c, season, items) => { writes++; records.set(`${c}/${season}`, structuredClone(items)) }
  context.uploadDoc = () => { writes++; return { id: 'file-test', nome: 'test.pdf' } }
  const device = { id: randomUUID(), browser: 'Chrome', sistema: 'macOS' }
  const call = (body) => JSON.parse(context.route({ secret: 'app-test-secret', device, ...body }).getContent())
  const login = () => call({ action: 'managementLogin', password: 'admin-test-123456' })
  const logs = () => (ss.getSheetByName('Attivita')?.rows.slice(1) || []).map((r) => JSON.parse(r[1]))
  return { context, call, login, logs, records, device, props, cache, ss, writes: () => writes, advance: (ms) => { now += ms } }
}

test('management: password separata, sessione persistente legata al browser e revoca', () => {
  const s = setup()
  assert.equal(s.call({ action: 'managementDevices' }).code, 'ADMIN_AUTH')
  assert.equal(s.call({ action: 'managementLogin', password: 'app-test-secret' }).ok, false)
  const session = s.login()
  assert.equal(session.ok, true)
  assert.equal(s.call({ action: 'managementDevices', adminToken: session.token }).devices.length, 1)
  s.advance(366 * 24 * 60 * 60 * 1000)
  s.cache.clear()
  assert.equal(s.call({ action: 'managementSession', adminToken: session.token }).persistent, true)
  assert.equal(s.call({ action: 'managementDevices', adminToken: session.token, device: { id: randomUUID() } }).code, 'ADMIN_AUTH')
  assert.equal(JSON.stringify([...s.props.values()]).includes(session.token), false, 'sul server solo hash del token')
  const next = s.login()
  assert.equal(s.call({ action: 'managementDevices', adminToken: session.token }).code, 'ADMIN_AUTH', 'il nuovo accesso sostituisce il precedente sullo stesso browser')
  assert.equal(s.call({ action: 'managementLogout', adminToken: next.token }).ok, true)
  assert.equal(s.call({ action: 'managementDevices', adminToken: next.token }).code, 'ADMIN_AUTH')
})
test('management: blocco dopo cinque password errate e invalidazione al cambio password', () => {
  const s = setup(), session = s.login()
  for (let i = 0; i < 5; i++) s.call({ action: 'managementLogin', password: 'errata' })
  assert.match(s.login().error, /Troppi tentativi/)
  s.advance(300001)
  assert.equal(s.login().ok, true)
  s.props.set('ADMIN_PASSWORD', 'password-cambiata-1234')
  assert.equal(s.call({ action: 'managementDevices', adminToken: session.token }).code, 'ADMIN_AUTH')
})
test('management: salvataggi serializzati, differenze e deduplicazione dopo perdita risposta', () => {
  const s = setup(), requestId = randomUUID(), record = { id: 'g1', nome: 'Mario', documento: 'SEGRETO', certificatoMedico: true }
  const body = { action: 'put', collection: 'giocatori', season: '2026-27', record, requestId }
  assert.equal(s.call(body).ok, true)
  assert.equal(s.call(body).ok, true)
  assert.equal(s.writes(), 1)
  assert.equal(s.logs().length, 1)
  assert.equal(s.logs()[0].activity.azione, 'Creazione')
  assert.equal(JSON.stringify(s.logs()).includes('SEGRETO'), false)
  assert.equal(s.call({ ...body, record: { ...record, nome: 'Altro' } }).ok, false)
  assert.equal(s.call({ ...body, record: { ...record, nome: 'Marco' }, requestId: randomUUID() }).ok, true)
  const last = s.logs().at(-1).activity
  assert.equal(last.azione, 'Modifica')
  assert.deepEqual(last.dettagli.find((d) => d.campo === 'nome'), { campo: 'nome', prima: 'Mario', dopo: 'Marco' })
})
test('management: file caricati una sola volta con stesso requestId', () => {
  const s = setup(), body = { action: 'upload', season: '2026-27', nome: 'test.pdf', tipo: 'application/pdf', dataBase64: 'CONTENUTO-RISERVATO', requestId: randomUUID() }
  assert.equal(s.call(body).item.id, 'file-test')
  assert.equal(s.call(body).item.id, 'file-test')
  assert.equal(s.writes(), 1)
  assert.equal(JSON.stringify(s.logs()).includes('CONTENUTO-RISERVATO'), false)
})
test('management: dispositivo rinominato e file privato protetto dagli endpoint ordinari', () => {
  const s = setup(), { token } = s.login()
  assert.equal(s.call({ action: 'managementRenameDevice', adminToken: token, id: s.device.id, nome: '=PC Lavoro', requestId: randomUUID() }).device.nome, '=PC Lavoro')
  assert.equal(s.call({ action: 'managementDevices', adminToken: token }).devices[0].nome, '=PC Lavoro')
  const raw = s.ss.getSheetByName('Dispositivi').rows[1][1]
  assert.equal(raw.startsWith('='), false, 'nome conservato come JSON, non formula')
  for (const action of ['exportPdf', 'renameDoc', 'delete', 'archivioFile']) assert.equal(s.call({ action, id: 'private-management-id' }).ok, false)
  assert.equal(s.call({ action: 'list', collection: 'management' }).ok, false)
})
test('management: filtri e paginazione conservano gli eventi fuori dalla pagina', () => {
  const s = setup(), { token } = s.login()
  for (let i = 0; i < 30; i++) s.call({ action: 'put', collection: 'conti', season: 'globale', record: { id: `c${i}`, descrizione: `Movimento ${i}` }, requestId: randomUUID() })
  const first = s.call({ action: 'managementActivities', adminToken: token, filters: { sezione: 'conti' } })
  assert.equal(first.total, 30); assert.equal(first.activities.length, 25)
  const second = s.call({ action: 'managementActivities', adminToken: token, filters: { sezione: 'conti', offset: 25 } })
  assert.equal(second.activities.length, 5)
  assert.equal(s.call({ action: 'managementActivities', adminToken: token, filters: { ricerca: 'Movimento 29' } }).total, 1)
  assert.equal(s.call({ action: 'managementActivities', adminToken: token, filters: { dal: '2099-01-01' } }).total, 0)
})
test('management: errori di scrittura e richieste interrotte restano distinguibili', () => {
  const s = setup(), body = { action: 'put', collection: 'conti', season: 'globale', record: { id: 'c1' }, requestId: randomUUID() }
  s.context.rebuildSheet_ = () => { throw new Error('errore di prova') }
  assert.equal(s.call(body).ok, false)
  assert.equal(s.logs().at(-1).activity.esito, 'fallita')
  // Simula una esecuzione terminata dopo l'avvio: non ripete una modifica dall'esito incerto.
  const sheet = s.ss.getSheetByName('Attivita'), entry = JSON.parse(sheet.rows.at(-1)[1])
  entry.activity.esito = 'in_corso'; sheet.rows.at(-1)[1] = JSON.stringify(entry)
  assert.match(s.call(body).error, /Esito precedente da verificare/)
})
test('management: un errore prima della scrittura viene registrato senza modificare i dati', () => {
  const s = setup()
  s.context.listDalFoglio_ = () => { throw new Error('foglio non leggibile') }
  assert.equal(s.call({ action: 'put', collection: 'conti', season: 'globale', record: { id: 'c1' }, requestId: randomUUID() }).ok, false)
  assert.equal(s.writes(), 0)
  assert.equal(s.logs().at(-1).activity.esito, 'fallita')
})
test('management: senza configurazione della chiave applicativa nessuna richiesta è autorizzata', () => {
  const context = vm.createContext({ Utilities: { sleep() {} }, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType() { return this }, getContent: () => t }) } })
  vm.runInContext(readFileSync(new URL('../docs/apps-script.gs', import.meta.url), 'utf8'), context)
  assert.equal(JSON.parse(context.route({ action: 'seasons', secret: '' }).getContent()).ok, false)
})
test('management: paginazione senza filtri e crescita del foglio oltre le righe iniziali', () => {
  const s = setup(), { token } = s.login()
  for (let i = 0; i < 26; i++) s.call({ action: 'deviceHello', requestId: randomUUID() })
  const first = s.call({ action: 'managementActivities', adminToken: token })
  assert.equal(first.total, 27); assert.equal(first.activities.length, 25)
  const next = s.call({ action: 'managementActivities', adminToken: token, filters: { offset: 25 } })
  assert.equal(next.activities.length, 2)
  const sheet = s.ss.getSheetByName('Attivita')
  s.context.mgmtWrite_(sheet, 1001, randomUUID(), { activity: {} })
  assert.equal(sheet.getMaxRows(), 1500)
})
