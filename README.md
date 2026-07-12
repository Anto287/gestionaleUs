# U.S. Riolunato — Gestionale

Web app in React + TypeScript + Vite per gestire la società.
Design minimal, accesso protetto da password, dati destinati a Google Drive.

## Avvio

```bash
npm install
npm run dev
```

## Accesso

All'apertura viene chiesta una password (blocco lato browser, non una vera
protezione). La imposti in `src/config.ts` → `gatePassword`. La sicurezza vera
arriverà con l'accesso a Google quando si collegherà il Drive.

## Sezioni

- **Panoramica** — colpo d'occhio: saldo cassa, articoli sotto scorta, prossima partita
- **Rosa** — giocatori e statistiche (presenze calcolate dagli allenamenti)
- **Allenamenti** — sedute e presenze dei giocatori
- **Distinte** — formazioni per la partita, stampabili
- **Magazzino** — scorte del bar con soglia di riordino
- **Conti** — entrate/uscite, saldo, insoluti (da incassare / da pagare)
- **Documenti** — archivio file della società
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

## Dati e Google Drive

Oggi i dati sono salvati nel browser (`localStorage`), così l'app è già usabile.
Il Drive farà da "database": è tutto pronto per l'aggancio.

- `src/hooks/useCollection.ts` — l'unico modo in cui le pagine leggono/scrivono i dati
- `src/services/storage.ts` — implementazione attuale (localStorage); **qui** si innesta il Drive
- `src/services/drive.ts` — stub e piano del collegamento (OAuth + Drive API)
- `src/types.ts` — i modelli dati (una raccolta = un file sul Drive)

Cambiando solo `storage.ts` (da localStorage a lettura/scrittura su Drive) le
pagine continuano a funzionare senza modifiche.

## Prossimi passi

1. Client ID OAuth dalla Google Cloud Console (scope `drive.file`)
2. Accesso con Google Identity Services
3. Una cartella "U.S. Riolunato" sul Drive, con una sottocartella per stagione
   e un file per raccolta
4. Riscrivere `storage.ts` per leggere/scrivere su quei file
