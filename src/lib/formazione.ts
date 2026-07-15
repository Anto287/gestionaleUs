/**
 * Generatore di formazione. Dato un modulo (insieme di slot con ruolo e
 * posizione in campo) e i giocatori disponibili, assegna i titolari
 * privilegiando: ruolo esatto → ruolo adattato → stesso reparto → emergenza,
 * e a parità la qualità del giocatore (bravura, con le presenze come spinta
 * minore). Chi resta va in panchina; gli slot senza nessun adatto restano
 * vuoti, da assegnare a mano.
 */
import type { Giocatore } from '../types'
import { RUOLO_BY_CODE, type Area } from '../ruoli'

/** Uno slot del modulo: ruolo target e posizione (0..1). y: 0 = difesa, 1 = attacco. */
export interface Slot {
  role: string
  x: number
  y: number
}

export interface Modulo {
  id: string
  label: string
  slots: Slot[]
}

/** I moduli disponibili. Le coordinate sono pensate per un campo verticale. */
export const MODULI: Modulo[] = [
  {
    id: '4-4-2',
    label: '4-4-2',
    slots: [
      { role: 'POR', x: 0.5, y: 0.04 },
      { role: 'TD', x: 0.85, y: 0.26 },
      { role: 'DC', x: 0.62, y: 0.22 },
      { role: 'DC', x: 0.38, y: 0.22 },
      { role: 'TS', x: 0.15, y: 0.26 },
      { role: 'ED', x: 0.85, y: 0.55 },
      { role: 'CC', x: 0.6, y: 0.52 },
      { role: 'CC', x: 0.4, y: 0.52 },
      { role: 'ES', x: 0.15, y: 0.55 },
      { role: 'ATT', x: 0.62, y: 0.85 },
      { role: 'ATT', x: 0.38, y: 0.85 },
    ],
  },
  {
    id: '4-3-3',
    label: '4-3-3',
    slots: [
      { role: 'POR', x: 0.5, y: 0.04 },
      { role: 'TD', x: 0.85, y: 0.26 },
      { role: 'DC', x: 0.62, y: 0.22 },
      { role: 'DC', x: 0.38, y: 0.22 },
      { role: 'TS', x: 0.15, y: 0.26 },
      { role: 'CDC', x: 0.5, y: 0.48 },
      { role: 'CC', x: 0.7, y: 0.56 },
      { role: 'CC', x: 0.3, y: 0.56 },
      { role: 'AD', x: 0.82, y: 0.85 },
      { role: 'ATT', x: 0.5, y: 0.88 },
      { role: 'AS', x: 0.18, y: 0.85 },
    ],
  },
  {
    id: '3-5-2',
    label: '3-5-2',
    slots: [
      { role: 'POR', x: 0.5, y: 0.04 },
      { role: 'DC', x: 0.72, y: 0.24 },
      { role: 'DC', x: 0.5, y: 0.2 },
      { role: 'DC', x: 0.28, y: 0.24 },
      { role: 'ED', x: 0.9, y: 0.52 },
      { role: 'CC', x: 0.66, y: 0.56 },
      { role: 'CDC', x: 0.5, y: 0.46 },
      { role: 'CC', x: 0.34, y: 0.56 },
      { role: 'ES', x: 0.1, y: 0.52 },
      { role: 'ATT', x: 0.62, y: 0.86 },
      { role: 'SP', x: 0.38, y: 0.86 },
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      { role: 'POR', x: 0.5, y: 0.04 },
      { role: 'TD', x: 0.85, y: 0.24 },
      { role: 'DC', x: 0.62, y: 0.2 },
      { role: 'DC', x: 0.38, y: 0.2 },
      { role: 'TS', x: 0.15, y: 0.24 },
      { role: 'CDC', x: 0.62, y: 0.44 },
      { role: 'CDC', x: 0.38, y: 0.44 },
      { role: 'AD', x: 0.85, y: 0.66 },
      { role: 'COC', x: 0.5, y: 0.64 },
      { role: 'AS', x: 0.15, y: 0.66 },
      { role: 'ATT', x: 0.5, y: 0.9 },
    ],
  },
  {
    id: '3-4-3',
    label: '3-4-3',
    slots: [
      { role: 'POR', x: 0.5, y: 0.04 },
      { role: 'DC', x: 0.72, y: 0.24 },
      { role: 'DC', x: 0.5, y: 0.2 },
      { role: 'DC', x: 0.28, y: 0.24 },
      { role: 'ED', x: 0.85, y: 0.52 },
      { role: 'CC', x: 0.6, y: 0.5 },
      { role: 'CC', x: 0.4, y: 0.5 },
      { role: 'ES', x: 0.15, y: 0.52 },
      { role: 'AD', x: 0.8, y: 0.86 },
      { role: 'ATT', x: 0.5, y: 0.88 },
      { role: 'AS', x: 0.2, y: 0.86 },
    ],
  },
]

