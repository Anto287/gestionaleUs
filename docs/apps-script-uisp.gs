// SOLO AGGIORNAMENTO UISP: se hai già applicato il precedente blocco Classifica/LOG.
// Incollare una volta in fondo allo stesso file. Non cambiare ID o SECRET.
// Alternativa: usa il blocco completo apps-script-aggiunta.gs aggiornato.

route = function(p) {
  try {
    p = p || {};
    if (!SECRET || !secretOk_(p.secret)) { Utilities.sleep(1000); return json({ ok: false, error: 'non autorizzato' }); }
    // Il registro non è mai accessibile attraverso gli endpoint normali,
    // nemmeno conoscendo l'id del suo file.
    var managementFile = mgmtProps_().getProperty('MANAGEMENT_FILE_ID');
    if (managementFile && String(p.id || '') === managementFile || /^(management|attivita|dispositivi|__)/i.test(String(p.collection || ''))) throw new Error('Operazione riservata');
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
};

standingsSave_ = function(p) {
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
};

standingsRead_ = function(season) {
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
};

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
