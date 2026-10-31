# Loghi, campionato, rinvii e liste

## Attivazione su Google Apps Script

Il frontend e lo script devono essere aggiornati insieme. Non servono un nuovo account Google né nuove password.

1. Aprire il progetto Apps Script già collegato al gestionale.
2. Sostituire il codice con `docs/apps-script.gs`, conservando i quattro valori iniziali già configurati: `PARENT_FOLDER_ID`, `SECRET`, `ARCHIVIO_DOCUMENTI_ID` e `ARCHIVIO_FOTO_ID`. Conservare anche le proprietà script già presenti, soprattutto `ADMIN_PASSWORD` e `MANAGEMENT_FILE_ID`.
3. Salvare. In **Distribuisci → Gestisci distribuzioni**, modificare la distribuzione Web app esistente, scegliere **Nuova versione** e distribuire mantenendo lo stesso URL `/exec`.
4. Se Google richiede nuove autorizzazioni per `UrlFetchApp`, autorizzare il proprietario dello script. Il recupero di fonti HTTPS usa quel servizio; non avviene nel browser degli utenti.
5. Ricaricare il gestionale. Aprire **Loghi squadre**, **Liste** e **Classifica** dal menu.

Le nuove raccolte vengono create al primo salvataggio. `loghi`, `liste` e `righeListe` vivono nella stagione tecnica `globale`, così rimangono disponibili passando da una stagione all’altra. Non vengono replicate come nuove copie a ogni stagione.

## Loghi

Da **Loghi squadre → Aggiungi logo**, inserire il nome squadra e scegliere PNG, JPEG o WebP. L’app prepara un PNG con lato massimo 512 px, conservando la trasparenza e le proporzioni. Il file rimane privato nella cartella `Loghi` e il foglio contiene soltanto i metadati; le immagini vengono richieste quando servono.

In **Grafiche IG**, lo stemma viene riconosciuto dal nome dell’avversario oppure scelto dal menu **Logo dall’archivio**. Resta disponibile il caricamento occasionale per la sola grafica. Rimuovere una voce dall’archivio rimuove il riferimento: il file resta su Drive, così non si distruggono materiali già usati.

## Partite rinviate

In **Grafiche IG → Rinviata** scegliere una gara in programma o inserire i dati manualmente. Il manifesto include i due stemmi, le squadre e “PARTITA RINVIATA”, senza data originale, motivo o data di recupero. È disponibile in post e storia, modificabile nell’editor ed esportabile come gli altri modelli.

**Registra rinvio nella partita** salva lo stato nella gara scelta. Lo stato è modificabile anche da **Partite → dettaglio → Modifica**. Una gara rinviata resta senza risultato e non contribuisce alle statistiche. Il calendario grafico del mese segnala “RINVIATA”. Quando si registra il risultato, la segnalazione di rinvio viene disattivata. La data di recupero è informativa: per spostare la gara nel calendario modificare anche il campo Data della partita.

## Liste condivise

Ogni lista ha nome, descrizione e fino a 30 colonne riordinabili. Tipi: testo, persona/incaricato, numero, importo in euro, data, sì/no, scelta da elenco; ogni colonna può essere obbligatoria.

Modelli iniziali:

- **Mare / partecipanti**: nome, conferma, numero persone, quota versata, note.
- **Tombola / premi commercianti**: negozio, volantino, chi deve andare, chi è andato, premio, valore, ritiro, stato, note.
- **Cena / prenotazioni**: nome, adulti, bambini, conferma, pagato, note.
- **Libera**: nome, incaricato, fatto, note.

La ricerca copre tutti i campi; numeri e importi hanno totali sulle righe filtrate. L’esportazione CSV contiene le colonne e le righe visibili. Le liste completate si archiviano e si possono riattivare. Le colonne rimosse conservano i valori nelle righe esistenti; ricreare una colonna con un nuovo ID non la ricollega automaticamente ai vecchi valori.

Le singole righe sono record indipendenti. Ogni salvataggio confronta la revisione sotto lock sul server: una modifica vecchia non sovrascrive quella più recente e una riga eliminata non viene ricreata da un editor rimasto aperto. In caso di conflitto l’app rilegge i dati condivisi, mantiene aperto il modulo e mostra il problema: copiare le proprie modifiche, chiudere e riaprire la riga prima di applicarle nuovamente. Le modifiche arrivano sugli altri dispositivi con la sincronizzazione periodica già presente, non tramite socket.

Il nome di chi aggiorna è dichiarato dal dispositivo, non è un’identità verificata: con l’account condiviso non è possibile attestare quale persona fisica lo utilizzi. Il registro Management mantiene anche l’identificativo dispositivo.

## Campionato e API Admin

Tutti possono consultare la classifica pubblicata. **Modifica classifica e calendario**, configurazione API e importazione compaiono soltanto con sessione Management attiva. Il server verifica la stessa sessione anche se si chiamano gli endpoint direttamente.

