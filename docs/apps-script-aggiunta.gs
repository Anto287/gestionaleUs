// AGGIUNTA ALLA VERSIONE CON MANAGEMENT PERSISTENTE
// Incollare UNA VOLTA in fondo allo stesso file dello script esistente.
// Non serve cambiare gli ID o SECRET. In alternativa usare apps-script.gs completo.
// Gli override assegnano le funzioni aggiornate senza duplicare le dichiarazioni.

mgmtMutation_ = function(p) {
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
};

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
        return json({ ok: true, config: { tipo: c.tipo, url: c.url, hasApiKey: !!c.apiKey } });
      }
      if (p.action === 'managementSaveStandings') return standingsSave_(p);
      if (p.action === 'managementRenameDevice') return mgmtRename_(p);
      return json({ ok: false, error: 'azione sconosciuta' });
    }
    // I lettori non devono fermarsi se il solo aggiornamento ultimo accesso fallisce.
    try { mgmtTouch_(p); } catch (err) { console.error('Management: ultimo contatto non aggiornato'); }
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
    if (['nessuna', 'widget', 'api'].indexOf(c.tipo) < 0) throw new Error('Fonte non valida');
    var url = String(c.url || '').trim(), token = String(c.apiKey || '').trim();
    if (url.length > 2000 || token.length > 500 || /[\r\n]/.test(token)) throw new Error('Configurazione non valida');
    if (c.tipo !== 'nessuna') standingsUrl_(url, c.tipo === 'widget');
    var saved = { tipo: c.tipo, url: c.tipo === 'nessuna' ? '' : url, apiKey: c.tipo === 'api' ? (token === 'RIMUOVI' ? '' : token || (old.tipo === 'api' && old.url === url ? old.apiKey : '') || '') : '' };
    mgmtProps_().setProperty(key, JSON.stringify(saved));
    return json({ ok: true });
  });
}
function standingsRead_(season) {
  var c = standingsConfig_(season);
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