/** Quanto un giocatore calza in un ruolo. */
export type Fit = 'esatto' | 'adattato' | 'reparto' | 'emergenza' | 'no'

/** Reparti confinanti, per gli adattamenti d'emergenza. */
const ADIACENTI: Record<Area, Area[]> = {
  Portiere: [],
  Difesa: ['Centrocampo'],
  Centrocampo: ['Difesa', 'Attacco'],
  Attacco: ['Centrocampo'],
}

function areaDi(code?: string): Area | undefined {
  return code ? RUOLO_BY_CODE[code]?.area : undefined
}

/** Insieme dei reparti che il giocatore copre (ruolo preferito + adattati). */
function areeGiocatore(g: Giocatore): Set<Area> {
  const aree = new Set<Area>()
  const ap = areaDi(g.ruoloPreferito)
  if (ap) aree.add(ap)
  for (const r of g.ruoliAdattati ?? []) {
    const a = areaDi(r)
    if (a) aree.add(a)
  }
  return aree
}

/** Calcola il livello di adattamento di un giocatore a un ruolo. */
export function fitGiocatore(g: Giocatore, role: string): Fit {
  const target = areaDi(role)
  if (!target) return 'no'
  if (g.ruoloPreferito === role) return 'esatto'
  if ((g.ruoliAdattati ?? []).includes(role)) return 'adattato'

  const aree = areeGiocatore(g)
  // il portiere è un mondo a parte: nessuno entra o esce dalla porta per adattamento
  if (target === 'Portiere' || aree.has('Portiere')) return 'no'
  if (aree.has(target)) return 'reparto'
  if ([...aree].some((a) => ADIACENTI[target].includes(a))) return 'emergenza'
  return 'no'
}

/** Etichetta breve per l'adattamento (null se è nel suo ruolo). */
export function etichettaFit(fit: Fit): string | null {
  if (fit === 'esatto') return null
  if (fit === 'emergenza') return 'emergenza'
  return 'adattato'
}

const RANK: Record<Fit, number> = { esatto: 4, adattato: 3, reparto: 2, emergenza: 1, no: 0 }

/** Qualità del giocatore: bravura (0/non impostata = neutro 3) pesata più delle presenze. */
export function qualita(g: Giocatore, presenze: Record<string, number>, maxPres: number): number {
  const bravura = (g.bravura || 3) / 5
  const pres = maxPres > 0 ? (presenze[g.id] ?? 0) / maxPres : 0
  return bravura * 0.7 + pres * 0.3
}

export interface Assegnazione {
  giocatoreId: string
  fit: Fit
}

export interface Formazione {
  /** per ogni slot del modulo: assegnazione o null (vuoto) */
  titolari: (Assegnazione | null)[]
  /** id dei disponibili non schierati, dai migliori */
  panchina: string[]
}

/**
 * Genera la formazione. Procede a ondate per livello di adattamento (prima
 * tutti i ruoli esatti, poi gli adattati, ecc.), e dentro ogni ondata assegna
 * i giocatori dal migliore. Se `emergenza` è false non usa gli adattamenti fra
 * reparti confinanti (lascia lo slot vuoto).
 */
