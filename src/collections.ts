/**
 * Le raccolte di dati del gestionale. Sul Drive: giocatori, allenamenti,
 * partite, distinte, divise (tute da gara), tornei e i magazzini extra
 * (materiale, manutenzione, borsaMedica) sono un foglio ciascuna dentro la
 * cartella della stagione; conti ("Bilancio") e magazzino (bar) sono un
 * unico foglio nella cartella madre, con una scheda per stagione. Elencarle
 * qui serve per caricarle, copiarle o eliminarle quando si gestiscono le
 * stagioni. Lo script sul Drive crea il foglio di una collezione nuova al
 * primo salvataggio, quindi aggiungerne una qui è sicuro.
 */
export const COLLECTIONS = [
  'giocatori',
  'allenamenti',
  'partite',
  'distinte',
  'magazzino',
  'materiale',
  'manutenzione',
  'borsaMedica',
  'divise',
  'tornei',
  'conti',
  'documenti',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]
