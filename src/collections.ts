/**
 * Le raccolte di dati del gestionale. Sul Drive: giocatori, allenamenti,
 * partite, distinte, divise (tute da gara), tornei e i magazzini extra
 * (materiale, manutenzione, borsaMedica) sono un foglio ciascuna dentro la
 * cartella della stagione; conti ("Bilancio") e magazzino (bar) sono un
 * unico foglio nella cartella madre, con una scheda per stagione. Elencarle
 * qui serve per caricarle, copiarle o eliminarle quando si gestiscono le
 * stagioni. Anche speseCondivise (i conti in sospeso con le altre società)
 * e avversari (le schede delle squadre affrontate) stanno fuori dalle
 * stagioni, come i conti. Lo script sul Drive crea il foglio di una collezione nuova al
 * primo salvataggio, quindi aggiungerne una qui è sicuro.
 */
export const COLLECTIONS = [
  'giocatori',
  'allenamenti',
  'partite',
  'appuntamenti',
  'promemoria',
  'distinte',
  'calciPiazzati',
  'magazzino',
  'materiale',
  'manutenzione',
  'borsaMedica',
  'divise',
  'tornei',
  'conti',
  'speseCondivise',
  'avversari',
  'loghi',
  'documenti',
  'liste',
  'righeLista',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]

// Raccolte condivise tra le stagioni.
const COLLEZIONI_GLOBALI = new Set(['conti', 'speseCondivise', 'avversari', 'loghi'])

export function seasonDi(collection: string, attiva: string): string {
  return COLLEZIONI_GLOBALI.has(collection) ? 'globale' : attiva
}

export function richiesteRaccolte(attiva: string) {
  return COLLECTIONS.map((collection) => ({ collection, season: seasonDi(collection, attiva) }))
}
