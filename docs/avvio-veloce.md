# Avvio: tabelle prima degli allegati

## Problema trovato

DataProvider attendeva tutte le 20 raccolte prima di montare l'app. `documenti` non è una tabella: richiede l'elenco dei file nella cartella Drive della stagione. Una cartella lenta impediva quindi anche l'accesso a Conti, Calendario e Rosa. L'archivio foto/tesserati era già limitato alle pagine che lo usano e i contenuti completi erano già su richiesta.

L'Apps Script allegato esegue `listAllItems` in modo seriale. Ogni tabella senza cache comporta la ricerca del file e la lettura dei valori; la stessa cartella della stagione viene cercata più volte. Il ripiego SpreadsheetApp trasferisceva anche tutte le colonne di presentazione.

## Modifica

- Avvio con le sole 19 tabelle: si attende ancora la conferma del Drive, senza usare copie potenzialmente superate come lasciapassare alle modifiche.
- Catalogo documenti in background dopo l'apertura, con errore separato e segnaposto nella pagina Documenti. Gli aggiornamenti continuano a rispettare SyncGuard per non sovrascrivere modifiche locali.
- Apps Script: cache esistente conservata, letture senza cache in lotti da massimo 8 richieste Sheets, ripiego per i soli fogli falliti. Con 19 file trovati e nessuna cache dati: tre lotti HTTP invece di 19 letture seriali dei valori. Le ricerche file e i costi di avvio di Apps Script restano, quindi questo rapporto non equivale a una misura del tempo totale.
- A cache ID scaduta, un elenco dei fogli per cartella sostituisce le ricerche individuali per raccolta. Gli elenchi sono paginati e limitati ai file Google Sheets.
- Ricerche identiche delle cartelle memoizzate per la singola esecuzione. I risultati assenti non vengono conservati tra esecuzioni.
- Ripiego SpreadsheetApp: intestazione e sola colonna `dato_json`, fino all'ultima riga usata.

## Attivazione

1. Pubblicare il frontend di questo branch tramite il normale flusso GitHub Pages. Il solo aggiornamento dello script non separa i documenti dal percorso di avvio dei vecchi client.
2. Nell'editor Apps Script esistente, aggiungere una sola volta in fondo il contenuto di `docs/apps-script-avvio-veloce.gs`. Non sostituire credenziali, ID cartelle o blocchi Management/promemoria. In alternativa usare il file completo ottimizzato derivato dall'allegato, mantenendo i valori configurati nello script attualmente distribuito: l'allegato fornito ha i quattro campi iniziali vuoti.
3. Per la lettura parallela abilitare i servizi avanzati Drive API v3 e Google Sheets API, quindi eseguire `autorizza` dall'editor per confermare le autorizzazioni. Per progetti Cloud standard verificare anche l'abilitazione delle API nel progetto. UrlFetchApp usa il permesso `script.external_request`; se gli scope sono dichiarati esplicitamente nel manifest, includerlo insieme ai permessi Drive/Sheets già necessari. Il token OAuth resta sul server.
4. Gestisci deployment → modifica deployment esistente → nuova versione. Conservare lo stesso URL `/exec` configurato nell'app.
5. Verificare su un telefono con i dati reali, anche con cache scaduta. I test locali usano dati fittizi e non misurano la latenza del Drive reale.

Senza servizi o permessi avanzati il ripiego conserva il funzionamento precedente; la separazione dei documenti resta attiva nel nuovo frontend.

Riferimento API: https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchAll(Object)
