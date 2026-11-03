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
- L’accesso resta attivo **fino alla disconnessione esplicita**, anche ricaricando la pagina o riaprendo l’app. La voce **Management** rimane nel menu, subito sotto **Panoramica**. Il pulsante **Disconnetti Management** e l’uscita dall’app cancellano il token da questo browser e lo revocano sul server, quando la connessione è disponibile. Le altre schede aperte nello stesso browser ricevono la disconnessione. Il token viene memorizzato nel browser; la password amministratore non viene salvata.
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

Le sessioni amministratore persistenti sono registrate nelle Proprietà script come `MANAGEMENT_SESSION_<id_dispositivo>`, conservando soltanto l’impronta del token e della password. Non usano la cache e non hanno una scadenza temporale. Ogni browser ha una sola sessione attiva: un nuovo login sostituisce il token precedente su quel browser. Cambiare `ADMIN_PASSWORD` invalida i token già emessi; cancellare la relativa proprietà revoca la sessione del dispositivo. Cancellando i dati del browser sarà necessario accedere di nuovo.

Se provieni dalla versione con sessioni di 30 minuti, aggiorna nuovamente lo script e il deployment esistente mantenendo i tuoi ID, `SECRET` e `ADMIN_PASSWORD`, poi effettua un nuovo accesso Management. Il frontend segnala esplicitamente se lo script pubblicato non supporta ancora la persistenza.

## Verifica locale

- `npm test`: include i test dello script in un ambiente simulato, senza contattare Google.
- `npm run test:management`: test browser desktop e mobile con risposte Drive simulate.
- `npm run test:browser`: test preesistenti di avvio, salvataggi e sincronizzazione.
- `npm run build` e `npm run lint`: compilazione e controllo statico.

