/**
 * Collegamento a Google Drive — da implementare.
 *
 * Il Drive farà da database: ogni raccolta (giocatori, allenamenti,
 * distinte, magazzino, movimenti, documenti) sarà un file nella cartella
 * della società.
 *
 * Piano previsto:
 * 1. Accesso con Google Identity Services (OAuth 2.0, scope `drive.file`),
 *    così l'app vede solo i file che crea lei.
 * 2. Una cartella "U.S. Riolunato" con un file JSON per raccolta e una
 *    sottocartella "Documenti" per gli allegati veri.
 * 3. `leggiRaccolta` / `scriviRaccolta` sostituiranno il localStorage in
 *    `services/storage.ts`: stessa firma, così le pagine non cambiano.
 *
 * Dipendenze da aggiungere quando si implementa:
 *   (Google Identity Services si carica via <script> da accounts.google.com)
 */

export interface StatoDrive {
  collegato: boolean
  email?: string
}

export function statoDrive(): StatoDrive {
  return { collegato: false }
}

export async function collegaDrive(): Promise<StatoDrive> {
  throw new Error('Collegamento a Google Drive non ancora implementato.')
}
