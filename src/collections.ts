/**
 * Le raccolte di dati del gestionale. Ognuna, per ogni stagione,
 * diventerà un file dentro la cartella della stagione sul Drive.
 * Elencarle qui serve per copiarle o eliminarle quando si gestiscono
 * le stagioni.
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
