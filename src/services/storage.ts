/**
 * Livello dati del gestionale.
 *
 * Oggi salva tutto nel browser (localStorage), così l'app è già usabile.
 * I dati sono divisi per stagione: la chiave di ogni raccolta è
 * "<stagione>/<raccolta>" (es. "2026/27/allenamenti"). Cambiare stagione
 * significa leggere/scrivere un altro gruppo di file.
 *
 * Domani questo è l'unico file da cambiare per usare Google Drive come
 * "database": ogni stagione sarà una cartella e ogni raccolta un file al
 * suo interno. Le pagine non dovranno cambiare, perché usano solo l'hook
 * `useCollection`.
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

export function saveValue(nome: string, valore: string): void {
  try {
    localStorage.setItem(PREFIX + nome, valore)
  } catch (err) {
    console.warn(`Salvataggio di "${nome}" non riuscito`, err)
  }
}
