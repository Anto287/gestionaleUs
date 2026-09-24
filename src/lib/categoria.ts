import type { Categoria, Giocatore } from '../types'

/** Categoria del tesserato: giocatore, dirigente o entrambe le cose. */

export function isGiocatore(g: Pick<Giocatore, 'categoria'>): boolean {
  return (g.categoria ?? 'giocatore') !== 'dirigente'
}

export function isDirigente(g: Pick<Giocatore, 'categoria'>): boolean {
  return g.categoria === 'dirigente' || g.categoria === 'entrambi'
}

/** Giocatore "extra": viene una tantum, va tenuto in lista ma non è sempre presente. */
export function isExtra(g: Pick<Giocatore, 'categoria'>): boolean {
  return g.categoria === 'extra'
}

export const LABEL_CATEGORIA: Record<Categoria, string> = {
  giocatore: 'Giocatore',
  dirigente: 'Dirigente',
  entrambi: 'Giocatore e dirigente',
  extra: 'Giocatore Extra',
}

/** Opzioni per i Select. */
export const OPZIONI_CATEGORIA = (
  Object.entries(LABEL_CATEGORIA) as [Categoria, string][]
).map(([value, label]) => ({ value, label }))

/** Incarichi tipici della dirigenza: suggerimenti per il campo (testo libero). */
export const RUOLI_DIRIGENZA = [
  'Presidente',
  'Vicepresidente',
  'Segretario',
  'Direttore sportivo',
  'Team manager',
  'Dirigente accompagnatore',
  'Addetto agli arbitri',
  'Magazziniere',
]

export const OPZIONI_RUOLI_DIRIGENZA = RUOLI_DIRIGENZA.map((r) => ({ value: r }))

/** I campi che valgono solo per chi gioca (via se diventa solo dirigente). */
const SOLO_GIOCATORE = [
  'ruoloPreferito',
  'ruoliAdattati',
  'bravura',
  'numeroMaglia',
  'certificatoMedico',
  'scadenzaCertificato',
  'quotaPagata',
  'quotaImporto',
  'infortunato',
  'rientroInfortunio',
] as const

/**
 * Ripulisce i valori del modulo di un tesserato prima di salvarli: toglie gli
 * spazi ai testi (nome e cognome agganciano archivio e albo d'oro tra le
 * stagioni: " Rossi" e "Rossi" devono essere la stessa persona), svuota i
 * testi lasciati bianchi e scarta i campi rimasti nascosti da un cambio di
 * categoria.
 */
export function ripulisciTesserato<T extends Partial<Giocatore>>(valori: T): T {
  const out: Record<string, unknown> = { ...valori }
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string') out[k] = v.trim() || undefined
  }
  if (typeof valori.nome === 'string') out.nome = valori.nome.trim()
  if (typeof valori.cognome === 'string') out.cognome = valori.cognome.trim()
  if (out.categoria === 'dirigente') for (const k of SOLO_GIOCATORE) out[k] = undefined
  if (out.categoria === 'giocatore' || out.categoria === 'extra') out.ruoloDirigenza = undefined
  if (!out.infortunato) out.rientroInfortunio = undefined
  return out as T
}