export function generaFormazione(
  modulo: Modulo,
  disponibili: Giocatore[],
  presenze: Record<string, number>,
  opts: { emergenza?: boolean } = {},
): Formazione {
  const maxPres = Math.max(0, ...Object.values(presenze))
  const q = (g: Giocatore) => qualita(g, presenze, maxPres)

  const titolari: (Assegnazione | null)[] = modulo.slots.map(() => null)
  const usati = new Set<string>()

  const ondate: Fit[] =
    opts.emergenza === false ? ['esatto', 'adattato', 'reparto'] : ['esatto', 'adattato', 'reparto', 'emergenza']

  for (const fit of ondate) {
    const coppie: { slot: number; id: string; qual: number }[] = []
    modulo.slots.forEach((s, i) => {
      if (titolari[i]) return
      for (const g of disponibili) {
        if (usati.has(g.id)) continue
        if (fitGiocatore(g, s.role) === fit) coppie.push({ slot: i, id: g.id, qual: q(g) })
      }
    })
    // i più forti scelgono per primi
    coppie.sort((a, b) => b.qual - a.qual)
    for (const c of coppie) {
      if (titolari[c.slot] || usati.has(c.id)) continue
      titolari[c.slot] = { giocatoreId: c.id, fit }
      usati.add(c.id)
    }
  }

  const panchina = disponibili
    .filter((g) => !usati.has(g.id))
    .sort((a, b) => q(b) - q(a))
    .map((g) => g.id)

  return { titolari, panchina }
}

/** Quanto un modulo si adatta ai giocatori disponibili. */
export interface ValutazioneModulo {
  pieni: number
  esatti: number
  adattati: number
  reparto: number
  emergenze: number
  vuoti: number
  /** punteggio complessivo per il confronto fra moduli */
  punteggio: number
}

export function valutaModulo(
  modulo: Modulo,
  disponibili: Giocatore[],
  presenze: Record<string, number>,
): ValutazioneModulo {
  const f = generaFormazione(modulo, disponibili, presenze)
  let esatti = 0,
    adattati = 0,
    reparto = 0,
    emergenze = 0
  for (const a of f.titolari) {
    if (!a) continue
    if (a.fit === 'esatto') esatti++
    else if (a.fit === 'adattato') adattati++
    else if (a.fit === 'reparto') reparto++
    else if (a.fit === 'emergenza') emergenze++
  }
  const pieni = esatti + adattati + reparto + emergenze
  const vuoti = modulo.slots.length - pieni
  // riempire gli slot conta molto; poi si premia chi gioca nel suo ruolo
  const punteggio = pieni * 100 + esatti * 10 + adattati * 5 + reparto * 2 - emergenze * 4 - vuoti * 40
  return { pieni, esatti, adattati, reparto, emergenze, vuoti, punteggio }
}

/** Tutti i moduli ordinati dal più adatto ai giocatori disponibili. */
export function classificaModuli(
  disponibili: Giocatore[],
  presenze: Record<string, number>,
): { modulo: Modulo; val: ValutazioneModulo }[] {
  return MODULI.map((modulo) => ({ modulo, val: valutaModulo(modulo, disponibili, presenze) })).sort(
    (a, b) => b.val.punteggio - a.val.punteggio || b.val.esatti - a.val.esatti,
  )
}

/** I candidati di panchina per uno slot, ordinati per adattamento poi qualità. */
export function candidatiPerSlot(
  role: string,
  panchinaIds: string[],
  byId: Map<string, Giocatore>,
  presenze: Record<string, number>,
): { id: string; fit: Fit }[] {
  const maxPres = Math.max(0, ...Object.values(presenze))
  return panchinaIds
    .map((id) => ({ id, g: byId.get(id)! }))
    .filter((x) => x.g && fitGiocatore(x.g, role) !== 'no')
    .map((x) => ({ id: x.id, fit: fitGiocatore(x.g, role), qual: qualita(x.g, presenze, maxPres) }))
    .sort((a, b) => RANK[b.fit] - RANK[a.fit] || b.qual - a.qual)
    .map((x) => ({ id: x.id, fit: x.fit }))
}
