# Management: attivazione e uso

## Aggiornare Google Apps Script

1. Conserva una copia del codice Apps Script attualmente pubblicato.
2. Sostituisci il vecchio codice con **l’intero contenuto di `docs/apps-script.gs`**. Non aggiungerlo in fondo alla vecchia versione: le funzioni avrebbero nomi duplicati. Se il progetto Google contiene più file, sostituisci le vecchie definizioni corrispondenti.
3. Ripristina nelle prime righe i tuoi valori di `PARENT_FOLDER_ID`, `SECRET`, `ARCHIVIO_DOCUMENTI_ID` e `ARCHIVIO_FOTO_ID`. Il file consegnato li contiene vuoti. Mantieni la stessa `SECRET` dell’app per non cambiare l’accesso abituale. Le configurazioni dei servizi avanzati Drive/Sheets già presenti restano necessarie.
4. In **Impostazioni progetto → Proprietà script**, aggiungi `ADMIN_PASSWORD` e scegli una password amministratore distinta da quella dell’app, lunga almeno 12 caratteri. Non scriverla nel frontend e non condividerla con gli altri utilizzatori.
5. Salva e aggiorna il **deployment esistente**: **Distribuisci → Gestisci deployment → Modifica → Nuova versione → Distribuisci**. Mantieni l’esecuzione come proprietario e le impostazioni d’accesso del deployment già in uso. L’indirizzo `/exec` deve restare lo stesso.
6. Pubblica anche il frontend aggiornato con la consueta procedura del progetto. Il push su `main` avvia il workflow GitHub Pages, che pubblica il frontend dopo il superamento dei controlli. Lo script Google va aggiornato separatamente come descritto sopra.

Lo script crea automaticamente un file **Management - U.S. Riolunato** nel Drive del proprietario, fuori dalle cartelle condivise della società. Contiene le schede `Dispositivi` e `Attivita`. Il suo ID viene salvato nella proprietà `MANAGEMENT_FILE_ID`: non cancellarla e non condividere il file con gli utilizzatori normali. Non viene usata la funzione di condivisione via link prevista per gli altri documenti.

## Aprire la sezione

- Accedi normalmente all’app.
- Fai **5 click o tocchi sul logo entro 3 secondi**. Funziona sul logo laterale desktop e sul logo della barra superiore mobile; da tastiera il logo riceve focus e accetta Invio o Spazio.
- Inserisci la password amministratore. Compare la voce **Management** nel menu e si apre la pagina.
- La sessione dura al massimo **30 minuti** e resta solo in memoria. Ricaricando la pagina devi sbloccarla di nuovo. Il pulsante **Chiudi Management** e l’uscita dall’app revocano la sessione sul server, quando la connessione è disponibile; in ogni caso il token scade automaticamente.
- Dopo cinque password amministratore errate, i nuovi tentativi vengono bloccati per cinque minuti. Il limite è condiviso per il progetto.

## Dispositivi e attività

Nella scheda **Dispositivi**, scegli **Rinomina**, inserisci per esempio “PC Lavoro” e salva. Il nome è condiviso tra tutte le sessioni amministratore. Il dispositivo corrente è evidenziato; sono disponibili browser, sistema operativo, primo e ultimo contatto. L’ultimo contatto è aggiornato al massimo una volta ogni cinque minuti per limitare le scritture.

Il **Registro attività** permette di cercare per operazione o elemento e filtrare per dispositivo, intervallo di date, sezione, stagione ed esito. Le date sono mostrate nel fuso Europe/Rome; i filtri Dal/Al includono l’intera giornata di Roma. I dati globali (come i Conti) sono indicati come “Generale”; per filtrarli per stagione usa `globale`. Le pagine contengono 25 attività. Usa **Aggiorna** per rileggere il registro.

Espandi una riga per vedere i campi modificati. Le modifiche a strutture o liste sono riassunte; le importazioni mostrano il numero di record prima e dopo. I dati riservati (credenziali, identificativi documentali, dati medici, allegati) non sono duplicati nei valori del registro. I nomi e le descrizioni degli elementi restano visibili per riconoscere le operazioni.

Sono registrate:

- creazioni, modifiche, cancellazioni e sostituzioni delle raccolte;
- caricamenti, creazioni, rinomine e cancellazioni dei documenti;
- caricamenti e cancellazioni dell’archivio tesserati;
- caricamenti delle grafiche su Drive;
- aggiornamenti dell’elenco stagioni;
- aperture dell’app, accessi riusciti al Management e rinomine dei dispositivi.

Le operazioni provenienti da una versione precedente dell’app restano registrabili dallo script, ma senza metadati del browser vengono mostrate come “Dispositivo non identificato”.

## Esiti e limiti

- **Riuscita:** il server ha confermato l’operazione.
- **Fallita:** il server ha restituito un errore. Le operazioni sui file possono aver avuto effetti parziali: controlla il Drive prima di ripeterle.
- **Da verificare:** il registro conserva l’avvio ma non una conferma finale, per esempio dopo un’interruzione dell’esecuzione. Controlla i dati prima di ripetere l’operazione. Non viene proposto un esito inventato.

Il frontend conserva lo stesso ID quando ritenta una scrittura dalla coda di recupero. Lo script conserva nel registro l’ID e l’impronta della richiesta: se la scrittura era già riuscita, restituisce l’esito senza eseguirla una seconda volta. In caso di esito incerto evita di ripeterla automaticamente. Questa protezione opera con lo script aggiornato e non sostituisce una transazione tra fogli e file, che qui non è disponibile.

Lo storico inizia dall’attivazione dello script. Non include modifiche dirette ai fogli Google, navigazione tra pagine, preferenze o esportazioni locali, richieste respinte prima dell’autenticazione dell’app, né azioni in modalità locale senza Drive. Un errore di rete che impedisce alla richiesta di raggiungere lo script non può essere registrato sul server.

L’identificativo distingue il browser/profilo, non certifica il computer fisico o la persona. Cancellando i dati del browser o usando un altro profilo compare un nuovo dispositivo. Non viene raccolto un fingerprint hardware. Il registro serve alla gestione quotidiana e non è un sistema forense non alterabile: il proprietario del Drive può comunque modificare il file.

Le sessioni amministratore usano la cache di Apps Script: un’eventuale espulsione anticipata richiede semplicemente un nuovo accesso. Cambiare `ADMIN_PASSWORD` invalida anche i token già emessi.

## Verifica locale

- `npm test`: include i test dello script in un ambiente simulato, senza contattare Google.
- `npm run test:management`: test browser desktop e mobile con risposte Drive simulate.
- `npm run test:browser`: test preesistenti di avvio, salvataggi e sincronizzazione.
- `npm run build` e `npm run lint`: compilazione e controllo statico.

Per i test browser serve Chromium installato tramite Playwright; in alternativa specifica `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. I test non usano password o dati reali. Il deployment su Google e la prova finale contro il proprio Drive devono essere effettuati dopo la configurazione descritta sopra.