La classifica non viene ricostruita dalle sole partite del Riolunato, perché mancano i risultati delle altre squadre e le eventuali penalizzazioni. L’Admin può aggiornarla dall’editor oppure collegare una fonte HTTPS JSON. L’ordine delle righe è quello della fonte ufficiale: non si inventano criteri per gli spareggi.

Per la modalità API JSON il collegamento a UISP/Tuttocampo non è preconfigurato: serve una fonte autorizzata che esponga i dati oppure un adattatore del relativo provider. Inserire l’URL di una normale pagina HTML non basta. Nella configurazione è presente il modello JSON completo con i campi richiesti. Il pulsante **Aggiorna dalla fonte** esegue il recupero sul server e pubblica un’istantanea condivisa; **Ricarica** legge l’ultima istantanea. Non è previsto un aggiornamento programmato della fonte in questa versione.

URL e chiave API JSON stanno nelle Script Properties e non vengono restituiti all’app né inseriti nei log Management. Il link pubblico del widget viene invece restituito all’app per visualizzarlo. Ogni stagione ha una configurazione e un’istantanea proprie. Le richieste API accettano soltanto HTTPS pubblico, non seguono redirect e non inoltrano implicitamente una chiave precedente se si cambia host. Si possono impostare `Authorization` (es. `Bearer …`) o un header come `X-API-Key`. Per cambiare o eliminare una chiave usare la configurazione Admin; **Rimuovi API** elimina URL e chiave salvati.

## Verifica

`npm test` include modello liste, CSV, manifesto rinvio, autorizzazione server, gestione concorrente delle righe e deduplicazione dei retry. `npm run test:browser` include `tests/club-features.mjs`: creazione e persistenza di una riga, classifica visibile senza controlli Admin, apertura grafica rinvio e assenza di overflow a 320/768/1440 px. I test utilizzano dati fittizi e non modificano il Drive reale.


## Semplificazioni concordate

- Il menu **Classifica** mostra una sola tabella a tutti gli utenti. Solo la sessione Management consente di scegliere la fonte.
- Per TuttoCampo l’Admin incolla il link o il codice del **widget ufficiale Classifica**, apre l’anteprima e conferma con **Usa questa classifica per tutti**. Il normale URL del girone non viene convertito in un endpoint inventato. Verificare che TuttoCampo fornisca un widget attivo per il girone: l’app verifica il formato e l’host, mentre l’Admin controlla il contenuto nell’anteprima. Il widget si aggiorna dal fornitore quando viene caricato; la frequenza dei dati dipende da TuttoCampo. Se non si carica è disponibile il link per aprirlo separatamente.
- Le opzioni API JSON sono raccolte sotto **Opzioni avanzate**. Non servono chiavi API per il percorso widget. Le chiavi delle fonti JSON rimangono nelle proprietà dello script.
- Le liste sono fogli liberi, con fino a 30 colonne rinominabili, riordinabili, aggiungibili e rimovibili. Tutti possono personalizzarle. Tipi: testo, numero, euro, data, sì/no, scelta, persona. I modelli Libera, Mare, Cena e Tombola sono solo punti di partenza. Numeri e importi hanno totali automatici. Più utenti possono lavorare su righe diverse; modifiche contemporanee alla stessa riga sono segnalate.
- La grafica **Rinviata**, sia post che storia, contiene squadre, stemmi e **PARTITA RINVIATA**, oltre al piede della grafica. Non stampa data, motivo o recupero, anche se presenti nella partita. Per crearla basta scegliere l’avversario; è facoltativo selezionare una partita già in calendario.

## Codice da incollare in Apps Script (versione completa)

Usare **tutto** `docs/apps-script.gs`, non aggiungerlo in fondo al vecchio codice: include già funzionalità precedenti, Management, loghi, liste e classifica. Conservare i valori iniziali reali di `PARENT_FOLDER_ID`, `SECRET`, `ARCHIVIO_DOCUMENTI_ID`, `ARCHIVIO_FOTO_ID`. Le proprietà script non vanno cancellate: in particolare `ADMIN_PASSWORD`, `MANAGEMENT_FILE_ID` e le altre già presenti. Se Management non era ancora attivato, impostare `ADMIN_PASSWORD` nelle Proprietà script (almeno 12 caratteri); non è la password ordinaria dell’app.

Salvare e aggiornare **la distribuzione Web app esistente**: Distribuisci → Gestisci distribuzioni → Modifica → Nuova versione → Distribuisci, mantenendo URL, esecuzione e accesso esistenti. Autorizzare gli eventuali nuovi permessi. Non creare una nuova distribuzione con un URL diverso. Per le anteprime Office rimane necessario il servizio avanzato Drive API già documentato all’inizio del codice. Ricaricare quindi il frontend aggiornato. Il codice è pronto per la pubblicazione ma non modifica da solo il progetto Apps Script online.
