/**
 * Salvataggio nel browser (localStorage).
 *
 * È il RIPIEGO di `driveStore`: quando `config.drive.url` è vuoto (sviluppo in
 * locale, o Drive non ancora configurato) le raccolte vivono qui, con la
 * stessa firma, così le pagine non se ne accorgono. I dati veri stanno sul
 * Drive: vedi `src/services/driveStore.ts`.
 *
 * Le chiavi sono "usriolunato:<stagione>/<raccolta>" (es.
 * "usriolunato:2026/27/allenamenti"); le raccolte non divise per stagione
 * usano "globale" al posto della stagione.
 */

const PREFIX = 'usriolunato:'

export function loadCollection<T>(nome: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + nome)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function saveCollection<T>(nome: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + nome, JSON.stringify(items))
  } catch (err) {
    console.warn(`Salvataggio di "${nome}" non riuscito`, err)
  }
}

export function removeCollection(nome: string): void {
  try {
    localStorage.removeItem(PREFIX + nome)
  } catch (err) {
    console.warn(`Rimozione di "${nome}" non riuscita`, err)
  }
}

export function hasCollection(nome: string): boolean {
  try {
    return localStorage.getItem(PREFIX + nome) !== null
  } catch {
    return false
  }
}

/** Legge un valore singolo (non una raccolta), es. la stagione attiva. */
export function loadValue(nome: string): string | null {
  try {
    return localStorage.getItem(PREFIX + nome)
  } catch {
    return null
  }
}

export function removeValue(nome: string): void {
  try {
    localStorage.removeItem(PREFIX + nome)
  } catch (err) {
    console.warn(`Rimozione di "${nome}" non riuscita`, err)
  }
}

/** I nomi salvati che iniziano per <prefisso> (serve per svuotare le copie locali). */
export function keysWithPrefix(prefisso: string): string[] {
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX + prefisso)) out.push(k.slice(PREFIX.length))
    }
  } catch {
    /* localStorage non disponibile */
  }
  return out
}

export function saveValue(nome: string, valore: string): void {
  try {
    localStorage.setItem(PREFIX + nome, valore)
  } catch (err) {
    console.warn(`Salvataggio di "${nome}" non riuscito`, err)
  }
}