Per i test browser serve Chromium installato tramite Playwright; in alternativa specifica `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. I test non usano password o dati reali. Il deployment su Google e la prova finale contro il proprio Drive devono essere effettuati dopo la configurazione descritta sopra.

## Eliminazione LOG e classifica online

Il pulsante **Elimina tutti i LOG**, nel Registro attività, chiede conferma ed elimina tutte le attività, indipendentemente dai filtri. L’operazione richiede una sessione Management valida anche sul server. I dispositivi restano registrati. Nel foglio privato `Ricevute` restano soltanto ID, impronta, esito tecnico e risposta delle scritture, senza descrizioni o valori prima/dopo: servono a impedire che una richiesta già eseguita venga ripetuta dopo la pulizia.

In **Management → Classifica**, configura la fonte API per la stagione attiva oppure scegli Non configurata:

- **API JSON**: inserisci un endpoint HTTPS pubblico. La chiave facoltativa è trasmessa dal server come `Authorization: Bearer …`, conservata nelle Proprietà script e mai restituita al frontend. Campo vuoto mantiene la chiave solo se l’URL è invariato; `RIMUOVI` la cancella. Cambiare endpoint senza fornire una nuova chiave non inoltra la precedente al nuovo host. L’API deve restituire un array oppure `{ "righe": [...] }`. Ogni riga contiene `squadra` (testo), `punti` (numero, anche negativo per penalizzazioni), ed eventualmente `giocate`, `vinte`, `pareggiate`, `perse`, `golFatti`, `golSubiti` (interi non negativi). L’ordine ufficiale della fonte è conservato. Se il fornitore usa un formato diverso serve un adattatore, non basta incollare la sua chiave.

Esempio: `{ "righe": [{ "squadra": "U.S. Riolunato", "punti": 12, "giocate": 6, "vinte": 4, "pareggiate": 0, "perse": 2, "golFatti": 10, "golSubiti": 5 }] }`.

Le API vengono lette all’apertura e ogni cinque minuti mentre la pagina è visibile; una cache server di cinque minuti limita le chiamate al fornitore. **Aggiorna** rilegge la fonte rispettando questa cache. Gli errori sono mostrati senza usare dati inventati. Le nuove stagioni partono senza fonte: configurare l’API del nuovo girone mantiene separati gli URL delle stagioni precedenti, senza anni fissati nel codice. Le classifiche storiche restano dipendenti dalla disponibilità dell’archivio del fornitore, non sono copie congelate.

Per attivare questi endpoint è necessario aggiornare e ridistribuire **anche `docs/apps-script.gs`**, mantenendo le proprie configurazioni iniziali, e autorizzare le nuove chiamate esterne (`UrlFetchApp`, ambito `script.external_request`) se Google lo richiede. Il solo frontend non aggiorna lo script remoto. Nessun provider è preconfigurato e nessuna chiave è inclusa. Il servizio di widget/API è descritto da Tuttocampo: https://www.tuttocampo.it/Veneto/News/1818058.

## Programmi e resoconti allenamento

Aprendo una seduta, oltre alle presenze, puoi scrivere **Programma di allenamento** e **Attività svolta e osservazioni**. **Salva programma e resoconto** salva entrambi sulla stessa seduta e nella stessa stagione, con la sincronizzazione Drive già usata dalle presenze.

**Genera esercizi** crea una proposta locale per possesso, finalizzazione o difesa, in base a durata (30–150 minuti) e numero previsto di giocatori (4–40). La somma delle fasi corrisponde alla durata scelta. È una libreria di esercizi, senza chiamate AI né costi; la proposta è modificabile e richiede il salvataggio esplicito. Prima di sostituire un programma esistente viene chiesta conferma. Le vecchie sedute senza questi campi continuano a funzionare.

## Aggiornamento tramite blocco aggiuntivo

Se hai già la versione con Management persistente e preferisci conservare il file esistente, incolla **una sola volta, in fondo allo stesso file**, l’intero contenuto di `docs/apps-script-aggiunta.gs`. Il blocco aggiorna le funzioni di smistamento e le scritture e aggiunge il supporto classifiche/LOG; non cambia gli ID né `SECRET`. È verificato anche contro la versione su main precedente a questa PR. Non usarlo su script precedenti al Management persistente. In alternativa sostituisci il file intero con `docs/apps-script.gs`, ripristinando i tuoi valori iniziali. Sono due alternative: non occorre applicarle entrambe. Salva e pubblica una nuova versione del deployment esistente, mantenendo l’URL `/exec`. Per l’API autorizza le richieste esterne se Google lo richiede.

## Loghi squadre

La sezione **Loghi squadre** salva una libreria condivisa nella raccolta globale `loghi`, comune a tutte le stagioni e sincronizzata attraverso gli endpoint già esistenti. Accetta PNG, JPEG e WebP fino a 10 MB, mantiene la trasparenza e riduce le immagini prima del salvataggio per rispettare il limite delle celle Google Sheets. Puoi aggiungere un nome e fino a 20 alias, modificare o eliminare il logo. Nomi e alias non possono sovrapporsi tra loghi diversi.

La classifica in modalità **API JSON** e **UISP Modena** mostra i loghi della libreria accanto ai nomi, con confronto esatto normalizzato (spazi, maiuscole, punteggiatura e accenti sono ignorati). Se un fornitore usa un nome diverso aggiungilo come alias. Un logo assente non blocca la tabella. La visualizzazione è una tabella interna senza iframe, con i loghi caricati. Le vecchie configurazioni widget richiedono di essere sostituite con una fonte API JSON.

Nelle **Grafiche IG** il logo avversario viene scelto automaticamente per annuncio, risultato e formazione con partita associata; è sempre possibile scegliere manualmente un logo salvato o caricarne uno per la sola grafica. Cambiare squadra evita di trascinare il logo manuale della squadra precedente. Il logo della propria società, se salvato con il nome U.S. Riolunato o un alias equivalente, sostituisce quello predefinito nelle grafiche. Le immagini mantengono le proporzioni. Le grafiche già esportate restano file indipendenti.


## Classifica interna senza iframe

La sezione Classifica mostra esclusivamente una tabella interna, con nomi, loghi della libreria e statistiche. In Management sono disponibili UISP Modena gratuita, API JSON avanzata e Non configurata. Una vecchia fonte widget viene segnalata e non viene caricata in iframe; per convertirla occorre un vero endpoint API, non il suo URL widget.

**La modalità API JSON usa gli endpoint `standings`, `managementStandingsConfig` e `managementSaveStandings` già presenti nel precedente blocco Classifica/LOG.** Per attivare la nuova fonte UISP gratuita segui invece le istruzioni di aggiornamento UISP qui sotto. Per la modalità API resta da configurare la fonte della stagione e la chiave eventualmente richiesta. Per un fornitore che restituisce un JSON diverso dal contratto documentato servirà un adattatore specifico; il solo link a una pagina Tuttocampo non consente di leggere automaticamente i dati.

## Modalità gratuita UISP Modena: classifica e risultati

Per il campionato del Riolunato scegli **Management → Classifica → UISP Modena · gratuita, settimanale → Categoria 3 → Girone B → Salva**. Non occorrono URL API, chiavi o account aggiuntivi. Il link Tuttocampo fornito contiene `GironeD` ma al momento della verifica mostra **Calcio a 11 Modena – Cat. 3 Girone B**: la configurazione usa il campionato effettivamente indicato nella pagina e nel comunicato UISP.

La fonte è l’archivio pubblico ufficiale `https://calcio.uispmodena.it/`: l’app trova il menu dei comunicati della stagione selezionata, sceglie il comunicato settimanale più recente e legge esclusivamente la sezione **CAMPIONATO** della categoria e del girone configurati. Le coppe sono escluse. Le stagioni future non richiedono di cambiare il codice: quando UISP pubblica il nuovo archivio, si selezionano categoria e girone per la nuova stagione. Se anno, gruppo o formato non sono disponibili l’app mostra un errore, senza usare un altro girone o inventare la classifica.

