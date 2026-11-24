// AVVIO VELOCE: incollare una volta in fondo allo script esistente.
// Conservare credenziali, cartelle e tutti i blocchi Management/promemoria.
// Richiede Drive API v3 e Google Sheets API per la lettura parallela;
// senza servizi/permessi resta disponibile la lettura precedente.

// Ogni esecuzione Apps Script ha la propria mappa: anche i file mancanti
// si cercano una sola volta, senza nascondere file creati in seguito.
cercaPerNome_ = (function (precedente) {
  var trovati = Object.create(null);
  return function (parentId, nome, mimeType) {
    var key = JSON.stringify([parentId, nome, mimeType]);
    if (!Object.prototype.hasOwnProperty.call(trovati, key)) {
      trovati[key] = precedente(parentId, nome, mimeType);
    }
    return trovati[key];
  };
})(cercaPerNome_);

// A cache ID scaduta: un elenco dei fogli per cartella sostituisce una
// ricerca Drive per ciascuna delle 19 raccolte. Nessun contenuto dei file.
fileIdSezione_ = (function (precedente) {
  var cartelle = Object.create(null);
  return function (collection, season) {
    if (typeof Drive === 'undefined') return precedente(collection, season);
    var key = seasonKey_(season), cacheKey = 'file/' + key + '/' + collection;
    try {
      var cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) return cached;
      var folder = FILE_RADICE[collection] ? PARENT_FOLDER_ID : cercaPerNome_(PARENT_FOLDER_ID, key, MIME_CARTELLA);
      if (!folder) return null;
      if (!Object.prototype.hasOwnProperty.call(cartelle, folder)) {
        var files = Object.create(null), page;
        do {
          var options = {
            q: "'" + folder + "' in parents and trashed = false and mimeType = '" + MIME_FOGLIO + "'",
            fields: 'nextPageToken,files(id,name)', pageSize: 1000
          };
          if (page) options.pageToken = page;
          var result = Drive.Files.list(options);
          (result.files || []).forEach(function (f) { if (!files[f.name]) files[f.name] = f.id; });
          page = result.nextPageToken;
        } while (page);
        cartelle[folder] = files;
      }
      var name = FILE_RADICE[collection] || FILE_STAGIONE[collection] || nomeFile_(collection);
      var id = cartelle[folder][name] || null;
      if (id) CacheService.getScriptCache().put(cacheKey, id, CACHE_FILE_SECONDI);
      return id;
    } catch (err) { return precedente(collection, season); }
  };
})(fileIdSezione_);

// Il ripiego non deve trasferire tutte le colonne leggibili e le formule:
// dopo l'intestazione basta la sola colonna tecnica, fino all'ultima riga.
listDalFoglio_ = function (collection, season) {
  var sheet = findSheet_(collection, season);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idx = headers.indexOf(DATO_COL);
  if (idx < 0) throw new Error('Colonna dati mancante: ' + collection);
  return recordDaRighe_([[DATO_COL]].concat(
    sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1).getValues()
  ));
};

listAllItems = (function (precedente) {
  return function (richieste) {
    if (!serviziVeloci_() || typeof ScriptApp === 'undefined' || typeof UrlFetchApp === 'undefined') {
      return precedente(richieste);
    }
    var out = [], pending = [], fallback = [];
    (richieste || []).forEach(function (r) {
      // Compatibilità con client precedenti: i documenti restano supportati.
      if (r.collection === 'documenti') { fallback.push(r); return; }
      var key = cacheChiave_(r.collection, r.season);
      var cached = cacheLeggi_(key);
      if (cached !== null) { out.push({ collection: r.collection, items: cached }); return; }
      try {
        var id = fileIdSezione_(r.collection, r.season);
        if (!id) { out.push({ collection: r.collection, items: [] }); return; }
        var range = FILE_RADICE[r.collection] ? "'" + seasonKey_(r.season) + "'!A1:ZZ" : 'A1:ZZ';
        pending.push({ richiesta: r, key: key, url: 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '/values/' + encodeURIComponent(range) });
      } catch (err) { fallback.push(r); }
    });
    // Otto letture per lotto: evita la somma dei tempi di apertura dei fogli
    // senza generare raffiche illimitate verso le API Google.
    var token;
    try { if (pending.length) token = ScriptApp.getOAuthToken(); }
    catch (err) { pending.forEach(function (p) { fallback.push(p.richiesta); }); pending = []; }
    for (var start = 0; start < pending.length; start += 8) {
      var batch = pending.slice(start, start + 8);
      try {
        var responses = UrlFetchApp.fetchAll(batch.map(function (p) {
          return { url: p.url, headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
        }));
        batch.forEach(function (p, i) {
          try {
            if (responses[i].getResponseCode() !== 200) throw new Error('Lettura API non riuscita');
            var body = JSON.parse(responses[i].getContentText());
            // Non trasformare una risposta malformata in una tabella vuota.
            if (!body.range || (body.values && !Array.isArray(body.values))) throw new Error('Risposta API non valida');
            if (body.values && body.values.length && body.values[0].indexOf(DATO_COL) < 0) throw new Error('Colonna dati mancante');
            var items = recordDaRighe_(body.values);
            cacheScrivi_(p.key, items);
            out.push({ collection: p.richiesta.collection, items: items });
          } catch (err) { fallback.push(p.richiesta); }
        });
      } catch (err) { batch.forEach(function (p) { fallback.push(p.richiesta); }); }
    }
    // Solo i fogli falliti: nessuna rilettura delle sezioni già riuscite.
    return out.concat(precedente(fallback));
  };
})(listAllItems);
