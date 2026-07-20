/**
 * Modello della "scena" dell'editor grafico (Konva) e generatore dei template.
 * La scena è un fondo + una lista di elementi (testi, immagini, forme) a
 * coordinate reali (tela 1080×h). L'editor la disegna e la rende modificabile;
 * l'export la ridisegna a piena risoluzione.
 */
export const DISPLAY = "'Barlow Condensed', 'Inter', sans-serif"
export const BASE = "'Inter', sans-serif"

/** Font offerti nell'editor: i due caricati dall'app + alcuni di sistema. */
export const FONTS: { label: string; value: string }[] = [
  { label: 'Barlow Condensed', value: DISPLAY },
  { label: 'Inter', value: BASE },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Times', value: "'Times New Roman', Times, serif" },
  { label: 'Impact', value: "Impact, 'Arial Black', sans-serif" },
  { label: 'Courier', value: "'Courier New', Courier, monospace" },
]

export const ROSSO = '#c22026'
export const ORO = '#e5a800'

export type Tema = 'carta' | 'notte'

/** Ruolo semantico di un elemento: da qui il tema ricava il colore. */
export type Ruolo = 'titolo' | 'testo' | 'sub' | 'accento' | 'inverso'

interface Base {
  id: string
  x: number
  y: number
  rotation: number
  /** blocca la selezione/spostamento (decorazioni gestite a parte non usano questo) */
  bloccato?: boolean
  /** trasparenza 0–1 (assente = 1) */
  opacita?: number
  /** ombra morbida sotto l'elemento */
  ombra?: boolean
}

export interface ElTesto extends Base {
  tipo: 'testo'
  testo: string
  fontSize: number
  fontFamily: string
  bold: boolean
  italic: boolean
  ruolo: Ruolo
  /** colore scelto a mano: se presente vince sul tema */
  fill?: string
  letterSpacing: number
  align: 'left' | 'center' | 'right'
  width: number
  /** interlinea (assente = 1) */
  interlinea?: number
  /** contorno del testo (colore + spessore), stile "sticker" */
  contorno?: string
  contornoSpessore?: number
  /** marcatore stabile per ritrovare un testo speciale (es. il piè di pagina) */
  chiave?: 'piede'
}

export interface ElImmagine extends Base {
  tipo: 'immagine'
  src: string
  larghezza: number
  altezza: number
}

export interface ElRett extends Base {
  tipo: 'rett'
  larghezza: number
  altezza: number
  cornerRadius: number
  /** riempimento a tema: 'accento' (colore accento) o 'tile' (tessera trasferta) */
  ruoloFill?: 'accento' | 'tile'
  fill?: string
  /** bordo (colore + spessore), se presente */
  stroke?: string
  strokeWidth?: number
}

export interface ElCerchio extends Base {
  tipo: 'cerchio'
  raggio: number
  strokeRuolo?: 'accento'
  /** colore bordo scelto a mano: vince su strokeRuolo */
  stroke?: string
  strokeWidth: number
  /** riempimento, se presente (i cerchi dei template sono solo bordo) */
  fill?: string
}

export type Elemento = ElTesto | ElImmagine | ElRett | ElCerchio

export interface Sfondo {
  /** immagine di sfondo (dataURL), se impostata */
  fotoSrc?: string
  x: number
  y: number
  scala: number
  velo: number
  /** tinta unita al posto del gradiente del tema (solo senza foto) */
  colore?: string
}

export interface Scena {
  tema: Tema
  accento: string
  sfondo: Sfondo
  elementi: Elemento[]
  /** decorazioni del template: fascia bicolore in alto e cornice sottile */
  fascia: boolean
  cornice: boolean
}

export interface ColoriTema {
  scuro: boolean
  /** stop del gradiente di fondo (dall'alto in basso) */
  bg: [string, string]
  testo: string
  sub: string
  card: string
  tile: string
  frame: string
}