Sono mostrati la classifica e i risultati pubblicati nel comunicato, con data e collegamento al PDF ufficiale. **I dati sono settimanali e possono essere meno recenti di Tuttocampo.** I risultati sono quelli del periodo coperto dal singolo comunicato, non tutto lo storico del campionato e non una diretta live. Non vengono copiati nella raccolta Partite della società e non cambiano marcatori o statistiche interne. La classifica mantiene l’ordine UISP e i loghi vengono abbinati tramite nomi/alias della libreria (esempio: alias `RIOLUNATO U.S` sul logo U.S. Riolunato).

Ogni cinque minuti viene controllata la presenza di un nuovo comunicato; l’indice del sito è in cache server per cinque minuti. Lo stesso PDF già letto è riutilizzato nel browser per un massimo di quindici minuti. **Aggiorna** forza anche la rilettura del PDF, utile quando UISP corregge un allegato mantenendo lo stesso indirizzo. Le immagini e i nominativi nelle altre sezioni del PDF non vengono importati. La lettura del documento avviene nel browser; lo script Google recupera soltanto i file dal dominio ufficiale fissato nel codice, senza inoltrare chiavi di altri servizi.

### Aggiornamento Apps Script per UISP

Questa nuova fonte richiede un aggiornamento rispetto al precedente blocco che supportava soltanto API JSON:

- Se hai già applicato il blocco Classifica/LOG precedente, incolla **una sola volta in fondo allo stesso file** `docs/apps-script-uisp.gs`.
- Se non lo hai ancora applicato, usa il nuovo `docs/apps-script-aggiunta.gs` completo, che include anche UISP. Non serve applicare entrambi.
- In alternativa, sostituisci il sorgente completo con `docs/apps-script.gs`, mantenendo i tuoi ID e segreti.

Salva e distribuisci una nuova versione del deployment esistente, mantenendo lo stesso URL `/exec`. Autorizza le richieste esterne se Google lo richiede. Non vengono attivate API commerciali o abbonamenti. La gratuità riguarda la fonte pubblica UISP e l’assenza di un servizio dati a pagamento; restano i normali limiti di utilizzo di Google Apps Script. Se UISP modifica la struttura del sito o dei PDF potrà essere necessario aggiornare il lettore.

La pagina ufficiale `https://www.tuttocampo.it/WidgetApi` dichiara che le API Tuttocampo hanno un costo mensile, mentre i widget gratuiti usano iframe. Per questo la modalità gratuita senza iframe usa i comunicati UISP, non l’estrazione automatica delle pagine Tuttocampo.

### Classifica: cache e condivisione

La classifica letta viene conservata sul dispositivo come dati elaborati, senza PDF,
credenziali o loghi duplicati. Riaprendo la pagina compare subito l’ultima copia.
In background si controlla la fonte all’apertura, al ritorno nella pagina, al ritorno
online e ogni cinque minuti mentre l’app è visibile. Il PDF viene scaricato e analizzato
solo al primo accesso o se cambiano URL, data del comunicato, categoria o girone.
La copia precedente viene sostituita solo dopo una lettura riuscita: in caso di errore
rimane visibile con un avviso e la data della fonte. La cache è separata per stagione.
Ogni dispositivo effettua la propria prima lettura. La cancellazione dei dati del
browser richiede una nuova lettura. Se lo spazio locale non è disponibile, l’app
continua a funzionare ma non conserva la copia tra le aperture.

**Aggiorna classifica** controlla se ci sono novità senza riscaricare lo stesso PDF.
**Rileggi PDF** forza una nuova lettura, utile per correzioni pubblicate allo stesso
indirizzo. Il controllo dell’indice ufficiale può avere fino a cinque minuti di cache
sul server. Non servono modifiche aggiuntive ad Apps Script.

**Esporta classifica** apre gli strumenti nella pagina: anteprima e PNG per post
Instagram 1080×1350 oppure Storia 1080×1920, e PDF A4 da scaricare e stampare dal
visualizzatore del dispositivo. La grafica include loghi disponibili nella libreria,
data della fonte e posizione del Riolunato evidenziata. Le classifiche lunghe si
suddividono in più immagini scaricabili separatamente. L’esportazione conserva
l’ordine della fonte e i dati dell’ultima copia visibile, anche se non aggiornata:
controllare sempre la data prima di pubblicare.

### Leggibilità e grafici

I messaggi temporanei restano visibili per otto secondi; quelli molto lunghi
vanno a capo e possono scorrere nel proprio riquadro. Gli errori persistenti di
sincronizzazione mantengono separati titolo, dettaglio e azione di recupero.
Su mobile descrizioni di attività, nomi squadra, celle e dettagli non dipendono
dall’hover per essere letti.

I quattro grafici (presenze, bilancio mensile, categorie, gol) mostrano i dettagli
in un pannello esterno di altezza riservata: toccando il disegno o scegliendo un
dato dal selettore, l’informazione cambia senza allargare o allungare il grafico.
La tabella espandibile permette la lettura completa e da tastiera. Le animazioni
al cambio dei dati sono disattivate. Il bilancio e le categorie includono anche
movimenti ancora da saldare; il saldo del mese non coincide con il saldo di cassa.
Le presenze sono rapportate alla rosa attuale, anche per le sedute precedenti.
