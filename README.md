# U.S. Riolunato — Gestionale

Web app in React + TypeScript + Vite per gestire la società.
Design minimal, accesso protetto da password, dati destinati a Google Drive.

## Avvio

```bash
npm install
npm run dev
```

## Accesso

All'apertura viene chiesta una password. La schermata di login è solo UX: la
protezione vera sta nel backend Apps Script, che rifiuta ogni richiesta senza
la chiave giusta. La password non è scritta nel codice — si digita al login e
resta nel browser di ogni dispositivo (`localStorage`).

La chiave è la costante `SECRET` in `docs/apps-script.gs`. Deve essere **lunga
e casuale** (20+ caratteri; genera con `openssl rand -hex 10`). Per cambiarla:
aggiorni `SECRET`, ripubblichi lo script **aggiornando il deployment esistente**
(così l'URL `/exec` non cambia) e rifai il login su ogni dispositivo.

Difese lato Apps Script: confronto della chiave a tempo costante e ritardo di
1 secondo sui tentativi con chiave errata (freno al brute force). La chiave
viaggia sempre nel corpo delle richieste POST, mai nell'URL.

## Sezioni

- **Panoramica** — colpo d'occhio: saldo cassa, articoli sotto scorta, prossima partita
- **Rosa** — giocatori e statistiche (presenze calcolate dagli allenamenti)
- **Allenamenti** — sedute e presenze dei giocatori
- **Calci piazzati** — chi batte e chi va dove sulle palle ferme, con foglio da stampare
- **Distinte** — formazioni per la partita, stampabili
- **Magazzino** — scorte del bar con soglia di riordino
- **Conti** — entrate/uscite, saldo, insoluti (da incassare / da pagare)
- **Spese condivise** — conti in comune con altre società (chi ha anticipato, percentuali, saldo)
- **Documenti** — archivio file della società
- **Archivio** — documenti (fronte/retro) e foto dei tesserati
- **Impostazioni** — gestione delle stagioni

## Stagioni

Il gestionale dura più stagioni. Da **Impostazioni** puoi:

- cambiare la stagione attiva;
- crearne una nuova (parte con le cartelle vuote), con l'opzione di copiare la
  rosa dalla stagione attiva azzerando le statistiche;
- eliminarne una (con tutti i suoi dati).

Ogni stagione tiene i suoi dati separati: la chiave di ogni raccolta è
`<stagione>/<raccolta>` (es. `2026/27/allenamenti`). Sul Drive ogni stagione
diventerà una cartella dedicata con un file per sezione. La logica sta in
`src/season/SeasonContext.tsx`.

## Calci piazzati

Chi batte angoli, punizioni e rimesse, chi attacca i pali quando battiamo noi e
chi sta in barriera (dal primo al quinto), sui pali e sul corto quando battono
loro. Il catalogo degli incarichi è in `src/lib/piazzati.ts`: aggiungerne o
toglierne uno è una riga, la pagina e il foglio stampato si adeguano da soli.

- La scheda è **una per stagione** (collezione `calciPiazzati`) e si salva a
  ogni scelta: non c'è un bottone «salva».
- «Stampa (PDF)» produce un foglio A4 (`src/pages/piazzati/foglio.ts`). Con la
  casella **«Stampa il foglio vuoto»** esce lo stesso foglio senza nomi, da
  riempire a penna.
- In **Distinte**, la casella «Allega il foglio dei calci piazzati» (spenta di
  serie) aggiunge quel foglio vuoto come seconda pagina del PDF della distinta.

## Spese condivise

Le spese divise con un'altra società (campo, manutenzione, pulmino…) stanno in
una sezione loro. Di ogni spesa si segna **quanto è costata in tutto**, **chi
l'ha anticipata** e la **percentuale a carico nostro**: da lì l'app calcola chi
deve dare quanto a chi e lo tiene aperto finché non si salda.

- «Segna come saldata» chiede la data e, se vuoi, crea il **movimento gemello
  nei Conti** (entrata se ci rimborsano, uscita se paghiamo noi). Riaprendo il
  conto il movimento viene tolto, come per i versamenti delle quote.
- Lo **scontrino** si può fotografare o caricare: finisce nella cartella
  Documenti della stagione (rimpicciolito, se è una foto) con un nome
  parlante, e si rivede dalla spesa con l'anteprima di stampa.
- Come i Conti, le spese condivise **non sono divise per stagione**: un conto in
  sospeso non deve sparire al cambio di annata. Sul Drive finiscono in una
  cartella `globale` creata da sola. Per avere anche le colonne leggibili nel
  foglio c'è il pezzo facoltativo `docs/apps-script-spese.gs`.

## Archivio tesserati

Documenti e foto dei tesserati stanno in **due cartelle loro sul Drive**, fuori
dalla cartella del gestionale: sono di prima dell'app e non vanno toccate. I
loro id si impostano nello script (`ARCHIVIO_DOCUMENTI_ID`, `ARCHIVIO_FOTO_ID`).

I file si agganciano ai tesserati leggendone il nome, con la regola già in uso:

- documenti → `Nome_Cognome_fronte.jpg` (oppure `_retro`)
- foto → `NOME COGNOME.jpg`

Il confronto ignora accenti, maiuscole, apostrofi e l'ordine di nome e cognome
(`PERRA ANDREA` trova Andrea Perrà). Chi non corrisponde a nessuno in rosa
finisce in «Senza corrispondenza» e resta dov'è. Per gli **omonimi** serve la
data di nascita nel nome (`Nome_Cognome_12-05-1999_fronte.jpg`): l'app la mette
da sola quando in rosa ci sono due tesserati con lo stesso nome.

Caricando un file si scrivono solo nome, cognome e se è fronte o retro: il nome
lo compone l'app. Le immagini vengono rimpicciolite nel browser (lato max 2000
px, JPEG) prima di partire. Un file con lo stesso nome viene sostituito — nel
cestino del Drive resta comunque recuperabile.

I file **non** vengono condivisi via link: sono documenti d'identità e restano
privati, l'app li legge passando dallo script. Serve il pezzo di codice in
`docs/apps-script-archivio.gs`, con le istruzioni scritte in cima al file;
finché non è incollato, la sezione resta vuota e il resto funziona normalmente.

## Dati e Google Drive

Il Drive **è** il database: non c'è nessun altro server. L'app parla con uno
script Apps Script pubblicato come web app; lo script legge e scrive i fogli
dentro la cartella della società (vedi la struttura in cima al file dello
script). Senza `VITE_DRIVE_URL` l'app ricade sul browser (`localStorage`), che
è il modo di provarla in locale senza toccare i dati veri.

- `src/hooks/useCollection.ts` — l'unico modo in cui le pagine leggono/scrivono i dati
- `src/data/DataProvider.tsx` — carica tutte le raccolte della stagione e le tiene in memoria
- `src/services/driveStore.ts` — il ponte con lo script (POST con la chiave nel corpo)
- `src/services/storage.ts` — il ripiego su localStorage quando il Drive non è configurato
- `src/types.ts` — i modelli dati (una raccolta = un foglio sul Drive)

Le raccolte sono elencate in `src/collections.ts`: aggiungerne una è sicuro,
il foglio nasce al primo salvataggio. `conti` e `speseCondivise` non sono
divise per stagione (vedi `COLLEZIONI_GLOBALI` nel DataProvider).

## Provare in locale senza toccare il Drive

```bash
VITE_DRIVE_URL= npm run dev
```

Così i dati restano nel browser: il login accetta qualsiasi password e le
raccolte si possono precaricare da console con
`localStorage.setItem('usriolunato:2026/27/giocatori', '[...]')`.
