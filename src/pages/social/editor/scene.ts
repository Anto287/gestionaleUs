/**
 * Modello della "scena" dell'editor grafico (Konva) e generatore dei template.
 * La scena è un fondo + una lista di elementi (testi, immagini, forme) a
 * coordinate reali (tela 1080×h). L'editor la disegna e la rende modificabile;
 * l'export la ridisegna a piena risoluzione.
 */
import { ordineRuolo } from '../../../ruoli'

export const DISPLAY = "'Barlow Condensed', 'Inter', sans-serif"
export const BASE = "'Inter', sans-serif"
/** Il serif "da manifesto" del MATCHDAY (si carica solo qui, vedi Editor). */
export const MANIFESTO = "'Playfair Display', Georgia, 'Times New Roman', serif"

/** Font offerti nell'editor: i due caricati dall'app + alcuni di sistema. */
export const FONTS: { label: string; value: string }[] = [
  { label: 'Barlow Condensed', value: DISPLAY },
  { label: 'Inter', value: BASE },
  { label: 'Playfair (manifesto)', value: MANIFESTO },
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
  /** bordo a tema: segue il colore del testo o quello d'accento */
  strokeRuolo?: 'testo' | 'accento'
  /** bordo (colore + spessore), se presente: vince su strokeRuolo */
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

/** Colore effettivo del bordo di un rettangolo (assente = niente bordo). */
export function strokeRett(el: ElRett, col: ColoriTema, accento: string): string | undefined {
  if (el.stroke) return el.stroke
  if (el.strokeRuolo === 'accento') return accento
  if (el.strokeRuolo === 'testo') return col.testo
  return undefined
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
  /** true = si gioca in casa: decide da che parte stanno stemma e punteggio */
  inCasa?: boolean
  /** giorno del mese per il riquadro del manifesto, es. "19" */
  gg?: string
  /** mese per esteso sotto il riquadro, es. "Settembre" */
  mese?: string
  ora?: string
  dove: string
  /** riga libera in fondo, es. "Amichevole Pre-Campionato" */
  nota?: string
  golFatti?: number
  golSubiti?: number
  /** i nostri marcatori, uno per riga (con il minuto, se scritto) */
  marcatori?: string
  /** i marcatori avversari, uno per riga: li scrive l'utente */
  marcatoriLoro?: string
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
  titolari: { giocatoreId?: string; nome: string; role: string; x: number; y: number; numero?: number }[]
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
  /** stagione attiva, per la riga in fondo (es. "2026/27") */
  stagione?: string
  /** stemma della squadra avversaria (dataURL), se caricato */
  crestAvversarioSrc?: string
  /** altezza/larghezza dello stemma avversario, per non schiacciarlo */
  crestAvversarioRapporto?: number
  /** allenatore, sotto l'undici della grafica formazione */
  allenatore?: string
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
    rotation: opt.rotation ?? 0,
    testo: t,
    fontSize,
    fontFamily: opt.fontFamily ?? DISPLAY,
    bold: opt.bold ?? true,
    italic: opt.italic ?? false,
    ruolo,
    letterSpacing: opt.letterSpacing ?? 0,
    align: opt.align ?? 'center',
    width: opt.width ?? 1080,
    fill: opt.fill,
    ombra: opt.ombra,
    chiave: opt.chiave,
    interlinea: opt.interlinea,
  }
}

/** La fascia scura in fondo: stagione a sinistra, hashtag a destra. */
function fasciaInFondo(W: number, H: number, stagione: string, piede: string): Elemento[] {
  const alta = 92
  const y = H - alta
  return [
    {
      id: nid(),
      tipo: 'rett',
      x: 0,
      y,
      rotation: 0,
      larghezza: W,
      altezza: alta,
      cornerRadius: 0,
      fill: 'rgba(0,0,0,0.55)',
    },
    testo(60, y + 33, stagione, 26, 'titolo', {
      fontFamily: BASE,
      align: 'left',
      letterSpacing: 3,
      width: 520,
    }),
    testo(W - 60 - 520, y + 33, piede, 26, 'accento', {
      fontFamily: BASE,
      align: 'right',
      letterSpacing: 3,
      width: 520,
      chiave: 'piede',
    }),
  ]
}

