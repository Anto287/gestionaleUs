/**
 * Supporto per le grafiche social (Instagram): esito di una partita, bilancio
 * di un mese, etichette in italiano da tabellone (maiuscolo) e i formati delle
 * immagini. I colori qui sono valori espliciti: le grafiche si catturano con
 * html2canvas, che non risolve le variabili CSS.
 */
import type { Giocatore, Partita } from '../types'

/** Palette del crest, ripetuta nelle grafiche (niente var CSS per html2canvas). */
export const TINTE = {
  rosso: '#c22026',
  oro: '#e5a800',
  inchiostro: '#241d16',
  notte: '#1a140f',
  carta: '#f5f2eb',
  panna: '#fbf8f1',
  bianco: '#ffffff',
} as const

export type EsitoCode = 'V' | 'P' | 'S'

export interface Esito {
  code: EsitoCode
  /** parola intera per il poster del giorno */
  label: string
  /** colore d'accento (verde vittoria, oro pareggio, rosso sconfitta) */
  colore: string
}

const ESITI: Record<EsitoCode, Esito> = {
  V: { code: 'V', label: 'VITTORIA', colore: '#3f7a52' },
  P: { code: 'P', label: 'PAREGGIO', colore: '#c79a2b' },
  S: { code: 'S', label: 'SCONFITTA', colore: '#c22026' },
}

/** Esito dal punto di vista del Riolunato (golFatti vs golSubiti). */
export function esitoPartita(p: Partita): Esito {
  if (p.golFatti > p.golSubiti) return ESITI.V
  if (p.golFatti < p.golSubiti) return ESITI.S
  return ESITI.P
}

export interface BilancioMese {
  giocate: number
  v: number
  p: number
  s: number
  gf: number
  gs: number
}

/** Somma vittorie/pareggi/sconfitte e gol di un elenco di partite. */
export function bilancioPartite(partite: Partita[]): BilancioMese {
  return partite.reduce<BilancioMese>(
    (acc, p) => {
      const e = esitoPartita(p)
      return {
        giocate: acc.giocate + 1,
        v: acc.v + (e.code === 'V' ? 1 : 0),
        p: acc.p + (e.code === 'P' ? 1 : 0),
        s: acc.s + (e.code === 'S' ? 1 : 0),
        gf: acc.gf + p.golFatti,
        gs: acc.gs + p.golSubiti,
      }
    },
    { giocate: 0, v: 0, p: 0, s: 0, gf: 0, gs: 0 },
  )
}

const fMeseLungo = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const fGiornoLungo = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const fGiornoBreve = new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
const fMeseBreve = new Intl.DateTimeFormat('it-IT', { month: 'short' })

/** Da 'YYYY-MM' a "LUGLIO 2026". */
export function etichettaMese(chiave: string): string {
  const [y, m] = chiave.split('-').map(Number)
  if (!y || !m) return chiave
  return fMeseLungo.format(new Date(y, m - 1, 1)).toUpperCase()
}

/** Da 'YYYY-MM-DD' a "SABATO 12 LUGLIO". */
export function etichettaGiorno(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return fGiornoLungo.format(d).toUpperCase()
}

/** Da 'YYYY-MM-DD' a "SAB" (giorno della settimana breve, maiuscolo). */
export function giornoBreve(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return fGiornoBreve.format(d).replace('.', '').toUpperCase()
}

/** Da 'YYYY-MM-DD' a "SET" (mese breve, maiuscolo). */
export function meseBreve(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return fMeseBreve.format(d).replace('.', '').toUpperCase()
}

/** Il giorno del mese senza zero iniziale, es. "6". */
export function giornoNum(iso: string): string {
  const g = iso.split('-')[2] ?? ''
  return String(Number(g) || g)
}

/** Mappa id giocatore → "Cognome" (o nome se manca il cognome), per i marcatori. */
export function mappaCognomi(giocatori: Giocatore[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const g of giocatori) m[g.id] = g.cognome?.trim() || g.nome?.trim() || '—'
  return m
}

/** "Rossi ×2 · Bianchi" dai marcatori di una partita. */
export function nomiMarcatori(
  marcatori: Partita['marcatori'],
  cognomi: Record<string, string>,
): string {
  return marcatori
    .filter((m) => m.quantita > 0)
    .map((m) => {
      const nome = cognomi[m.giocatoreId] ?? '—'
      return m.quantita > 1 ? `${nome} ×${m.quantita}` : nome
    })
    .join(' · ')
}

export interface FormatoIG {
  chiave: 'post' | 'storia'
  label: string
  w: number
  h: number
}

/** I due formati Instagram: post in feed (4:5) e storia (9:16). */
export const FORMATI_IG: FormatoIG[] = [
  { chiave: 'post', label: 'Post 4:5', w: 1080, h: 1350 },
  { chiave: 'storia', label: 'Storia 9:16', w: 1080, h: 1920 },
]
