/**
 * Le raccolte di dati del gestionale. Sul Drive: giocatori, allenamenti,
 * partite e distinte sono un foglio ciascuna dentro la cartella della
 * stagione; conti ("Bilancio") e magazzino sono un unico foglio nella
 * cartella madre, con una scheda per stagione. Elencarle qui serve per
 * copiarle o eliminarle quando si gestiscono le stagioni.
 */
export const COLLECTIONS = [
  'giocatori',
  'allenamenti',
  'partite',
  'distinte',
  'magazzino',
  'conti',
  'documenti',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]