/** Genera la scena iniziale di un template. */
export function buildScene(input: BuildInput, tema: Tema, accento: string): Scena {
  const W = input.formato.w
  const cx = W / 2
  const el: Elemento[] = []
  const push = (e: Elemento) => el.push(e)

  // il file del logo (public/logo.png) è 537×465, più largo che alto:
  // l'altezza segue questa proporzione, altrimenti lo stemma forzato nel
  // quadrato risulta schiacciato in larghezza
  const PROPORZIONE_STEMMA = 465 / 537
  const crest = (x: number, y: number, size: number): ElImmagine => ({
    id: nid(),
    tipo: 'immagine',
    x,
    y,
    rotation: 0,
    src: input.crestSrc,
    larghezza: size,
    altezza: Math.round(size * PROPORZIONE_STEMMA),
  })

  /** Lo stemma avversario caricato dall'utente, con le sue proporzioni. */
  const crestAvv = (x: number, y: number, size: number): ElImmagine | null => {
    if (!input.crestAvversarioSrc) return null
    const rapporto = input.crestAvversarioRapporto || 1
    // il lato lungo resta `size`: un logo largo non sbatte fuori dalla tela
    const larghezza = rapporto > 1 ? Math.round(size / rapporto) : size
    return {
      id: nid(),
      tipo: 'immagine',
      x,
      y,
      rotation: 0,
      src: input.crestAvversarioSrc,
      larghezza,
      altezza: Math.round(larghezza * rapporto),
    }
  }

  const stagioneTxt = `STAGIONE ${input.stagione ?? '2026/27'}`

  if (input.kind === 'annuncio') {
    // Manifesto del giorno partita: foto a tutta tela, banda rossa a destra
    // con l'hashtag in verticale, il riquadro della data in alto a sinistra e
    // il MATCHDAY in grande, con DAY in corsivo che si accavalla a MATCH.
    const g = input.giorno!
    // il layout è disegnato sulla tela del post (1080×1350): sulle storie
    // (1080×1920) le altezze si riproporzionano sulla H vera, così gli
    // elementi si ridistribuiscono invece di ammassarsi in alto
    const sy = (y: number) => Math.round((y / 1350) * input.formato.h)

    // banda rossa a destra + hashtag scritto dall'alto in basso
    const bandaW = 98
    const bandaX = W - bandaW
    push({ id: nid(), tipo: 'rett', x: bandaX, y: 0, rotation: 0, larghezza: bandaW, altezza: input.formato.h, cornerRadius: 0, fill: ROSSO })
    // ruotato di 90° il testo scende: parte dal punto e si sviluppa verso il
    // basso, occupando alla sua sinistra l'altezza di una riga
    push(
      testo(bandaX + (bandaW + 34) / 2, sy(58), input.piede, 34, 'accento', {
        align: 'left',
        width: sy(600),
        letterSpacing: 4,
        rotation: 90,
        chiave: 'piede',
      }),
    )

    // riquadro con il giorno e, sotto, il mese per esteso
    push({ id: nid(), tipo: 'rett', x: 60, y: sy(64), rotation: 0, larghezza: 118, altezza: 124, cornerRadius: 20, fill: 'rgba(0,0,0,0)', strokeRuolo: 'testo', strokeWidth: 3 })
    push(testo(64, sy(64) + 28, g.gg ?? '', 62, 'titolo', { bold: false, fontFamily: MANIFESTO, letterSpacing: 8, width: 118 }))
    push(testo(60, sy(212), g.mese ?? '', 27, 'titolo', { fontFamily: BASE, align: 'left', width: 420 }))

    // stemma in alto, appoggiato alla banda
    push(crest(bandaX - 174, sy(62), 152))

    // ora a sinistra; a destra la sfida, con il tondo del "Vs" in mezzo.
    // La sfida sta alta: sotto deve restare l'aria per il MATCHDAY
    const sfidaY = sy(424)
    if (g.ora) push(testo(96, sfidaY + 12, g.ora, 58, 'titolo', { bold: false, fontFamily: BASE, align: 'left', width: 320 }))
    const vsX = bandaX - 86 // centro del tondo
    push(testo(vsX - 40 - 620, sfidaY, 'U.S. RIOLUNATO', 64, 'titolo', { align: 'right', width: 620 }))
    // gli scostamenti dal tondo restano fissi (non scalati): il "Vs" deve
    // stare in mezzo al cerchio anche sui formati alti. Il 18 è misurato sui
    // pixel: Konva parte dal bordo alto della riga, non dal centro delle lettere
    push({ id: nid(), tipo: 'cerchio', x: vsX, y: sfidaY + 36, rotation: 0, raggio: 34, strokeWidth: 3 })
    push(testo(vsX - 50, sfidaY + 18, 'Vs', 34, 'titolo', { width: 100 }))
    push(testo(vsX + 34 - 620, sfidaY + 72, g.avversario.toUpperCase(), 64, 'titolo', { align: 'right', width: 620 }))

    // il titolo: MATCH dritto e DAY in corsivo, più grande e un po' più in basso
    push(testo(54, sy(560), 'MATCH', 165, 'titolo', { fontFamily: MANIFESTO, align: 'left', width: 900 }))
    push(testo(638, sy(612), 'DAY', 172, 'titolo', { fontFamily: MANIFESTO, italic: true, align: 'left', width: 460 }))
    push(testo(62, sy(738), g.dove, 28, 'titolo', { fontFamily: BASE, align: 'left', letterSpacing: 3, width: 800 }))

    // in fondo: stagione e, se c'è, la riga libera (competizione, note)
    push(testo(60, sy(1238), stagioneTxt, 30, 'titolo', { fontFamily: BASE, align: 'left', letterSpacing: 1, width: 760 }))
    if (g.nota) push(testo(60, sy(1282), g.nota, 30, 'titolo', { bold: false, fontFamily: BASE, align: 'left', width: 760 }))
  } else if (input.kind === 'risultato') {
    // Finale: foto a tutta tela, "FULL TIME" e i due punteggi in due riquadri
    // fra gli stemmi; sotto, i marcatori in due colonne divise da una riga.
    const g = input.giorno!
    const H = input.formato.h
    const sy = (y: number) => Math.round((y / 1350) * H)
    const inCasa = g.inCasa !== false

    push(testo(0, sy(716), 'FULL TIME', 100, 'titolo', { fontFamily: MANIFESTO, italic: true, letterSpacing: 2, width: W }))

    // riga del punteggio: [stemma] [gol] [gol] [stemma], noi dalla parte giusta
    const lato = 154
    const rigaY = sy(878)
    const boxSx = cx - 10 - lato
    const boxDx = cx + 10
    const nostri = g.golFatti ?? 0
    const loro = g.golSubiti ?? 0
    const box = (x: number, valore: number, nostro: boolean) => {
      push({
        id: nid(),
        tipo: 'rett',
        x,
        y: rigaY,
        rotation: 0,
        larghezza: lato,
        altezza: lato,
        cornerRadius: 30,
        fill: 'rgba(0,0,0,0.55)',
        stroke: nostro ? undefined : 'rgba(255,255,255,0.55)',
        strokeRuolo: nostro ? 'accento' : undefined,
        strokeWidth: 3,
      })
      // scostamento misurato sui pixel: Konva parte dal bordo alto della riga e
      // le cifre del Playfair siedono basse (senza correzione stavano 18px sotto
      // il centro). L'11 tiene in mezzo sia le cifre piene sia quelle tonde,
      // che nel serif non hanno la stessa altezza
      push(testo(x, rigaY + 11, String(valore), 96, 'titolo', { fontFamily: MANIFESTO, width: lato }))
    }
    box(boxSx, inCasa ? nostri : loro, inCasa)
    box(boxDx, inCasa ? loro : nostri, !inCasa)

    // stemmi ai lati: il nostro dalla parte del nostro punteggio, l'altro
    // (se caricato) dall'altra; senza logo, al suo posto il nome
    const latoStemma = 140
    const nostroStemma = inCasa ? boxSx - 46 - latoStemma : boxDx + lato + 46
    const altroStemma = inCasa ? boxDx + lato + 46 : boxSx - 46 - latoStemma
    /** lo stemma sta in mezzo all'altezza dei riquadri, qualunque forma abbia */
    const centrato = (el: ElImmagine) => {
      el.y = rigaY + Math.round((lato - el.altezza) / 2)
      return el
    }
    push(centrato(crest(nostroStemma, rigaY, latoStemma)))
    const avv = crestAvv(altroStemma, rigaY, latoStemma)
    if (avv) push(centrato(avv))
    else
      push(
        testo(altroStemma - 40, rigaY + 54, g.avversario.toUpperCase(), 34, 'titolo', {
          width: 220,
          interlinea: 1.1,
        }),
      )

    // marcatori: i nostri dalla nostra parte, l'altra colonna da riempire
    const marcatoriY = sy(1064)
    push({ id: nid(), tipo: 'rett', x: cx - 1, y: marcatoriY, rotation: 0, larghezza: 2, altezza: 118, cornerRadius: 1, fill: 'rgba(255,255,255,0.4)' })
    const nostriMarcatori = g.marcatori?.trim() || '\u2014'
    const loroMarcatori = g.marcatoriLoro?.trim() || '\u2014'
    const colonnaNostra = inCasa
      ? { x: cx - 30 - 420, align: 'right' as const }
      : { x: cx + 30, align: 'left' as const }
    const colonnaLoro = inCasa
      ? { x: cx + 30, align: 'left' as const }
      : { x: cx - 30 - 420, align: 'right' as const }
    push(
      testo(colonnaNostra.x, marcatoriY + 6, nostriMarcatori, 30, 'titolo', {
        bold: false,
        fontFamily: BASE,
        align: colonnaNostra.align,
        width: 420,
        interlinea: 1.35,
      }),
    )
    push(
      testo(colonnaLoro.x, marcatoriY + 6, loroMarcatori, 30, 'titolo', {
        bold: false,
        fontFamily: BASE,
        align: colonnaLoro.align,
        width: 420,
        interlinea: 1.35,
      }),
    )

    fasciaInFondo(W, H, stagioneTxt, input.piede).forEach(push)
  } else if (input.kind === 'formazione') {
    // L'undici in elenco: stemmi in alto a sinistra, "XI" in grande a destra,
    // numero e cognome riga per riga, poi allenatore e panchina.
    const H = input.formato.h
    const sy = (y: number) => Math.round((y / 1350) * H)
    const f = input.formazione

    push(crest(60, sy(64), 112))
    const avv = crestAvv(60 + 112 + 22, sy(64), 112)
    if (avv) push(avv)

    push(testo(W - 60 - 460, sy(52), 'XI', 150, 'titolo', { fontFamily: MANIFESTO, italic: true, align: 'right', width: 460 }))
    if (f?.modulo) {
      push(testo(W - 60 - 460, sy(212), f.modulo, 32, 'sub', { fontFamily: BASE, align: 'right', letterSpacing: 4, width: 460 }))
    }

    if (!f || f.titolari.length === 0) {
      push(
        testo(0, sy(620), 'Seleziona una partita con titolari\no genera una formazione', 44, 'sub', {
          width: W,
          interlinea: 1.3,
        }),
      )
    } else {
      // dal portiere all'attacco, come si legge una formazione
      const titolari = [...f.titolari].sort(
        (a, b) => ordineRuolo(a.role) - ordineRuolo(b.role) || a.x - b.x,
      )
      const passo = 58
      const numeroFine = 548 // dove finiscono i numeri, incolonnati a destra
      titolari.slice(0, 13).forEach((t, i) => {
        const y = sy(296 + i * passo)
        if (t.numero != null) {
          push(
            testo(numeroFine - 120, y + 12, String(t.numero), 30, 'accento', {
              fontFamily: MANIFESTO,
              italic: true,
              align: 'right',
              width: 120,
            }),
          )
        }
        push(
          testo(numeroFine + 26, y, t.nome, 46, 'titolo', {
            bold: false,
            fontFamily: BASE,
            align: 'left',
            width: 480,
          }),
        )
      })
    }

    // riga dorata, poi allenatore e panchina: ancorate in fondo (non in
    // proporzione) così nelle storie non restano a mezz'aria
    const rigaY = H - 350
    push({ id: nid(), tipo: 'rett', x: 60, y: rigaY, rotation: 0, larghezza: W - 120, altezza: 2, cornerRadius: 1, ruoloFill: 'accento', opacita: 0.75 })
    if (input.allenatore?.trim()) {
      push(testo(60, rigaY + 26, input.allenatore.trim(), 32, 'titolo', { bold: false, fontFamily: BASE, align: 'left', width: 620 }))
    }
    if (f?.panchina.length) {
      push(testo(W - 60 - 420, rigaY + 30, 'PANCHINA', 28, 'titolo', { fontFamily: BASE, align: 'right', letterSpacing: 5, width: 420 }))
      push(
        testo(60, rigaY + 86, f.panchina.join('   '), 28, 'titolo', {
          bold: false,
          fontFamily: BASE,
          align: 'left',
          width: W - 120,
          interlinea: 1.4,
        }),
      )
    }

    fasciaInFondo(W, H, stagioneTxt, input.piede).forEach(push)
  } else {
    // Mese: stessa impostazione della formazione (stemma a sinistra, titolo
    // in serif corsivo a destra, fascia in fondo) con le partite in elenco:
    // giorno in grande, avversario, campo e ora riga per riga.
    const H = input.formato.h
    const sy = (y: number) => Math.round((y / 1350) * H)
    // "OTTOBRE 2026" -> "Ottobre" nel titolo, l'anno va nell'etichetta
    const [meseParola = '', anno = ''] = (input.meseTxt ?? '').split(' ')
    const meseTitolo = meseParola.charAt(0) + meseParola.slice(1).toLowerCase()

    push(crest(60, sy(64), 112))
    push(
      testo(W - 60 - 600, sy(70), `APPUNTAMENTI${anno ? ' \u00b7 ' + anno : ''}`, 26, 'accento', {
        fontFamily: BASE,
        align: 'right',
        letterSpacing: 6,
        width: 600,
      }),
    )
    push(testo(W - 60 - 760, sy(104), meseTitolo, 130, 'titolo', { fontFamily: MANIFESTO, italic: true, align: 'right', width: 760 }))

    const fx = input.fixtures ?? []
    // le righe si stringono quando il mese è pieno (tutto scala con la riga);
    // con poche partite il blocco sta in mezzo allo spazio, non appeso in alto
    const inizio = sy(300)
    const spazio = H - 92 - 40 - inizio
    const passo = Math.min(sy(180), spazio / Math.max(1, fx.length))
    const top = inizio + Math.round((spazio - passo * fx.length) / 2)
    const k = Math.min(1.15, passo / 150)
    const z = (n: number) => Math.round(n * k)

    if (fx.length === 0) {
      push(testo(0, sy(620), 'Nessun impegno in questo mese', 44, 'sub', { bold: false, fontFamily: BASE, width: W }))
    }
    fx.forEach((f, i) => {
      const y = Math.round(top + i * passo)
      const oy = y + Math.round((passo - z(96)) / 2)
      if (i > 0) {
        push({ id: nid(), tipo: 'rett', x: 60, y, rotation: 0, larghezza: W - 120, altezza: 1, cornerRadius: 0, ruoloFill: 'accento', opacita: 0.35 })
      }
      // il giorno in serif, color accento; accanto giorno della settimana e mese
      push(testo(40, oy - z(6), f.gg, z(88), 'accento', { fontFamily: MANIFESTO, align: 'right', width: 130 }))
      push(testo(188, oy + z(16), f.dow, z(22), 'titolo', { fontFamily: BASE, align: 'left', letterSpacing: 3, width: 100 }))
      push(testo(188, oy + z(48), f.mmm, z(22), 'sub', { fontFamily: BASE, align: 'left', letterSpacing: 3, width: 100 }))
      // avversario e, sotto, casa/trasferta con il campo
      // un nome lungo si rimpicciolisce invece di andare a capo (il Barlow
      // maiuscolo sta sul mezzo em a lettera)
      const sfida = `vs ${f.avversario.toUpperCase()}`
      const largSfida = W - 300 - 60 - 200
      const corpo = Math.min(z(52), Math.floor(largSfida / (sfida.length * 0.5)))
      push(testo(300, oy + z(4) + Math.round((z(52) - corpo) / 2), sfida, corpo, 'titolo', { align: 'left', width: largSfida }))
      push(
        testo(
          300,
          oy + z(64),
          `${f.inCasa ? 'IN CASA' : 'IN TRASFERTA'}${f.luogo ? ' \u00b7 ' + f.luogo.toUpperCase() : ''}`,
          z(22),
          'sub',
          { bold: false, fontFamily: BASE, align: 'left', letterSpacing: 2, width: W - 300 - 60 },
        ),
      )
      // l'ora sta sulla riga dell'avversario: sotto, il campo ha tutta la larghezza
      push(testo(W - 60 - 190, oy + z(2), f.ora || '\u2014', z(54), 'titolo', { bold: false, fontFamily: BASE, align: 'right', width: 190 }))
    })

    fasciaInFondo(W, H, stagioneTxt, input.piede).forEach(push)
  }

  // le grafiche vivono di foto: niente fascia in cima né cornice (ci pensano
  // la banda rossa o la fascia in fondo). Il velo cambia
  // col mestiere della grafica: il manifesto deve far vedere la squadra, la
  // formazione deve far leggere undici nomi.
  const velo: Record<BuildInput['kind'], number> = {
    annuncio: 0.22,
    risultato: 0.38,
    formazione: 0.46,
    mese: 0.55,
  }
  return {
    tema,
    accento,
    sfondo: { x: 0, y: 0, scala: 1, velo: velo[input.kind] },
    elementi: el,
    fascia: false,
    cornice: false,
  }
}