export function coloriTema(tema: Tema, accento: string, conFoto: boolean): ColoriTema {
  if (tema === 'carta' && !conFoto) {
    return {
      scuro: false,
      bg: ['#fbf8f1', '#f3ede1'],
      testo: '#241d16',
      sub: '#a99e8c',
      card: '#ffffff',
      tile: '#241d16',
      frame: 'rgba(36,29,22,0.16)',
    }
  }
  // notte, oppure carta con foto (testo chiaro sopra il velo)
  return {
    scuro: true,
    bg: ['#2a211a', '#120d09'],
    testo: '#f7f2e8',
    sub: 'rgba(247,242,232,0.62)',
    card: 'rgba(0,0,0,0.34)',
    tile: 'rgba(255,255,255,0.16)',
    frame: withAlpha(accento, 0.5),
  }
}

/** Colore effettivo di un testo: override manuale, o colore del ruolo dal tema. */
export function coloreRuolo(ruolo: Ruolo, col: ColoriTema, accento: string): string {
  switch (ruolo) {
    case 'titolo':
      return col.testo
    case 'sub':
      return col.sub
    case 'accento':
      return accento
    case 'inverso':
      return '#ffffff'
    default:
      return col.testo
  }
}

/** Riempimento effettivo di un rettangolo: override manuale o ruolo a tema. */
export function fillRett(el: ElRett, col: ColoriTema, accento: string): string {
  return el.fill ?? (el.ruoloFill === 'accento' ? accento : el.ruoloFill === 'tile' ? col.tile : '#888888')
}

/** Colore effettivo del bordo di un cerchio: override manuale o ruolo a tema. */
export function strokeCerchio(el: ElCerchio, col: ColoriTema, accento: string): string {
  return el.stroke ?? (el.strokeRuolo === 'accento' ? accento : col.testo)
}

function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

let seq = 0
function nid(): string {
  seq += 1
  return `el${seq}`
}

export interface DatiGiorno {
  avversario: string
  dataTxt: string
  ora?: string
  dove: string
  golFatti?: number
  golSubiti?: number
  marcatori?: string
}
export interface FixtureRiga {
  dow: string
  gg: string
  mmm: string
  avversario: string
  inCasa: boolean
  ora?: string
  luogo?: string
}

/** L'undici titolare per la grafica "Formazione" (dal generatore). */
export interface FormazioneGrafica {
  /** etichetta del modulo, es. "4-4-2" */
  modulo: string
  /** titolari con posizione 0..1 sul campo (y: 0 = difesa, 1 = attacco) */
  titolari: { nome: string; role: string; x: number; y: number; numero?: number }[]
  /** cognomi della panchina */
  panchina: string[]
  /** timestamp di generazione (per la chiave della scena) */
  creata?: number
}

export interface BuildInput {
  kind: 'annuncio' | 'risultato' | 'mese' | 'formazione'
  formato: { w: number; h: number }
  crestSrc: string
  piede: string
  giorno?: DatiGiorno
  meseTxt?: string
  fixtures?: FixtureRiga[]
  formazione?: FormazioneGrafica
}

function testo(
  x: number,
  y: number,
  t: string,
  fontSize: number,
  ruolo: Ruolo,
  opt: Partial<ElTesto> = {},
): ElTesto {
  return {
    id: nid(),
    tipo: 'testo',
    x,
    y,
    rotation: 0,
    testo: t,
    fontSize,
    fontFamily: opt.fontFamily ?? DISPLAY,
    bold: opt.bold ?? true,
    italic: false,
    ruolo,
    letterSpacing: opt.letterSpacing ?? 0,
    align: opt.align ?? 'center',
    width: opt.width ?? 1080,
    fill: opt.fill,
    ombra: opt.ombra,
    chiave: opt.chiave,
  }
}

