// ====== DA COMPILARE ======
const PARENT_FOLDER_ID = '';
const SECRET = '';
const ARCHIVIO_DOCUMENTI_ID = '';
const ARCHIVIO_FOTO_ID = '';
var CACHE_SECONDI = 600; // 10 minuti: gli elenchi
var CACHE_FILE_SECONDI = 21600; // 6 ore: gli id dei file, che non cambiano mai
var CACHE_PEZZO = 90000;
// ===========================

// STRUTTURA SUL DRIVE (dentro la cartella madre = PARENT_FOLDER_ID)
//
// GESTIONALE
// ├── Stagioni        (foglio: elenco stagioni + quella attiva)
// ├── Bilancio        (UN solo foglio, una scheda per stagione)
// ├── Magazzino       (UN solo foglio, una scheda per stagione)
// ├── Grafica         (le grafiche IG salvate dall'app)
// ├── 2025-26         (una cartella per stagione)
// │   ├── Partite | Giocatori | Allenamenti | Distinte   (un foglio ciascuno)
// │   └── Documenti   (i file caricati dall'app)
// └── 2026-27
//     └── ...
//
// La struttura viene creata subito quando l'app crea una stagione
// (azione "setSeasons"), non solo al primo dato salvato.
//
// Nota: nei nomi delle cartelle la "/" diventa "-" (2025/26 → 2025-26).
//
// SERVIZI: l'azione 'exportPdf' (anteprima di stampa dei file Office) usa il
// servizio avanzato "Drive API": nel pannello a sinistra, accanto a Servizi,
// premi + e aggiungi "Drive API" (v3). Stesso permesso di DriveApp, quindi
// non chiede nuove autorizzazioni. Senza servizio, Documenti/Fogli Google e
// PDF funzionano comunque; per docx/xlsx l'app ripiega sull'anteprima Google.

// file unici nella cartella madre: una scheda (tab) per ogni stagione
const FILE_RADICE = { conti: 'Bilancio', magazzino: 'Magazzino' };
// file dentro la cartella di ogni stagione
const FILE_STAGIONE = {
  giocatori: 'Giocatori',
  allenamenti: 'Allenamenti',
  partite: 'Partite',
  distinte: 'Distinte',
};
const DOCUMENTI_FOLDER = 'Documenti';
const GRAFICA_FOLDER = 'Grafica';
const SEASONS_SHEET_NAME = 'Stagioni';
const DATO_COL = 'dato_json'; // colonna tecnica (nascosta) col record esatto
// sotto l'ultima riga di dati restano SEMPRE almeno mille righe vuote:
// quando i dati arrivano in fondo, il foglio si allunga da solo di altre 1000
const RIGHE_LIBERE = 1000;

function doGet(e) { return route(e.parameter); }
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return route(body);
}

/**
 * Confronto della chiave a tempo costante: scorre TUTTI i caratteri e non
 * "esce prima" al primo diverso, così non si può dedurre la chiave dai tempi
 * di risposta. La difesa vera resta però (1) una chiave lunga e casuale e
 * (2) il ritardo su chiave errata dentro route().
 */
