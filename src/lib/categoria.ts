import type { Categoria, Giocatore } from '../types'

/** Categoria del tesserato: giocatore, dirigente o entrambe le cose. */

export function isGiocatore(g: Pick<Giocatore, 'categoria'>): boolean {
  return (g.categoria ?? 'giocatore') !== 'dirigente'
}

export function isDirigente(g: Pick<Giocatore, 'categoria'>): boolean {
  return g.categoria === 'dirigente' || g.categoria === 'entrambi'
}

export const LABEL_CATEGORIA: Record<Categoria, string> = {
  giocatore: 'Giocatore',
  dirigente: 'Dirigente',
  entrambi: 'Giocatore e dirigente',
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