/** Genera la scena iniziale di un template. */
export function buildScene(input: BuildInput, tema: Tema, accento: string): Scena {
  const W = input.formato.w
  const cx = W / 2
  const el: Elemento[] = []
  const push = (e: Elemento) => el.push(e)

  const crest = (x: number, y: number, size: number): ElImmagine => ({
    id: nid(),
    tipo: 'immagine',
    x,
    y,
    rotation: 0,
    src: input.crestSrc,
    larghezza: size,
    altezza: size,
  })

  if (input.kind === 'annuncio' || input.kind === 'risultato') {
    const g = input.giorno!
    const annuncio = input.kind === 'annuncio'
    push(crest(cx - 75, 70, 150))
    push(testo(0, 250, annuncio ? 'MATCHDAY' : 'FINALE', 30, 'accento', { letterSpacing: 8, width: W }))
    push(testo(0, 430, 'U.S. RIOLUNATO', 84, 'titolo', { letterSpacing: 1, width: W }))

    if (annuncio) {
      push({ id: nid(), tipo: 'cerchio', x: cx, y: 640, rotation: 0, raggio: 62, strokeRuolo: 'accento', strokeWidth: 3 })
      push(testo(cx - 60, 610, 'VS', 58, 'accento', { width: 120 }))
    } else {
      push(testo(0, 560, `${g.golFatti ?? 0}  –  ${g.golSubiti ?? 0}`, 150, 'titolo', { width: W }))
    }

    push(testo(0, annuncio ? 780 : 800, g.avversario.toUpperCase(), 66, 'titolo', { bold: false, width: W }))

    if (!annuncio) {
      const esito =
        (g.golFatti ?? 0) > (g.golSubiti ?? 0)
          ? 'VITTORIA'
          : (g.golFatti ?? 0) < (g.golSubiti ?? 0)
            ? 'SCONFITTA'
            : 'PAREGGIO'
      push(testo(0, 920, esito, 40, 'accento', { letterSpacing: 4, width: W }))
      if (g.marcatori) push(testo(0, 1000, `MARCATORI  ${g.marcatori}`, 28, 'sub', { bold: false, fontFamily: BASE, width: W }))
    }

    push(testo(0, 1120, g.dataTxt, 46, 'titolo', { width: W }))
    if (annuncio) {
      const meta = [g.ora ? `ORE ${g.ora}` : '', g.dove].filter(Boolean).join('   ·   ')
      push(testo(0, 1195, meta, 26, 'sub', { bold: false, fontFamily: BASE, letterSpacing: 2, width: W }))
    }
    push(testo(84, 1258, 'STAGIONE 2026/27', 22, 'testo', { bold: false, fontFamily: BASE, align: 'left', width: 420 }))
    push(testo(W - 504, 1258, input.piede, 22, 'accento', { bold: false, fontFamily: BASE, align: 'right', width: 420, chiave: 'piede' }))
  } else if (input.kind === 'formazione') {
    const H = input.formato.h
    const f = input.formazione
    push(crest(cx - 55, 44, 110))
    push(testo(0, 172, 'FORMAZIONE', 26, 'accento', { letterSpacing: 8, width: W }))
    push(testo(0, 206, f?.modulo ?? '', 84, 'titolo', { width: W }))

    if (!f || f.titolari.length === 0) {
      push(testo(0, H / 2 - 40, 'Genera prima la formazione\nnella pagina Formazione', 44, 'sub', { width: W, interlinea: 1.3 }))
    } else {
      // campo verticale con righe bianche
      const top = 330
      const bottom = H - 190
      const ch = bottom - top
      const bianco = 'rgba(255,255,255,0.85)'
      push({ id: nid(), tipo: 'rett', x: 70, y: top, rotation: 0, larghezza: 940, altezza: ch, cornerRadius: 18, fill: '#2f8f4e' })
      push({ id: nid(), tipo: 'rett', x: 76, y: top + ch / 2 - 2, rotation: 0, larghezza: 928, altezza: 4, cornerRadius: 2, fill: bianco })
      push({ id: nid(), tipo: 'cerchio', x: cx, y: top + ch / 2, rotation: 0, raggio: 92, stroke: bianco, strokeWidth: 3 })
      push({ id: nid(), tipo: 'rett', x: cx - 230, y: top, rotation: 0, larghezza: 460, altezza: 110, cornerRadius: 0, fill: 'rgba(0,0,0,0)', stroke: bianco, strokeWidth: 3 })
      push({ id: nid(), tipo: 'rett', x: cx - 230, y: bottom - 110, rotation: 0, larghezza: 460, altezza: 110, cornerRadius: 0, fill: 'rgba(0,0,0,0)', stroke: bianco, strokeWidth: 3 })

      // titolari: gettone rosso + numero di maglia (o ruolo) dentro + cognome sotto
      for (const t of f.titolari) {
        const px = 70 + (0.06 + t.x * 0.88) * 940
        const py = top + (0.07 + (1 - t.y) * 0.84) * ch
        const dentro = t.numero != null ? String(t.numero) : t.role
        push({ id: nid(), tipo: 'cerchio', x: px, y: py, rotation: 0, raggio: 42, fill: ROSSO, stroke: '#ffffff', strokeWidth: 3, ombra: true })
        push(testo(px - 60, py - (t.numero != null ? 16 : 13), dentro, t.numero != null ? 32 : 24, 'inverso', { width: 120 }))
        push(testo(px - 110, py + 48, t.nome.toUpperCase(), 27, 'inverso', { width: 220, ombra: true }))
      }

      if (f.panchina.length) {
        push(testo(76, H - 172, 'PANCHINA', 22, 'accento', { letterSpacing: 4, align: 'left', width: 400 }))
        push(
          testo(76, H - 140, f.panchina.join(' · '), 24, 'sub', {
            bold: false,
            fontFamily: BASE,
            align: 'left',
            width: W - 152,
            interlinea: 1.25,
          }),
        )
      }
    }

    push(testo(84, H - 52, 'STAGIONE 2026/27', 20, 'testo', { bold: false, fontFamily: BASE, align: 'left', width: 420 }))
    push(testo(W - 504, H - 52, input.piede, 20, 'accento', { bold: false, fontFamily: BASE, align: 'right', width: 420, chiave: 'piede' }))
  } else {
    // mese
    push(testo(76, 96, 'APPUNTAMENTI', 24, 'accento', { fontFamily: BASE, align: 'left', letterSpacing: 3, width: 700 }))
    push(testo(76, 122, input.meseTxt ?? '', 100, 'titolo', { align: 'left', width: 820 }))
    push(crest(W - 76 - 130, 78, 130))
    push(testo(76, 250, 'Le partite del mese', 20, 'sub', { bold: false, fontFamily: BASE, align: 'left', width: 700 }))

    const fx = input.fixtures ?? []
    const top = 330
    const gap = Math.min(150, (input.formato.h - top - 120) / Math.max(1, fx.length))
    fx.forEach((f, i) => {
      const y = top + i * gap
      // medaglione
      push({
        id: nid(),
        tipo: 'rett',
        x: 76,
        y,
        rotation: 0,
        larghezza: 104,
        altezza: 104,
        cornerRadius: 16,
        ruoloFill: f.inCasa ? undefined : 'tile',
        fill: f.inCasa ? ROSSO : undefined,
      })
      push(testo(76, y + 14, f.dow, 15, 'inverso', { bold: true, fontFamily: BASE, letterSpacing: 1, width: 104 }))
      push(testo(76, y + 30, f.gg, 46, 'inverso', { width: 104 }))
      push(testo(76, y + 78, f.mmm, 14, 'inverso', { bold: true, fontFamily: BASE, letterSpacing: 1, width: 104 }))
      // avversario + dove
      push(testo(210, y + 16, `vs ${f.avversario.toUpperCase()}`, 46, 'titolo', { align: 'left', width: 600 }))
      push(
        testo(
          210,
          y + 72,
          `${f.inCasa ? 'IN CASA' : 'IN TRASFERTA'}${f.luogo ? ' · ' + f.luogo.toUpperCase() : ''}`,
          17,
          'sub',
          { bold: false, fontFamily: BASE, align: 'left', letterSpacing: 1, width: 600 },
        ),
      )
      // orario
      push(testo(W - 76 - 240, y + 24, f.ora || '—', 54, 'titolo', { align: 'right', width: 240 }))
    })

    push(testo(76, input.formato.h - 92, 'U.S. RIOLUNATO', 22, 'testo', { bold: false, fontFamily: BASE, align: 'left', width: 420 }))
    push(testo(W - 76 - 420, input.formato.h - 92, input.piede, 22, 'accento', { bold: false, fontFamily: BASE, align: 'right', width: 420, chiave: 'piede' }))
  }

  return {
    tema,
    accento,
    sfondo: { x: 0, y: 0, scala: 1, velo: 0.55 },
    elementi: el,
    fascia: true,
    cornice: input.kind === 'annuncio' || input.kind === 'risultato',
  }
}