function secretOk_(candidate) {
  var a = String(candidate == null ? '' : candidate);
  var b = String(SECRET);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function routeOriginal_(p) {
  try {
    if (!secretOk_(p.secret)) {
      // rallenta i tentativi a tappeto: con chiave casuale da 20 caratteri
      // il brute force online diventa di fatto impossibile.
      Utilities.sleep(1000);
      return json({ ok: false, error: 'non autorizzato' });
    }
    switch (p.action) {
      case 'list':          return json({ ok: true, items: listItems(p.collection, p.season) });
      case 'put':           return json({ ok: true, item: putItem(p.collection, p.season, p.record) });
      case 'putAll':        return json({ ok: true, count: putAllItems(p.collection, p.season, p.records) });
      case 'delete':        return json({ ok: true, deletedId: deleteItem(p.collection, p.season, p.id) });
      case 'upload':        return json({ ok: true, item: uploadDoc(p.season, p.nome, p.tipo, p.dataBase64) });
      case 'createDoc':     return json({ ok: true, item: createDoc(p.season, p.nome, p.tipo) });
      case 'renameDoc':     return json({ ok: true, item: renameDoc(p.id, p.nome) });
      case 'exportPdf':     return json({ ok: true, dataBase64: exportPdf(p.id) });
      case 'uploadGrafica': return json({ ok: true, item: uploadGrafica(p.nome, p.dataBase64) });
      case 'seasons':       return json(readSeasons());
      case 'setSeasons':    return json(writeSeasons(p.stagioni, p.attiva));
      case 'archivioList':  return json({ ok: true, documenti: archivioList('documenti'), foto: archivioList('foto') });
      case 'archivioThumbs':return json({ ok: true, thumbs: archivioThumbs(p.ids) });
      case 'archivioFile':  return json(archivioFile(p.id));
      case 'archivioUpload':return json({ ok: true, item: archivioUpload(p.cartella, p.nome, p.tipo, p.dataBase64) });
      case 'archivioDelete':return json({ ok: true, deletedId: archivioDelete(p.id) });
      case 'ics':           return icsCalendar(p.season); // feed calendario (GET, per abbonarsi)
      case 'listAll':       return json({ ok: true, liste: listAllItems(p.richieste) });
      case 'promemoriaTessere':
      case 'confermaStampaTessere':
      case 'configuraPromemoriaTessere': return promemoriaTessere_(p);
      default:              return json({ ok: false, error: 'azione sconosciuta' });
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== regole base =====
//
// - la LETTURA non crea mai nulla (se manca qualcosa, restituisce vuoto);
// - la SCRITTURA crea sotto un lock (withLock_), così due richieste in
//   parallelo non creano mai la stessa cartella o lo stesso foglio due volte.
//   I helper ensure* NON prendono il lock da soli: lo prende chi scrive.

function withLock_(fn) {
  if (mgmtLockHeld_) return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  mgmtLockHeld_ = true;
  try { return fn(); } finally { mgmtLockHeld_ = false; lock.releaseLock(); }
}

function parentFolder_() {
  return DriveApp.getFolderById(PARENT_FOLDER_ID);
}

/** Nel Drive la "/" del nome stagione diventa "-" (2025/26 → 2025-26). */
function seasonKey_(season) {
  return String(season).replace(/\//g, '-').trim();
}

// ===== cartelle e file =====

/** Cartella figlia già esistente, oppure null. NON crea. */
function findChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

/** Cartella figlia esistente o creata (solo in scrittura, sotto lock). */
function ensureChildFolder_(parent, name) {
  return findChildFolder_(parent, name) || parent.createFolder(name);
}

/** Foglio Google (file) con quel nome dentro la cartella, oppure null. NON crea. */
function findSpreadsheetIn_(folder, name) {
  var it = folder.getFilesByName(name);
  while (it.hasNext()) {
    var f = it.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.open(f);
  }
  return null;
}

/** Foglio Google esistente o creato nella cartella (solo in scrittura, sotto lock). */
function ensureSpreadsheetIn_(folder, name) {
  var ss = findSpreadsheetIn_(folder, name);
  if (ss) return ss;
  ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss;
}

/** Se il file ha ancora la scheda vuota di partenza (Foglio1/Sheet1), la toglie. */
function rimuoviSchedaIniziale_(ss) {
  ['Foglio1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
}

// ===== dove vive ogni sezione =====

/** La scheda (tab) di una sezione, in sola LETTURA (null se non esiste). */
function findSheet_(collection, season) {
  var key = seasonKey_(season);
  if (FILE_RADICE[collection]) {
    var ss = findSpreadsheetIn_(parentFolder_(), FILE_RADICE[collection]);
    return ss ? ss.getSheetByName(key) : null;
  }
  var folder = findChildFolder_(parentFolder_(), key);
  if (!folder) return null;
  var nome = FILE_STAGIONE[collection] || nomeFile_(collection);
  var ss2 = findSpreadsheetIn_(folder, nome);
  return ss2 ? ss2.getSheets()[0] : null;
}

/** La scheda di una sezione, creando file/cartelle se mancano (solo sotto lock). */
function ensureSheet_(collection, season) {
  var key = seasonKey_(season);
  if (FILE_RADICE[collection]) {
    var ss = ensureSpreadsheetIn_(parentFolder_(), FILE_RADICE[collection]);
    var sh = ss.getSheetByName(key);
    if (!sh) {
      sh = ss.insertSheet(key);
      rimuoviSchedaIniziale_(ss);
    }
    return sh;
  }
  var folder = ensureChildFolder_(parentFolder_(), key);
  var nome = FILE_STAGIONE[collection] || nomeFile_(collection);
  var ss2 = ensureSpreadsheetIn_(folder, nome);
  var sh2 = ss2.getSheets()[0];
  if (sh2.getName() !== nome) sh2.setName(nome);
  return sh2;
}

function nomeFile_(collection) {
  return collection.charAt(0).toUpperCase() + collection.slice(1);
}

// ===== lettura (non crea nulla) =====

function docMeta_(file) {
  return {
    id: file.getId(), nome: file.getName(), tipo: file.getMimeType(), dimensione: file.getSize(),
    caricatoIl: Utilities.formatDate(file.getDateCreated(), 'Europe/Rome', 'yyyy-MM-dd'), url: file.getUrl(),
  };
}

/** Chi ha il link può modificare: così tutta la società lavora sugli stessi file. */
function condividiViaLink_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT); } catch (e) {}
}

// ===== scrittura (sempre sotto lock) =====

function putItem(collection, season, record) {
  if (collection === 'documenti') return record; // i documenti passano da 'upload'
  return withLock_(function () {
    var records = listItems(collection, season);
    if (collection === 'giocatori') versioneTessere_([record], records);
    var trovato = false;
    for (var i = 0; i < records.length; i++) {
      if (records[i].id === record.id) { records[i] = record; trovato = true; break; }
    }
    if (!trovato) records.push(record);
    rebuildSheet_(collection, season, records);
    return record;
  });
}

/** Sostituisce TUTTI i record della sezione in un colpo solo (import dall'app). */
function putAllItems(collection, season, records) {
  if (collection === 'documenti') return 0;
  return withLock_(function () {
    var recs = (records || []).filter(function (r) { return r && r.id; });
    if (collection === 'giocatori') versioneTessere_(recs, listItems(collection, season));
    rebuildSheet_(collection, season, recs);
    return recs.length;
  });
}

// La versione vive nel record: un inserimento fallito non genera un avviso.
// Il contatore avanza sotto lo stesso lock usato per scrivere la rosa.
var TESSERE_CICLO = 'TESSERE_PROMEMORIA_CICLO';
var TESSERE_VERSIONE = 'TESSERE_PROMEMORIA_VERSIONE';
var TESSERE_CAMPO = '_versionePromemoriaTessera';

function prossimaVersioneTessere_(props) {
  var versione = Number(props.getProperty(TESSERE_VERSIONE) || 0) + 1;
  props.setProperty(TESSERE_VERSIONE, String(versione));
  return versione;
}

function haTessera_(record) {
  return !!(record && String(record.tessera == null ? '' : record.tessera).trim());
}

function versioneTessere_(records, precedenti) {
  var props = mgmtProps_();
  var attivo = !!props.getProperty(TESSERE_CICLO);
  var perId = new Map(precedenti.map(function (r) { return [r.id, r]; }));
  var versione = 0;
  records.forEach(function (record) {
    delete record[TESSERE_CAMPO]; // il valore del client non è autorevole
    if (!attivo || !haTessera_(record)) return;
    var prima = perId.get(record.id);
    if (haTessera_(prima)) {
      if (prima[TESSERE_CAMPO]) record[TESSERE_CAMPO] = prima[TESSERE_CAMPO];
      return; // correggere un numero già presente non è un nuovo tesseramento
    }
    if (!versione) versione = prossimaVersioneTessere_(props);
    record[TESSERE_CAMPO] = versione;
  });
}

function promemoriaTessere_(p) {
  var stagione = seasonKey_(p.season);
  if (!/^\d{4}-\d{2,4}$/.test(stagione)) throw new Error('Stagione non valida');
  return withLock_(function () {
    var props = mgmtProps_();
    var ciclo = Number(props.getProperty(TESSERE_CICLO) || 0);
    if (p.action === 'configuraPromemoriaTessere') {
      if (!mgmtSession_(p)) return json({ ok: false, code: 'ADMIN_AUTH', error: 'Solo gli amministratori possono modificare il promemoria.' });
      if (typeof p.attivo !== 'boolean') throw new Error('Impostazione non valida');
      if (p.attivo && !ciclo) {
        ciclo = prossimaVersioneTessere_(props);
        props.setProperty(TESSERE_CICLO, String(ciclo));
        return json({ ok: true, attivo: true, ciclo: ciclo, versione: ciclo, nuovi: 0 });
      } else if (!p.attivo && ciclo) {
        props.deleteProperty(TESSERE_CICLO);
        ciclo = 0;
      }
    }
    if (!ciclo) return json({ ok: true, attivo: false, ciclo: 0, versione: 0, nuovi: 0 });

    var chiave = 'TESSERE_PROMEMORIA_CONFERMATA_' + stagione;
    var confermata = Math.max(ciclo, Number(props.getProperty(chiave) || 0));
    var versioni = listItems('giocatori', stagione).filter(haTessera_).map(function (r) {
      return Number(r[TESSERE_CAMPO] || 0);
    });
    var ultima = versioni.reduce(function (max, v) { return Math.max(max, v); }, confermata);
    // Conferma solo le versioni già mostrate. Eventuali nuove tessere restano in attesa.
    if (p.action === 'confermaStampaTessere' && p.ciclo === ciclo && Number.isSafeInteger(p.versione) && p.versione > confermata) {
      confermata = Math.min(p.versione, ultima);
      props.setProperty(chiave, String(confermata));
    }
    return json({ ok: true, attivo: true, ciclo: ciclo, versione: ultima, nuovi: versioni.filter(function (v) { return v > confermata; }).length });
  });
}

function deleteItem(collection, season, id) {
  if (collection === 'documenti') {
    DriveApp.getFileById(id).setTrashed(true);
    return id;
  }
  return withLock_(function () {
    var records = listItems(collection, season).filter(function (r) { return r.id !== id; });
    rebuildSheet_(collection, season, records);
    return id;
  });
}

function uploadDoc(season, nome, tipo, dataBase64) {
  return withLock_(function () {
    var seasonFolder = ensureChildFolder_(parentFolder_(), seasonKey_(season));
    var docFolder = ensureChildFolder_(seasonFolder, DOCUMENTI_FOLDER);
    var blob = Utilities.newBlob(Utilities.base64Decode(dataBase64), tipo || 'application/octet-stream', nome);
    var file = docFolder.createFile(blob);
    condividiViaLink_(file);
    return docMeta_(file);
  });
}

/**
 * Salva una grafica (PNG) dell'app nella cartella "Grafica" della cartella
 * madre, accanto alle stagioni (pagina Grafiche IG → "Salva su Drive").
 */
function uploadGrafica(nome, dataBase64) {
  return withLock_(function () {
    var folder = ensureChildFolder_(parentFolder_(), GRAFICA_FOLDER);
    var blob = Utilities.newBlob(Utilities.base64Decode(dataBase64), 'image/png', nome);
    var file = folder.createFile(blob);
    condividiViaLink_(file);
    return docMeta_(file);
  });
}

/**
 * Crea un documento VERO sul Drive, dentro Documenti della stagione:
 * tipo 'foglio' → Foglio Google (Sheets), altrimenti Documento Google (Docs).
 * L'app poi lo apre nell'editor di Google: funzionalità complete.
 */
function createDoc(season, nome, tipo) {
  return withLock_(function () {
    var seasonFolder = ensureChildFolder_(parentFolder_(), seasonKey_(season));
    var docFolder = ensureChildFolder_(seasonFolder, DOCUMENTI_FOLDER);
    var nomePulito = String(nome || '').trim() || 'Senza nome';
    var id = tipo === 'foglio'
      ? SpreadsheetApp.create(nomePulito).getId()
      : DocumentApp.create(nomePulito).getId();
    var file = DriveApp.getFileById(id);
    file.moveTo(docFolder);
    condividiViaLink_(file);
    return docMeta_(file);
  });
}

/**
 * Rinomina il file vero nella cartella Documenti (id = id del file sul
 * Drive, lo stesso che l'app mostra in lista). La lista documenti legge i
 * nomi direttamente dai file, quindi non c'è nient'altro da aggiornare.
 */
function renameDoc(id, nome) {
  return withLock_(function () {
    var file = DriveApp.getFileById(String(id));
    var nomePulito = String(nome || '').trim();
    if (nomePulito) file.setName(nomePulito);
    return docMeta_(file);
  });
}

// ===== anteprima di stampa =====

/**
 * PDF "di stampa" di un file dell'archivio: Documenti/Fogli Google vengono
 * convertiti come fa Stampa, i PDF caricati tornano come sono, i file
 * Office (docx/xlsx/pptx) passano da una copia Google temporanea subito
 * cestinata (serve il servizio avanzato "Drive API", stesso permesso di
 * DriveApp). Restituisce i byte in base64. L'app disegna questo PDF
 * nell'anteprima, così sul telefono si vede il foglio stampato vero e non
 * la vista "riflowata" del visualizzatore Google.
 */
function exportPdf(id) {
  var file = DriveApp.getFileById(String(id));
  var tipo = file.getMimeType();
  if (tipo === 'application/pdf') return Utilities.base64Encode(file.getBlob().getBytes());
  if (tipo.indexOf('application/vnd.google-apps') === 0)
    return Utilities.base64Encode(file.getAs('application/pdf').getBytes());
  if (typeof Drive === 'undefined')
    throw new Error('anteprima non disponibile per questo tipo di file (manca il servizio Drive API)');
  var copia = Drive.Files.copy({ name: 'anteprima-temporanea', mimeType: formatoGoogle_(tipo) }, id);
  try {
    return Utilities.base64Encode(DriveApp.getFileById(copia.id).getAs('application/pdf').getBytes());
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);
  }
}

/** In quale formato Google convertire un file Office per esportarlo in PDF. */
function formatoGoogle_(tipo) {
  if (tipo.indexOf('spreadsheet') >= 0 || tipo.indexOf('excel') >= 0 || tipo === 'text/csv')
    return 'application/vnd.google-apps.spreadsheet';
  if (tipo.indexOf('presentation') >= 0 || tipo.indexOf('powerpoint') >= 0)
    return 'application/vnd.google-apps.presentation';
  return 'application/vnd.google-apps.document';
}

/**
 * Sotto i dati restano sempre almeno RIGHE_LIBERE righe vuote: quando una
 * riga nuova finisce vicino al fondo, il foglio si allunga di altre 1000.
 */
function assicuraRighe_(sheet, righeUsate) {
  var max = sheet.getMaxRows();
  while (max - righeUsate < RIGHE_LIBERE) {
    sheet.insertRowsAfter(max, RIGHE_LIBERE);
    max += RIGHE_LIBERE;
  }
}

function buildGenerico_(collection, sheet, records) {
  var pres = presentazione_(collection, records); // { headers:[], rows:[[]] }
  var headers = pres.headers.concat([DATO_COL]);
  var matrix = [headers];
  for (var i = 0; i < records.length; i++) {
    matrix.push(pres.rows[i].concat([JSON.stringify(records[i])]));
  }
  assicuraRighe_(sheet, matrix.length);
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.hideColumns(headers.length); // nascondi dato_json
  try { sheet.autoResizeColumns(1, headers.length - 1); } catch (e) {}
}

/** Colonne leggibili per ogni sezione (SENZA la colonna tecnica). */
function presentazione_(collection, records) {
  switch (collection) {
    case 'giocatori':
      return {
        headers: ['Nome', 'Cognome', 'Ruolo', 'Cert. medico', 'Scad. certificato'],
        rows: records.map(function (r) {
          return [r.nome || '', r.cognome || '', r.ruoloPreferito || '',
                  r.certificatoMedico ? 'Sì' : '', r.scadenzaCertificato || ''];
        }),
      };
    case 'allenamenti':
      return {
        headers: ['Data', 'Presenti', 'Note'],
        rows: records.map(function (r) {
          var n = 0, p = r.presenze || {};
          for (var k in p) if (p[k]) n++;
          return [r.data || '', n, r.note || ''];
        }),
      };
    case 'partite':
      return {
        headers: ['Data', 'Avversario', 'Dove', 'Risultato', 'Note'],
        rows: records.map(function (r) {
          return [r.data || '', r.avversario || '', r.inCasa ? 'Casa' : 'Fuori',
                  (r.golFatti != null ? r.golFatti : '') + ' - ' + (r.golSubiti != null ? r.golSubiti : ''),
                  r.note || ''];
        }),
      };
    case 'appuntamenti':
      return {
        headers: ['Data', 'Ora', 'Avversario', 'Dove', 'Luogo'],
        rows: records.map(function (r) {
          return [r.data || '', r.ora || '', r.avversario || '', r.inCasa ? 'Casa' : 'Fuori', r.luogo || ''];
        }),
      };
    case 'promemoria':
      return {
        headers: ['Cosa', 'Entro', 'Urgente', 'Assegnato a', 'Fatto'],
        rows: records.map(function (r) {
          return [r.testo || '', r.entro || '', r.urgente ? 'Sì' : '', r.assegnatoA || '', r.fatto ? 'Sì' : ''];
        }),
      };
    case 'distinte':
      return {
        headers: ['Data', 'Avversario', 'Modulo', 'Titolari', 'Panchina'],
        rows: records.map(function (r) {
          return [r.data || '', r.avversario || '', r.modulo || '',
                  (r.titolari || []).length, (r.panchina || []).length];
        }),
      };
    case 'magazzino':
      return {
        headers: ['Nome', 'Categoria', 'Quantità', 'Scadenza'],
        rows: records.map(function (r) {
          return [r.nome || '', r.categoria || '', r.quantita != null ? r.quantita : '', r.scadenza || ''];
        }),
      };
    case 'speseCondivise':
      return {
        headers: [
          'Data', 'Descrizione', 'Società', 'Totale €', 'Anticipata da',
          '% a noi', 'A carico nostro €', 'A carico loro €', 'Conguaglio', 'Stato',
        ],
        rows: records.map(function (r) {
          var totale = Number(r.importo) || 0;
          var perc = isFinite(Number(r.percentuale)) ? Number(r.percentuale) : 50;
          var nostra = Math.round(totale * perc) / 100;
          var loro = Math.round((totale - nostra) * 100) / 100;
          // chi anticipa mette tutto: l'altro gli deve la propria parte
          var dovuto = r.anticipataDa === 'noi' ? loro : -nostra;
          var conguaglio = Math.abs(dovuto) < 0.005
            ? 'in pari'
            : (dovuto > 0 ? 'ci devono ' : 'dobbiamo ') + Math.abs(dovuto).toFixed(2) + ' €';
          return [
            r.data || '',
            r.descrizione || '',
            r.societa || '',
            totale,
            r.anticipataDa === 'noi' ? 'Noi' : (r.societa || 'Loro'),
            perc,
            nostra,
            loro,
            conguaglio,
            r.saldata ? ('saldata' + (r.dataSaldo ? ' il ' + r.dataSaldo : '')) : 'da saldare',
          ];
        }),
      };
    default:
      return { headers: ['id'], rows: records.map(function (r) { return [r.id || '']; }) };
  }
}

/** Sezione Conti: formato "bilancio" + grafico Entrate/Uscite, nella scheda della stagione. */
function buildConti_(sheet, records) {
  var movimenti = records.slice().sort(function (a, b) {
    return String(a.data).localeCompare(String(b.data));
  });

  var headers = ['Data', 'Nome transazione', 'Uscita', 'Entrata', 'Da dare', 'Totale in cassa', DATO_COL];
  var matrix = [headers];
  var cassa = 0, totUscite = 0, totEntrate = 0, totDaDare = 0;
  movimenti.forEach(function (m) {
    var imp = Number(m.importo) || 0;
    if (m.saldato) cassa += (m.tipo === 'entrata' ? imp : -imp);
    if (m.tipo === 'uscita') totUscite += imp; else totEntrate += imp;
    if (!m.saldato) totDaDare += imp;
    var nome = m.controparte ? (m.descrizione + ' · ' + m.controparte) : m.descrizione;
    matrix.push([
      toDate_(m.data), nome,
      m.tipo === 'uscita' ? imp : '',
      m.tipo === 'entrata' ? imp : '',
      !m.saldato ? imp : '',
      cassa,
      JSON.stringify(m),
    ]);
  });
  matrix.push(['', '', '', '', '', '', '']);
  matrix.push(['', 'TOTALI', totUscite, totEntrate, totDaDare, cassa, '']);

  var nCol = headers.length;
  var nRows = matrix.length;
  assicuraRighe_(sheet, nRows);
  sheet.getRange(1, 1, nRows, nCol).setValues(matrix);
  sheet.getRange(1, 1, 1, nCol).setFontWeight('bold');
  if (nRows > 1) {
    sheet.getRange(2, 1, nRows - 1, 1).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(2, 3, nRows - 1, 4).setNumberFormat('#,##0.00" €"');
  }
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidths(3, 4, 100);
  sheet.hideColumns(nCol); // nascondi dato_json

  // riepilogo + grafico Entrate vs Uscite (colonne I/J, oltre la tabella)
  try {
    sheet.getRange('I1').setValue('Voce');
    sheet.getRange('J1').setValue('Somma (€)');
    sheet.getRange('I2').setValue('Entrate');
    sheet.getRange('J2').setValue(totEntrate);
    sheet.getRange('I3').setValue('Uscite');
    sheet.getRange('J3').setValue(totUscite);
    sheet.getRange('J2:J3').setNumberFormat('#,##0.00" €"');
    var chart = sheet.newChart().asColumnChart()
      .addRange(sheet.getRange('I1:J3')).setNumHeaders(1)
      .setPosition(2, 9, 0, 0)
      .setOption('title', 'Entrate vs Uscite')
      .setOption('legend', { position: 'none' })
      .build();
    sheet.insertChart(chart);
  } catch (errChart) {
    console.error('Grafico non inserito: ' + errChart);
  }
}

/** "YYYY-MM-DD" → Date al mezzogiorno locale (giorno stabile in ogni fuso). */
function toDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return new Date(iso);
}

// ===== calendario ICS (abbonamento da Google/Apple Calendar) =====
//
// GET .../exec?action=ics&secret=CHIAVE&season=2026/27  → file iCalendar con
// partite, allenamenti e appuntamenti della stagione (senza season usa
// l'attiva). Il link contiene la chiave: va condiviso solo in società.
// Nota: le date/ore locali sono formattate su Europe/Rome; imposta anche il
// fuso del progetto Apps Script su Europe/Rome (Impostazioni progetto).

function icsCalendar(season) {
  var s = season || readSeasons().attiva || '';
  var eventi = [];
  listItems('partite', s).forEach(function (p) {
    var giocata = p.giocata !== false;
    eventi.push({
      id: 'p-' + p.id, data: p.data, ora: p.ora, durata: 105,
      titolo: (giocata ? 'Riolunato ' + (p.golFatti != null ? p.golFatti : 0) + '-' + (p.golSubiti != null ? p.golSubiti : 0) + ' ' : 'Partita vs ') +
        (p.avversario || '') + (p.inCasa ? ' (casa)' : ' (trasferta)'),
    });
  });
  listItems('allenamenti', s).forEach(function (a) {
    eventi.push({ id: 'a-' + a.id, data: a.data, durata: 90, titolo: 'Allenamento', descrizione: a.note });
  });
  listItems('appuntamenti', s).forEach(function (ap) {
    eventi.push({
      id: 'ap-' + ap.id, data: ap.data, ora: ap.ora, durata: 105,
      titolo: 'Partita vs ' + (ap.avversario || '') + (ap.inCasa ? ' (casa)' : ' (trasferta)'),
      luogo: ap.luogo,
    });
  });

  var r = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//US Riolunato//Gestionale//IT', 'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:' + icsEscape_('U.S. Riolunato ' + s), 'X-WR-TIMEZONE:Europe/Rome',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Rome',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
    'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");

  eventi.forEach(function (e) {
    if (!e.data) return;
    r.push('BEGIN:VEVENT');
    r.push('UID:' + e.id + '@usriolunato');
    r.push('DTSTAMP:' + stamp);
    if (e.ora) {
      var hm = String(e.ora).split(':');
      var inizio = new Date(
        Number(e.data.slice(0, 4)), Number(e.data.slice(5, 7)) - 1, Number(e.data.slice(8, 10)),
        Number(hm[0]) || 0, Number(hm[1]) || 0,
      );
      var fine = new Date(inizio.getTime() + (e.durata || 90) * 60000);
      r.push('DTSTART;TZID=Europe/Rome:' + fmtLocale_(inizio));
      r.push('DTEND;TZID=Europe/Rome:' + fmtLocale_(fine));
    } else {
      // senza orario: evento di tutto il giorno
      var giorno = String(e.data).replace(/-/g, '');
      var dopo = new Date(
        Number(e.data.slice(0, 4)), Number(e.data.slice(5, 7)) - 1, Number(e.data.slice(8, 10)) + 1, 12,
      );
      r.push('DTSTART;VALUE=DATE:' + giorno);
      r.push('DTEND;VALUE=DATE:' + Utilities.formatDate(dopo, 'Europe/Rome', 'yyyyMMdd'));
    }
    r.push('SUMMARY:' + icsEscape_(e.titolo));
    if (e.luogo) r.push('LOCATION:' + icsEscape_(e.luogo));
    if (e.descrizione) r.push('DESCRIPTION:' + icsEscape_(e.descrizione));
    r.push('END:VEVENT');
  });

  r.push('END:VCALENDAR');
  return ContentService.createTextOutput(r.join('\r\n')).setMimeType(ContentService.MimeType.ICAL);
}

function fmtLocale_(d) {
  return Utilities.formatDate(d, 'Europe/Rome', "yyyyMMdd'T'HHmmss");
}

function icsEscape_(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ===== creazione della struttura di una stagione =====

/**
 * Crea (solo se mancano) tutti i pezzi di una stagione: la cartella con i
 * quattro fogli e "Documenti", più la scheda della stagione in Bilancio e
 * Magazzino. Da chiamare solo sotto lock. Non tocca mai dati esistenti.
 */
function creaStruttura_(season) {
  var sezioni = ['giocatori', 'allenamenti', 'partite', 'distinte', 'magazzino', 'conti'];
  sezioni.forEach(function (c) {
    if (!findSheet_(c, season)) rebuildSheet_(c, season, []); // solo intestazioni
  });
  var seasonFolder = ensureChildFolder_(parentFolder_(), seasonKey_(season));
  ensureChildFolder_(seasonFolder, DOCUMENTI_FOLDER);
}

// ===== elenco stagioni: foglio "Stagioni" nella cartella madre =====

/** Foglio Stagioni esistente o creato (solo in scrittura, sotto lock). */
function ensureSeasonsSheet_() {
  var ss = findSpreadsheetIn_(parentFolder_(), SEASONS_SHEET_NAME);
  if (ss) return ss.getSheets()[0];
  ss = SpreadsheetApp.create(SEASONS_SHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(parentFolder_());
  var sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, 2).setValues([['Stagione', 'Attiva']]);
  return sh;
}

function isFlag(v) {
  var s = String(v).trim().toLowerCase();
  return s === 'x' || s === 'true' || s === 'vero' || s === 'si' || s === 'sì' || s === '1' || s === '✓';
}

function readSeasons() {
  var ss = findSpreadsheetIn_(parentFolder_(), SEASONS_SHEET_NAME);
  if (!ss) return { ok: true, stagioni: [], attiva: '' }; // la lettura non crea nulla
  var values = ss.getSheets()[0].getDataRange().getValues();
  var stagioni = [], attiva = '';
  for (var i = 1; i < values.length; i++) {
    var nome = String(values[i][0]).trim();
    if (!nome) continue;
    stagioni.push(nome);
    if (!attiva && isFlag(values[i][1])) attiva = nome;
  }
  if (!attiva && stagioni.length) attiva = stagioni[0];
  return { ok: true, stagioni: stagioni, attiva: attiva };
}

function writeSeasons(stagioni, attiva) {
  return withLock_(function () {
    var sh = ensureSeasonsSheet_();
    sh.clear();
    var rows = [['Stagione', 'Attiva']];
    (stagioni || []).forEach(function (s) { rows.push([s, s === attiva ? 'x' : '']); });
    sh.getRange(1, 1, rows.length, 2).setValues(rows);
    // la struttura sul Drive nasce QUI: cartella + fogli di ogni stagione
    (stagioni || []).forEach(creaStruttura_);
    return { ok: true, stagioni: stagioni || [], attiva: attiva || '' };
  });
}

/** Le due cartelle dell'archivio, per nome logico usato dall'app. */
function archivioFolderId_(cartella) {
  if (cartella === 'foto') return ARCHIVIO_FOTO_ID;
  if (cartella === 'documenti') return ARCHIVIO_DOCUMENTI_ID;
  throw new Error('cartella archivio sconosciuta: ' + cartella);
}

/**
 * Il file, SOLO se sta in una delle due cartelle dell'archivio: così le
 * azioni di lettura/cancellazione non possono toccare nient'altro sul Drive.
 */
function archivioFileById_(id) {
  var file = DriveApp.getFileById(String(id));
  var ammesse = [ARCHIVIO_DOCUMENTI_ID, ARCHIVIO_FOTO_ID];
  var genitori = file.getParents();
  while (genitori.hasNext()) {
    if (ammesse.indexOf(genitori.next().getId()) >= 0) return file;
  }
  throw new Error('file fuori dall\'archivio tesserati');
}

/**
 * Miniature (per gli avatar della rosa): l'anteprima che il Drive tiene
 * già pronta, poche decine di kB l'una. Se per un file non esiste, si
 * salta e l'app mostra le iniziali.
 */
function archivioThumbs(ids) {
  var out = [];
  (ids || []).forEach(function (id) {
    try {
      var blob = archivioFileById_(id).getThumbnail();
      if (!blob) return;
      out.push({
        id: String(id),
        tipo: blob.getContentType() || 'image/png',
        dataBase64: Utilities.base64Encode(blob.getBytes()),
      });
    } catch (e) { /* file sparito o senza miniatura: lo si ignora */ }
  });
  return out;
}

/** Quanto può pesare un file servito all'app (oltre, si apre sul Drive). */
var ARCHIVIO_MAX_BYTE = 9 * 1024 * 1024;

/** Il contenuto di un file dell'archivio, per l'anteprima e il download. */
function archivioFile(id) {
  var file = archivioFileById_(id);
  if (file.getSize() > ARCHIVIO_MAX_BYTE) {
    return { ok: false, error: 'file troppo grande per l\'anteprima', troppoGrande: true, url: file.getUrl() };
  }
  var blob = file.getBlob();
  return {
    ok: true,
    nome: file.getName(),
    tipo: blob.getContentType() || file.getMimeType(),
    dataBase64: Utilities.base64Encode(blob.getBytes()),
  };
}

/** Nome confrontabile: senza estensione, senza maiuscole e separatori. */
function archivioChiaveNome_(nome) {
  return String(nome).replace(/\.[A-Za-z0-9]{1,5}$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Carica un file nell'archivio. Se ce n'è già uno con lo stesso nome
 * (estensione a parte) finisce nel cestino: si tiene una copia sola,
 * come chiesto. Il cestino resta comunque una rete di sicurezza.
 */
function archivioUpload(cartella, nome, tipo, dataBase64) {
  return withLock_(function () {
    var folder = DriveApp.getFolderById(archivioFolderId_(cartella));
    var nomePulito = String(nome || '').trim();
    if (!nomePulito) throw new Error('nome file mancante');
    var chiave = archivioChiaveNome_(nomePulito);
    var esistenti = folder.getFiles();
    while (esistenti.hasNext()) {
      var vecchio = esistenti.next();
      if (archivioChiaveNome_(vecchio.getName()) === chiave) vecchio.setTrashed(true);
    }
    var blob = Utilities.newBlob(
      Utilities.base64Decode(dataBase64),
      tipo || 'application/octet-stream',
      nomePulito,
    );
    var file = folder.createFile(blob);
    return {
      id: file.getId(),
      nome: file.getName(),
      tipo: file.getMimeType(),
      dimensione: file.getSize(),
      caricatoIl: Utilities.formatDate(file.getDateCreated(), 'Europe/Rome', 'yyyy-MM-dd'),
      url: file.getUrl(),
    };
  });
}

/** Cestina un file dell'archivio (l'app lo chiede con una conferma). */
function archivioDelete(id) {
  return withLock_(function () {
    archivioFileById_(id).setTrashed(true);
    return String(id);
  });
}

function cacheChiave_(collection, season) {
  return 'lista/' + seasonKey_(season) + '/' + collection;
}

function cacheLeggi_(chiave) {
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get(chiave + '#n'));
    if (!n) return null;
    var chiavi = [];
    for (var i = 0; i < n; i++) chiavi.push(chiave + '#' + i);
    var pezzi = c.getAll(chiavi);
    var testo = '';
    for (var j = 0; j < n; j++) {
      var p = pezzi[chiave + '#' + j];
      if (p == null) return null; // un pezzo è scaduto: si rilegge dal foglio
      testo += p;
    }
    return JSON.parse(testo);
  } catch (err) {
    return null;
  }
}

function cacheScrivi_(chiave, items) {
  try {
    var testo = JSON.stringify(items);
    if (testo.length > 20 * CACHE_PEZZO) return; // troppo grosso: si legge dal foglio
    var mappa = {};
    var n = 0;
    for (var i = 0; i < testo.length; i += CACHE_PEZZO) {
      mappa[chiave + '#' + n++] = testo.substring(i, i + CACHE_PEZZO);
    }
    mappa[chiave + '#n'] = String(n);
    CacheService.getScriptCache().putAll(mappa, CACHE_SECONDI);
  } catch (err) {
    /* memoria piena o non disponibile: pazienza, si legge dal foglio */
  }
}

/** Butta via la copia in memoria di una sezione (dopo ogni salvataggio). */
function cacheDimentica_(collection, season) {
  try {
    // basta togliere il contatore: senza quello la lettura torna al foglio
    CacheService.getScriptCache().remove(cacheChiave_(collection, season) + '#n');
  } catch (err) {}
}

// ===== trovare i file senza scorrere le cartelle =====

function serviziVeloci_() {
  return typeof Drive !== 'undefined' && typeof Sheets !== 'undefined';
}

/** Un file (o una cartella) per nome dentro un genitore: una domanda sola. */
function cercaPerNome_(parentId, nome, mimeType) {
  var res = Drive.Files.list({
    q:
      "'" + parentId + "' in parents and trashed = false and mimeType = '" + mimeType +
      "' and name = '" + String(nome).replace(/'/g, "\\'") + "'",
    fields: 'files(id)',
    pageSize: 1,
  });
  return res.files && res.files.length ? res.files[0].id : null;
}

var MIME_FOGLIO = 'application/vnd.google-apps.spreadsheet';
var MIME_CARTELLA = 'application/vnd.google-apps.folder';

/** L'id del foglio di una sezione; una volta trovato resta in memoria 6 ore. */
function fileIdSezione_(collection, season) {
  var key = seasonKey_(season);
  var chiave = 'file/' + key + '/' + collection;
  try {
    var salvato = CacheService.getScriptCache().get(chiave);
    if (salvato) return salvato;
  } catch (err) {}

  var id = null;
  if (FILE_RADICE[collection]) {
    id = cercaPerNome_(PARENT_FOLDER_ID, FILE_RADICE[collection], MIME_FOGLIO);
  } else {
    var cartella = cercaPerNome_(PARENT_FOLDER_ID, key, MIME_CARTELLA);
    if (cartella) id = cercaPerNome_(cartella, FILE_STAGIONE[collection] || nomeFile_(collection), MIME_FOGLIO);
  }
  if (id) {
    try { CacheService.getScriptCache().put(chiave, id, CACHE_FILE_SECONDI); } catch (err) {}
  }
  return id;
}

function dimenticaFileId_(collection, season) {
  try {
    CacheService.getScriptCache().remove('file/' + seasonKey_(season) + '/' + collection);
  } catch (err) {}
}

// ===== lettura (sostituisce la listItems attuale) =====

/** Dalle righe del foglio ai record: la colonna nascosta dato_json. */
function recordDaRighe_(values) {
  if (!values || values.length < 2) return [];
  var idx = values[0].indexOf(DATO_COL);
  if (idx < 0) return [];
  var items = [];
  for (var i = 1; i < values.length; i++) {
    var raw = values[i][idx];
    if (raw === '' || raw === null || raw === undefined) continue; // salta TOTALI/righe vuote
    try { items.push(JSON.parse(String(raw))); } catch (err) {}
  }
  return items;
}

/** Lettura con l'API Fogli: il foglio non viene aperto, si chiedono i valori. */
function listConApi_(collection, season) {
  var id = fileIdSezione_(collection, season);
  if (!id) return [];
  // in Bilancio e Magazzino ogni stagione è una scheda; negli altri file la
  // scheda è una sola e il nome si può omettere
  var range = FILE_RADICE[collection] ? "'" + seasonKey_(season) + "'!A1:ZZ" : 'A1:ZZ';
  var res = Sheets.Spreadsheets.Values.get(id, range);
  return recordDaRighe_(res.values);
}

/** Lettura di prima: apre il foglio con SpreadsheetApp (ripiego). */
function listDalFoglio_(collection, season) {
  var sheet = findSheet_(collection, season);
  if (!sheet) return [];
  return recordDaRighe_(sheet.getDataRange().getValues());
}

function listItems(collection, season) {
  if (collection === 'documenti') return listDocumenti(season);

  var chiave = cacheChiave_(collection, season);
  var pronti = cacheLeggi_(chiave);
  if (pronti) return pronti;

  var items = null;
  if (serviziVeloci_()) {
    try {
      items = listConApi_(collection, season);
    } catch (err) {
      // id vecchio (file spostato o rinominato), scheda che non c'è ancora,
      // servizio non disponibile: si riprova alla maniera di prima
      dimenticaFileId_(collection, season);
      items = null;
    }
  }
  if (items === null) items = listDalFoglio_(collection, season);

  cacheScrivi_(chiave, items);
  return items;
}

/**
 * Tutti gli elenchi in una richiesta sola (azione 'listAll').
 *
 * `richieste` è [{ collection, season }, …]. Una sezione che dà errore viene
 * SALTATA (non torna vuota): l'app così tiene la copia che ha invece di
 * ritrovarsi la sezione svuotata, e le altre arrivano lo stesso.
 */
function listAllItems(richieste) {
  var out = [];
  (richieste || []).forEach(function (r) {
    try {
      out.push({ collection: r.collection, items: listItems(r.collection, r.season) });
    } catch (err) {
      console.error('listAll ' + r.collection + ': ' + err);
    }
  });
  return out;
}

// ===== scrittura (sostituisce la rebuildSheet_ attuale) =====
//
// Unico punto da cui passano tutti i salvataggi (put, putAll, delete): qui
// la copia in memoria viene buttata via, così la lettura dopo è fresca.

function rebuildSheet_(collection, season, records) {
  var sheet = ensureSheet_(collection, season); // sempre chiamata sotto lock
  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });
  sheet.clear();
  if (collection === 'conti') buildConti_(sheet, records);
  else buildGenerico_(collection, sheet, records);
  cacheDimentica_(collection, season);
}

// ===== elenchi di file: una chiamata per cartella, non una per file =====

/** I file di una cartella con tutti i dati che servono, in un colpo solo. */
function elencoFile_(folderId) {
  var items = [];
  var token = null;
  do {
    var res = Drive.Files.list({
      q: "'" + folderId + "' in parents and trashed = false",
      fields: 'nextPageToken, files(id,name,mimeType,size,createdTime,webViewLink)',
      pageSize: 200,
      pageToken: token,
    });
    (res.files || []).forEach(function (f) {
      items.push({
        id: f.id,
        nome: f.name,
        tipo: f.mimeType,
        dimensione: Number(f.size || 0),
        caricatoIl: String(f.createdTime || '').slice(0, 10),
        url: f.webViewLink || '',
      });
    });
    token = res.nextPageToken;
  } while (token);
  return items;
}

/** Come prima, file per file: ripiego senza il servizio avanzato. */
function elencoFileLento_(folder) {
  var files = folder.getFiles();
  var items = [];
  while (files.hasNext()) items.push(docMeta_(files.next()));
  return items;
}

function listDocumenti(season) {
  var key = seasonKey_(season);
  if (serviziVeloci_()) {
    try {
      var cartellaStagione = cercaPerNome_(PARENT_FOLDER_ID, key, MIME_CARTELLA);
      if (!cartellaStagione) return [];
      var cartellaDoc = cercaPerNome_(cartellaStagione, DOCUMENTI_FOLDER, MIME_CARTELLA);
      return cartellaDoc ? elencoFile_(cartellaDoc) : [];
    } catch (err) {
      /* si riprova alla maniera di prima */
    }
  }
  var seasonFolder = findChildFolder_(parentFolder_(), key);
  if (!seasonFolder) return [];
  var docFolder = findChildFolder_(seasonFolder, DOCUMENTI_FOLDER);
  return docFolder ? elencoFileLento_(docFolder) : [];
}

// ===== archivio tesserati (sostituisce la archivioList attuale) =====

function archivioList(cartella) {
  var id = archivioFolderId_(cartella);
  if (typeof Drive !== 'undefined') {
    try {
      return elencoFile_(id);
    } catch (err) {
      /* si riprova alla maniera di prima */
    }
  }
  return elencoFileLento_(DriveApp.getFolderById(id));
}

// Esegui UNA VOLTA a mano: autorizza (Drive + Fogli) e costruisce la
// struttura per tutte le stagioni già presenti nel foglio Stagioni.
function autorizza() {
  DriveApp.getRootFolder().getName();
  var s = readSeasons();
  withLock_(function () {
    ensureSeasonsSheet_();
    (s.stagioni || []).forEach(creaStruttura_);
  });
}

// ===== MANAGEMENT: dispositivi, sessioni amministratore e registro =====
// Impostare ADMIN_PASSWORD (almeno 12 caratteri) nelle Proprietà script.
// Il file Management resta nel Drive privato del proprietario, fuori dalle
// cartelle della società, per non ereditare eventuali condivisioni.
var MGMT_MUTATIONS = ['put', 'putAll', 'delete', 'upload', 'createDoc', 'renameDoc', 'uploadGrafica', 'setSeasons', 'archivioUpload', 'archivioDelete'];
var mgmtLockHeld_ = false;

function mgmtDigest_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8));
}
function mgmtEqual_(a, b) {
  a = mgmtDigest_(a); b = mgmtDigest_(b);
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function mgmtProps_() { return PropertiesService.getScriptProperties(); }
function mgmtPassword_() { return mgmtProps_().getProperty('ADMIN_PASSWORD') || ''; }
function mgmtFile_(create) {
  var id = mgmtProps_().getProperty('MANAGEMENT_FILE_ID');
  if (id) return SpreadsheetApp.openById(id);
  if (!create) return null;
  var ss = SpreadsheetApp.create('Management - U.S. Riolunato');
  // Non chiamare condividiViaLink_ e non spostare in cartelle condivise.
  mgmtProps_().setProperty('MANAGEMENT_FILE_ID', ss.getId());
  var devices = ss.getSheets()[0]; devices.setName('Dispositivi');
  devices.appendRow(['id', 'dato_json']); devices.setFrozenRows(1);
  var log = ss.insertSheet('Attivita'); log.appendRow(['id_richiesta', 'dato_json']); log.setFrozenRows(1);
  return ss;
}
function mgmtSheet_(name, create) {
  var ss = mgmtFile_(create);
  if (!ss) return null;
  var sheet = ss.getSheetByName(name);
  if (!sheet && create) sheet = ss.insertSheet(name);
  if (sheet && create && sheet.getLastRow() === 0) {
    sheet.appendRow([name === 'Dispositivi' ? 'id' : 'id_richiesta', 'dato_json']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function mgmtRow_(sheet, id) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
  return found ? found.getRow() : 0;
}
function mgmtRead_(sheet, row) {
  return row ? JSON.parse(sheet.getRange(row, 2).getValue()) : null;
}
function mgmtWrite_(sheet, row, id, data) {
  var target = row || sheet.getLastRow() + 1;
  if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(500, target - sheet.getMaxRows()));
  sheet.getRange(target, 1, 1, 2).setValues([[id, JSON.stringify(data)]]);
}
function mgmtDeviceId_(p) {
  var id = String(p.device && p.device.id || '');
  return /^[a-f0-9-]{36}$/i.test(id) ? id : 'legacy';
}
function mgmtTouch_(p) {
  var id = mgmtDeviceId_(p);
  if (id === 'legacy') return;
  var cacheKey = 'mgmt-device-' + id;
  if (CacheService.getScriptCache().get(cacheKey)) return;
  withLock_(function () {
    var sheet = mgmtSheet_('Dispositivi', true), row = mgmtRow_(sheet, id);
    var now = new Date().toISOString();
    var d = mgmtRead_(sheet, row) || { id: id, nome: '', primoAccesso: now };
    d.ultimoAccesso = now;
    d.browser = String(p.device.browser || 'Altro browser').slice(0, 40);
    d.sistema = String(p.device.sistema || 'Altro sistema').slice(0, 40);
    mgmtWrite_(sheet, row, id, d);
  });
  CacheService.getScriptCache().put(cacheKey, '1', 300);
}
function mgmtSession_(p) {
  var token = String(p.adminToken || ''), password = mgmtPassword_();
  if (!/^[a-f0-9-]{72}$/i.test(token) || password.length < 12) return false;
  var deviceId = mgmtDeviceId_(p);
  if (deviceId === 'legacy') return false;
  var raw = mgmtProps_().getProperty('MANAGEMENT_SESSION_' + deviceId);
  if (!raw) return false;
  var data = JSON.parse(raw);
  return data.tokenHash === mgmtDigest_(token) && data.passwordHash === mgmtDigest_(password);
}
function mgmtLogin_(p) {
  return withLock_(function () {
    var deviceId = mgmtDeviceId_(p);
    if (deviceId === 'legacy') return json({ ok: false, error: 'Aggiorna il frontend per identificare questo browser.' });
    var password = mgmtPassword_();
    if (password.length < 12) return json({ ok: false, error: 'Configura ADMIN_PASSWORD nelle Proprietà script (almeno 12 caratteri).' });
    var props = mgmtProps_(), attempts = JSON.parse(props.getProperty('MANAGEMENT_LOGIN_ATTEMPTS') || '{}');
    var now = Date.now();
    if (attempts.until > now) return json({ ok: false, error: 'Troppi tentativi. Riprova tra cinque minuti.' });
    if (!mgmtEqual_(String(p.password || ''), password)) {
      if (!attempts.start || now - attempts.start > 300000) attempts = { start: now, count: 0 };
      attempts.count++;
      if (attempts.count >= 5) attempts.until = now + 300000;
      props.setProperty('MANAGEMENT_LOGIN_ATTEMPTS', JSON.stringify(attempts));
      return json({ ok: false, error: 'Password amministratore errata.' });
    }
    props.deleteProperty('MANAGEMENT_LOGIN_ATTEMPTS');
    var token = Utilities.getUuid() + Utilities.getUuid();
    // Un solo token attivo per browser; conserva soltanto impronte, senza scadenza.
    props.setProperty('MANAGEMENT_SESSION_' + deviceId, JSON.stringify({ tokenHash: mgmtDigest_(token), passwordHash: mgmtDigest_(password) }));
    mgmtSimpleEvent_(p, 'Accesso Management', 'management', 'riuscita');
    return json({ ok: true, token: token, persistent: true });
  });
}
function mgmtSimpleEvent_(p, action, section, status) {
  var sheet = mgmtSheet_('Attivita', true);
  var id = /^[a-f0-9-]{36}$/i.test(String(p.requestId || '')) ? p.requestId : Utilities.getUuid();
  if (mgmtRow_(sheet, id)) return;
  mgmtWrite_(sheet, 0, id, { activity: { id: id, deviceId: mgmtDeviceId_(p), data: new Date().toISOString(), azione: action, sezione: section, stagione: '', elemento: '', esito: status, dettagli: [] } });
}
function mgmtDevices_() {
  var sheet = mgmtSheet_('Dispositivi', false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(function (r) { return JSON.parse(r[0]); }).sort(function (a, b) { return b.ultimoAccesso.localeCompare(a.ultimoAccesso); });
}
function mgmtActivities_(filters) {
  var f = filters || {}, sheet = mgmtSheet_('Attivita', false), result = [], total = 0;
  var offset = Math.max(0, Math.min(10000000, Math.floor(Number(f.offset) || 0)));
  var query = String(f.ricerca || '').slice(0, 100).toLowerCase();
  var season = String(f.stagione || '').replace(/\//g, '-');
  // Senza filtri basta leggere la pagina, anche con un registro molto lungo.
  if (sheet && !f.deviceId && !f.esito && !f.sezione && !season && !f.dal && !f.al && !query) {
    total = Math.max(0, sheet.getLastRow() - 1);
    var last = sheet.getLastRow() - offset;
    if (last < 2) return { ok: true, activities: [], total: total };
    var first = Math.max(2, last - 24);
    result = sheet.getRange(first, 2, last - first + 1, 1).getValues().reverse().map(function (r) { return JSON.parse(r[0]).activity; });
    return { ok: true, activities: result, total: total };
  }
  // Legge a blocchi: la risposta contiene solo la pagina richiesta.
  for (var end = sheet ? sheet.getLastRow() : 1; end >= 2; end -= 500) {
    var start = Math.max(2, end - 499);
    var rows = sheet.getRange(start, 2, end - start + 1, 1).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {
      var a = JSON.parse(rows[i][0]).activity;
      var day = Utilities.formatDate(new Date(a.data), 'Europe/Rome', 'yyyy-MM-dd');
      if (f.deviceId && a.deviceId !== f.deviceId || f.esito && a.esito !== f.esito || f.sezione && a.sezione !== f.sezione || season && a.stagione !== season || f.dal && day < f.dal || f.al && day > f.al) continue;
      if (query && (a.azione + ' ' + a.elemento + ' ' + a.sezione).toLowerCase().indexOf(query) < 0) continue;
      if (total >= offset && result.length < 25) result.push(a);
      total++;
    }
  }
  return { ok: true, activities: result, total: total };
}
function mgmtRename_(p) {
  return withLock_(function () {
    var id = String(p.id || ''), name = String(p.nome || '').trim();
    if (!/^[a-f0-9-]{36}$/i.test(id) || name.length > 80) throw new Error('Nome o dispositivo non valido');
    var sheet = mgmtSheet_('Dispositivi', false), row = mgmtRow_(sheet, id);
    if (!row) throw new Error('Dispositivo non trovato');
    var device = mgmtRead_(sheet, row), oldName = device.nome;
    device.nome = name;
    mgmtWrite_(sheet, row, id, device);
    mgmtSimpleEvent_(p, 'Rinomina dispositivo', 'management', 'riuscita');
    var log = mgmtSheet_('Attivita', true), logRow = mgmtRow_(log, p.requestId);
    if (logRow) {
      var entry = mgmtRead_(log, logRow);
      entry.activity.elemento = id;
      entry.activity.dettagli = [{ campo: 'Nome dispositivo', prima: oldName, dopo: name }];
      mgmtWrite_(log, logRow, p.requestId, entry);
    }
    return json({ ok: true, device: device });
  });
}
function mgmtValue_(key, value) {
  // Non duplica nel registro credenziali, dati medici, documenti o allegati.
  if (/password|secret|token|documento|tessera|nascita|certificat|infortun|dataurl|base64|foto|allegat|ricevut|indirizzo|telefono|email/i.test(key)) return '[dato riservato]';
  if (value == null) return '';
  if (Array.isArray(value)) return value.length + ' elementi';
  if (typeof value === 'object') return '[dati strutturati modificati]';
  return String(value).slice(0, 240);
}
function mgmtDiff_(before, after) {
  before = before || {}; after = after || {};
  var keys = Object.keys(before).concat(Object.keys(after)), seen = {}, diff = [];
  keys.forEach(function (key) {
    if (seen[key] || key === 'id' || key === TESSERE_CAMPO) return; seen[key] = true;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
    if (diff.length < 30) diff.push({ campo: key, prima: mgmtValue_(key, before[key]), dopo: mgmtValue_(key, after[key]) });
  });
  if (keys.length > 30 && diff.length === 30) diff.push({ campo: 'Altri campi', prima: '', dopo: 'Dettagli limitati a 30 campi' });
  return diff;
}
function mgmtSnapshot_(p) {
  var a = { id: p.requestId, deviceId: mgmtDeviceId_(p), data: new Date().toISOString(), azione: '', sezione: String(p.collection || ''), stagione: String(p.season || ''), elemento: '', esito: 'in_corso', dettagli: [] };
  var labels = { put: 'Modifica', putAll: 'Importazione / sostituzione', delete: 'Eliminazione', upload: 'Caricamento documento', createDoc: 'Creazione documento', renameDoc: 'Rinomina documento', uploadGrafica: 'Caricamento grafica', setSeasons: 'Aggiornamento stagioni', archivioUpload: 'Caricamento archivio', archivioDelete: 'Eliminazione archivio' };
  a.azione = labels[p.action] || p.action;
  a.elemento = String(p.nome || p.id || p.record && (p.record.descrizione || p.record.nome || p.record.avversario || p.record.id) || '').slice(0, 160);
  if (p.action === 'put' || p.action === 'delete') {
    if (p.collection !== 'documenti') {
      var id = p.record ? p.record.id : p.id;
      // Lettura fresca sotto lo stesso lock della scrittura, senza cache.
      var items = listDalFoglio_(p.collection, p.season);
      cacheScrivi_(cacheChiave_(p.collection, p.season), items);
      var before = items.filter(function (r) { return r.id === id; })[0];
      var label = p.record || before;
      if (label) a.elemento = String(label.descrizione || (label.nome ? label.nome + (label.cognome ? ' ' + label.cognome : '') : '') || label.avversario || label.id || '').slice(0, 160);
      if (p.action === 'put') a.azione = before ? 'Modifica' : 'Creazione';
      a.dettagli = mgmtDiff_(before, p.action === 'delete' ? null : p.record);
    } else if (p.action === 'delete') a.elemento = DriveApp.getFileById(p.id).getName();
  } else if (p.action === 'putAll') {
    a.dettagli = [{ campo: 'Record nella raccolta', prima: String(listDalFoglio_(p.collection, p.season).length), dopo: String((p.records || []).length) }];
  } else if (p.action === 'setSeasons') {
    a.sezione = 'stagioni';
    var configBefore = readSeasons();
    a.dettagli = [
      { campo: 'Stagioni', prima: (configBefore.stagioni || []).join(', ').slice(0, 240), dopo: (p.stagioni || []).join(', ').slice(0, 240) },
      { campo: 'Stagione attiva', prima: String(configBefore.attiva || ''), dopo: String(p.attiva || '') }
    ];
  } else {
    a.sezione = p.action.indexOf('archivio') === 0 ? 'archivio' : p.action === 'uploadGrafica' ? 'grafica' : 'documenti';
    if (p.action === 'archivioDelete') a.elemento = archivioFileById_(p.id).getName();
    if (p.action === 'renameDoc') {
      a.dettagli = [{ campo: 'Nome', prima: DriveApp.getFileById(p.id).getName(), dopo: String(p.nome || '').slice(0, 240) }];
    }
  }
  return a;
}
function mgmtMutation_(p) {
  return withLock_(function () {
    var sheet = mgmtSheet_('Attivita', true);
    p.requestId = /^[a-f0-9-]{36}$/i.test(String(p.requestId || '')) ? p.requestId : Utilities.getUuid();
    var row = mgmtRow_(sheet, p.requestId), previous = mgmtRead_(sheet, row);
    if (!previous) previous = mgmtRead_(mgmtSheet_('Ricevute', false), mgmtRow_(mgmtSheet_('Ricevute', false), p.requestId));
    var signature = mgmtDigest_(JSON.stringify([p.action, p.collection, p.season, p.id, p.record, p.records, p.nome, p.tipo, p.stagioni, p.attiva, p.cartella, p.dataBase64]));
    if (previous) {
      if (previous.signature !== signature || previous.activity.deviceId !== mgmtDeviceId_(p)) throw new Error('Identificativo richiesta già utilizzato');
      if (previous.activity.esito === 'riuscita') return json(previous.response);
      if (previous.activity.esito === 'in_corso') throw new Error('Esito precedente da verificare nel Management prima di ripetere l’operazione');
    }
    var activity;
    try { activity = mgmtSnapshot_(p); }
    catch (err) {
      activity = { id: p.requestId, deviceId: mgmtDeviceId_(p), data: new Date().toISOString(), azione: String(p.action), sezione: String(p.collection || 'documenti'), stagione: String(p.season || ''), elemento: String(p.id || '').slice(0, 160), esito: 'fallita', dettagli: [], errore: 'Operazione non avviata: impossibile leggere i dati necessari.' };
      mgmtWrite_(sheet, row, p.requestId, { signature: signature, activity: activity });
      return json({ ok: false, error: String(err) });
    }
    activity.tentativi = previous ? (previous.activity.tentativi || 1) + 1 : 1;
    row = row || sheet.getLastRow() + 1;
    var entry = { signature: signature, activity: activity };
    mgmtWrite_(sheet, row, p.requestId, entry);
    SpreadsheetApp.flush(); // registra l'intenzione prima di toccare i dati
    var response;
    try { response = JSON.parse(routeOriginal_(p).getContent()); }
    catch (err) { response = { ok: false, error: 'Operazione non confermata dallo script' }; }
    activity.esito = response.ok ? 'riuscita' : 'fallita';
    if (!response.ok) activity.errore = 'Operazione non completata. Consultare il messaggio restituito dall’app; per operazioni sui file verificare anche il Drive.';
    // Le risposte delle scritture sono metadati, mai contenuti dei file.
    // Non archivia record personali completi restituiti da put.
    entry.response = p.action === 'put' ? { ok: response.ok } : response;
    mgmtWrite_(sheet, row, p.requestId, entry);
    SpreadsheetApp.flush();
    return json(response);
  });
}
function route(p) {
  try {
    p = p || {};
    if (!SECRET || !secretOk_(p.secret)) { Utilities.sleep(1000); return json({ ok: false, error: 'non autorizzato' }); }
    // Il registro non è mai accessibile attraverso gli endpoint normali,
    // nemmeno conoscendo l'id del suo file.
    var managementFile = mgmtProps_().getProperty('MANAGEMENT_FILE_ID');
    if (managementFile && String(p.id || '') === managementFile || /^(management|attivita|dispositivi|__)/i.test(String(p.collection || ''))) throw new Error('Operazione riservata');
    if (p.action === 'setSeasons' && !mgmtSession_(p)) return json({ ok: false, code: 'ADMIN_AUTH', error: 'Solo gli amministratori possono gestire le stagioni.' });
    if (p.action === 'managementLogin') { mgmtTouch_(p); return mgmtLogin_(p); }
    if (String(p.action || '').indexOf('management') === 0) {
      if (!mgmtSession_(p)) return json({ ok: false, code: 'ADMIN_AUTH', error: 'Accesso Management revocato. Ripeti l’accesso dal logo.' });
      if (p.action === 'managementLogout') {
        return withLock_(function () {
          // Un logout in ritardo non deve revocare un accesso più recente.
          if (mgmtSession_(p)) mgmtProps_().deleteProperty('MANAGEMENT_SESSION_' + mgmtDeviceId_(p));
          return json({ ok: true });
        });
      }
      if (p.action === 'managementSession') return json({ ok: true, persistent: true });
      if (p.action === 'managementDevices') return json({ ok: true, devices: mgmtDevices_() });
      if (p.action === 'managementActivities') return json(mgmtActivities_(p.filters));
      if (p.action === 'managementClearActivities') return withLock_(function () {
        if (p.conferma !== 'ELIMINA LOG') throw new Error('Conferma richiesta');
        var sheet = mgmtSheet_('Attivita', false);
        if (sheet && sheet.getLastRow() > 1) {
          // Conserva soltanto le ricevute tecniche per non rieseguire scritture
          // ritentate dopo la cancellazione. Nessun dettaglio dell'attività.
          var receipts = mgmtSheet_('Ricevute', true);
          sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) {
            var entry = JSON.parse(r[0]);
            if (!entry.signature || entry.activity.esito === 'fallita') return;
            var a = entry.activity;
            var receipt = { signature: entry.signature, activity: { deviceId: a.deviceId, esito: a.esito }, response: entry.response };
            mgmtWrite_(receipts, mgmtRow_(receipts, a.id), a.id, receipt);
          });
          SpreadsheetApp.flush();
          sheet.deleteRows(2, sheet.getLastRow() - 1);
        }
        return json({ ok: true });
      });
      if (p.action === 'managementStandingsConfig') {
        var c = standingsConfig_(p.season);
        return json({ ok: true, config: { tipo: c.tipo, url: c.url, categoria: c.categoria, girone: c.girone, hasApiKey: !!c.apiKey } });
      }
      if (p.action === 'managementSaveStandings') return standingsSave_(p);
      if (p.action === 'managementRenameDevice') return mgmtRename_(p);
      return json({ ok: false, error: 'azione sconosciuta' });
    }
    // I lettori non devono fermarsi se il solo aggiornamento ultimo accesso fallisce.
    try { mgmtTouch_(p); } catch (err) { console.error('Management: ultimo contatto non aggiornato'); }
    if (p.action === 'standingsPdf') return uispPdf_(p.season);
    if (p.action === 'standings') return standingsRead_(p.season);
    if (p.action === 'deviceHello') {
      withLock_(function () { mgmtSimpleEvent_(p, 'Apertura app', 'accessi', 'riuscita'); });
      return json({ ok: true });
    }
    if ((p.action === 'put' || p.action === 'putAll') && p.collection === 'documenti') return routeOriginal_(p); // metadati locali: nessuna scrittura reale
    if (MGMT_MUTATIONS.indexOf(p.action) >= 0) return mgmtMutation_(p);
    return routeOriginal_(p);
  } catch (err) { return json({ ok: false, error: String(err) }); }
}

// Le credenziali delle classifiche sono conservate soltanto nelle Proprietà script.
function standingsKey_(season) {
  var s = String(season || '').replace(/\//g, '-');
  if (!/^\d{4}-\d{2,4}$/.test(s)) throw new Error('Stagione non valida');
  return 'STANDINGS_' + s;
}
function standingsConfig_(season) {
  return JSON.parse(mgmtProps_().getProperty(standingsKey_(season)) || '{"tipo":"nessuna","url":""}');
}
function standingsUrl_(url, widget) {
  if (widget) {
    if (!/^https:\/\/www\.tuttocampo\.it\/WidgetV2\/Classifica\/[a-zA-Z0-9-]+\/?$/.test(url)) throw new Error('Usa un URL ufficiale Tuttocampo WidgetV2/Classifica');
  } else {
    // Solo host DNS pubblici HTTPS, niente IP, porte, credenziali o redirect.
    if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::443)?(?:[/?][^\s#]*)?$/i.test(url) || /\.(?:local|internal|localhost)(?:[/:?]|$)/i.test(url) || /https:\/\/[\d.]+(?:[/:?]|$)/.test(url)) throw new Error('URL API HTTPS pubblico non valido');
  }
}
function standingsSave_(p) {
  return withLock_(function () {
    var key = standingsKey_(p.season), old = standingsConfig_(p.season), c = p.config || {};
    if (['nessuna', 'widget', 'api', 'uisp'].indexOf(c.tipo) < 0) throw new Error('Fonte non valida');
    var url = String(c.url || '').trim(), token = String(c.apiKey || '').trim();
    if (url.length > 2000 || token.length > 500 || /[\r\n]/.test(token)) throw new Error('Configurazione non valida');
    if (c.tipo !== 'nessuna' && c.tipo !== 'uisp') standingsUrl_(url, c.tipo === 'widget');
    var saved = { tipo: c.tipo, url: c.tipo === 'nessuna' ? '' : url, apiKey: c.tipo === 'api' ? (token === 'RIMUOVI' ? '' : token || (old.tipo === 'api' && old.url === url ? old.apiKey : '') || '') : '' };
    if (c.tipo === 'uisp') {
      if (!/^[1-9]$/.test(String(c.categoria || '')) || !/^[A-Z]$/.test(String(c.girone || ''))) throw new Error('Categoria o girone UISP non validi');
      saved = { tipo: 'uisp', categoria: String(c.categoria), girone: String(c.girone) };
    }
    mgmtProps_().setProperty(key, JSON.stringify(saved));
    return json({ ok: true });
  });
}
function standingsRead_(season) {
  var c = standingsConfig_(season);
  if (c.tipo === 'uisp') { var meta = uispLatest_(season); return json({ ok: true, tipo: 'uisp', categoria: c.categoria, girone: c.girone, pdfUrl: meta.pdfUrl, comunicato: meta.comunicato, fonte: meta.fonte }); }
  if (c.tipo !== 'api') return json({ ok: true, tipo: c.tipo, url: c.url });
  standingsUrl_(c.url, false);
  var cache = CacheService.getScriptCache(), key = standingsKey_(season) + '_' + mgmtDigest_(JSON.stringify(c)), hit = cache.get(key);
  if (hit) return json(JSON.parse(hit));
  var response;
  try { response = UrlFetchApp.fetch(c.url, { headers: c.apiKey ? { Authorization: 'Bearer ' + c.apiKey } : {}, followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: true }); }
  catch (e) { throw new Error('Fonte classifica non raggiungibile'); }
  if (response.getResponseCode() !== 200) throw new Error('API classifica: HTTP ' + response.getResponseCode());
  var text = response.getContentText();
  if (text.length > 500000) throw new Error('Risposta classifica troppo grande');
  var body;
  try { body = JSON.parse(text); } catch (e) { throw new Error('La fonte non restituisce JSON valido'); }
  var rows = Array.isArray(body) ? body : body.righe;
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('Formato API non supportato: atteso array righe');
  var names = {};
  var clean = rows.map(function (r) {
    if (!r || typeof r.squadra !== 'string' || !r.squadra.trim() || r.squadra.length > 150 || typeof r.punti !== 'number' || !isFinite(r.punti)) throw new Error('Riga classifica non valida');
    var name = r.squadra.trim();
    if (names['_' + name]) throw new Error('Squadra duplicata');
    names['_' + name] = true;
    var out = { squadra: name, punti: r.punti };
    ['giocate', 'vinte', 'pareggiate', 'perse', 'golFatti', 'golSubiti'].forEach(function (k) {
      if (r[k] == null) return;
      if (typeof r[k] !== 'number' || !isFinite(r[k]) || r[k] < 0 || Math.floor(r[k]) !== r[k]) throw new Error('Statistiche classifica non valide');
      out[k] = r[k];
    });
    return out;
  });
  // Si conserva l'ordine ufficiale, inclusi spareggi e penalizzazioni.
  var result = { ok: true, tipo: 'api', righe: clean, aggiornato: new Date().toISOString() };
  cache.put(key, JSON.stringify(result), 300);
  return json(result);
}

// Fonte gratuita: comunicati ufficiali settimanali UISP Modena.
function uispText_(url) {
  var r;
  try { r = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: true }); }
  catch (e) { throw new Error('UISP Modena non raggiungibile'); }
  if (r.getResponseCode() !== 200) throw new Error('UISP Modena: HTTP ' + r.getResponseCode());
  return r;
}
function uispLatest_(season) {
  var normalized = String(season).replace(/-/g, '/');
  var m = normalized.match(/^(\d{4})\/(\d{2}|\d{4})$/);
  if (!m) throw new Error('Stagione UISP non valida');
  var year = Number(m[1]), end = m[2].length === 2 ? Math.floor(year / 100) * 100 + Number(m[2]) : Number(m[2]);
  if (end !== year + 1) throw new Error('La stagione UISP deve coprire due anni consecutivi');
  var cache = CacheService.getScriptCache(), key = 'UISP_INDEX_' + year, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var home = uispText_('https://calcio.uispmodena.it/').getContentText();
  var anchors = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, a, directory = '';
  while ((a = anchors.exec(home))) {
    var label = a[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (label.toUpperCase() === 'COMUNICATI ' + year + '/' + end) { directory = a[1]; break; }
  }
  if (directory.charAt(0) === '/') directory = 'https://calcio.uispmodena.it' + directory;
  if (!/^https:\/\/calcio\.uispmodena\.it\/comunicati-[a-z0-9%/-]+$/i.test(directory)) throw new Error('Archivio comunicati UISP non trovato per questa stagione');
  var html = uispText_(directory).getContentText();
  var ids = /id=["']allegato_(\d+)["']/g, item, documents = [];
  while ((item = ids.exec(html))) {
    var block = html.slice(item.index, html.indexOf('</li>', item.index));
    var date = block.match(/COMUNICATO[^<]*?(\d{2})\/(\d{2})\/(\d{4})/i);
    var expected = 'https://calcio.uispmodena.it/upload/c_allegati/file/1/' + item[1] + '.pdf';
    if (date && html.indexOf(expected) >= 0) documents.push({ pdfUrl: expected, comunicato: date[3] + '-' + date[2] + '-' + date[1] });
  }
  documents.sort(function (a, b) { return b.comunicato.localeCompare(a.comunicato); });
  if (!documents.length) throw new Error('Nessun comunicato settimanale UISP trovato');
  var result = documents[0]; result.fonte = directory;
  cache.put(key, JSON.stringify(result), 300);
  return result;
}
function uispPdf_(season) {
  var c = standingsConfig_(season);
  if (c.tipo !== 'uisp') throw new Error('Fonte UISP non configurata');
  var meta = uispLatest_(season), response = uispText_(meta.pdfUrl), bytes = response.getBlob().getBytes();
  if (bytes.length > 10000000 || bytes.length < 5 || bytes.slice(0, 5).map(function (b) { return String.fromCharCode((b + 256) % 256); }).join('') !== '%PDF-') throw new Error('Comunicato UISP PDF non valido o troppo grande');
  return json({ ok: true, dataBase64: Utilities.base64Encode(bytes), pdfUrl: meta.pdfUrl });
}
