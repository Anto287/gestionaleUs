/**
 * Esporta la scena come PowerPoint (.pptx) a elementi separati: Canva lo
 * importa come design modificabile, con ogni testo, forma e immagine
 * spostabile a sé. Il PNG invece arriva a Canva come un'unica immagine.
 *
 * Unità: la tela è in px (1080 di larghezza); la slide in pollici a 96 dpi,
 * i font e gli spessori in punti (1 px = 0,75 pt).
 */
import {
  coloreRuolo,
  coloriTema,
  fillRett,
  strokeCerchio,
  strokeRett,
  ORO,
  ROSSO,
  type ElTesto,
  type Scena,
} from './scene'

const IN = (px: number) => px / 96
const PT = (px: number) => px * 0.75

/** Margine in più sulla larghezza dei testi: i font di PowerPoint/Canva
 *  misurano un filo diversamente e senza aria andrebbero a capo. */
const ARIA_TESTO = 0.04

const OMBRA = { type: 'outer', color: '120C07', opacity: 0.6, blur: PT(18), offset: PT(8), angle: 90 } as const

interface Colore {
  color: string
  /** trasparenza 0–100 come la vuole PowerPoint */
  transparency: number
}

/** '#rgb', '#rrggbb' o 'rgba(r,g,b,a)' → colore esadecimale + trasparenza. */
function colore(c: string, opacita = 1): Colore {
  const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  let rgb = '888888'
  let alfa = 1
  const s = c.trim()
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(s)
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(',').map((v) => parseFloat(v))
    rgb = hex2(r) + hex2(g) + hex2(b)
    if (a !== undefined && !isNaN(a)) alfa = a
  } else {
    const h = s.replace('#', '')
    if (/^[0-9a-f]{3}$/i.test(h)) rgb = h.split('').map((x) => x + x).join('')
    else if (/^[0-9a-f]{6}$/i.test(h)) rgb = h
  }
  return { color: rgb.toUpperCase(), transparency: Math.round((1 - alfa * opacita) * 100) }
}

/** Primo nome di una lista font CSS ("'Barlow Condensed', 'Inter'…" → Barlow Condensed). */
function nomeFont(famiglia: string): string {
  return famiglia.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Konva ruota attorno all'angolo in alto a sinistra, PowerPoint attorno al
 * centro: dal riquadro locale (dx dallo spigolo, larghezza, altezza) ricava
 * la posizione da dare a PowerPoint perché il risultato coincida.
 */
function posizione(x: number, y: number, rot: number, dx: number, w: number, h: number) {
  const t = (rot * Math.PI) / 180
  const lx = dx + w / 2
  const ly = h / 2
  const cx = x + lx * Math.cos(t) - ly * Math.sin(t)
  const cy = y + lx * Math.sin(t) + ly * Math.cos(t)
  return { x: IN(cx - w / 2), y: IN(cy - h / 2), w: IN(w), h: IN(h), rotate: rot || undefined }
}

/** Le immagini vanno dentro il file: gli indirizzi (es. lo stemma) diventano dataURL. */
async function comeDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  const blob = await (await fetch(src)).blob()
  return new Promise((risolvi, rifiuta) => {
    const r = new FileReader()
    r.onload = () => risolvi(r.result as string)
    r.onerror = () => rifiuta(r.error)
    r.readAsDataURL(blob)
  })
}

/** Gradiente verticale come PNG (PowerPoint via pptxgenjs non ha i gradienti). */
function gradientePng(stops: [number, string][]): string {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 512
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, c.height)
  for (const [o, col] of stops) g.addColorStop(o, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  return c.toDataURL('image/png')
}

export interface OpzioniCanva {
  scena: Scena
  W: number
  H: number
  /** riquadro della foto di sfondo com'è sulla tela (null senza foto) */
  fotoBox: { x: number; y: number; dw: number; dh: number } | null
  /** stop del velo sopra la foto, gli stessi della tela */
  veloStops: [number, string][]
  /** altezza reale di un testo misurata da Konva (dipende dagli a capo) */
  altezzaTesto: (el: ElTesto) => number
  nomeFile: string
}

export async function esportaCanva(o: OpzioniCanva): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const { scena, W, H } = o
  const col = coloriTema(scena.tema, scena.accento, !!scena.sfondo.fotoSrc)

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'GRAFICA', width: IN(W), height: IN(H) })
  pptx.layout = 'GRAFICA'
  const slide = pptx.addSlide()

  // fondo: foto (spostabile e sostituibile in Canva) + velo, tinta unita o gradiente del tema
  if (scena.sfondo.fotoSrc && o.fotoBox) {
    const f = o.fotoBox
    slide.addImage({
      data: scena.sfondo.fotoSrc,
      x: IN(f.x),
      y: IN(f.y),
      w: IN(f.dw),
      h: IN(f.dh),
      objectName: 'Foto di sfondo',
    })
    slide.addImage({ data: gradientePng(o.veloStops), x: 0, y: 0, w: IN(W), h: IN(H), objectName: 'Velo' })
  } else if (scena.sfondo.colore) {
    slide.background = { color: colore(scena.sfondo.colore).color }
  } else {
    slide.addImage({
      data: gradientePng([
        [0, col.bg[0]],
        [1, col.bg[1]],
      ]),
      x: 0,
      y: 0,
      w: IN(W),
      h: IN(H),
      objectName: 'Sfondo',
    })
  }

  // decorazioni del template
  if (scena.fascia) {
    const taglio = W * 0.62
    slide.addShape('rect', { x: 0, y: 0, w: IN(taglio), h: IN(18), fill: colore(ROSSO), objectName: 'Fascia rossa' })
    slide.addShape('rect', { x: IN(taglio), y: 0, w: IN(W - taglio), h: IN(18), fill: colore(ORO), objectName: 'Fascia oro' })
  }
  if (scena.cornice) {
    const bordo = colore(col.frame)
    slide.addShape('roundRect', {
      x: IN(34),
      y: IN(40),
      w: IN(W - 68),
      h: IN(H - 74),
      rectRadius: IN(8),
      fill: { type: 'none' },
      line: { color: bordo.color, transparency: bordo.transparency, width: PT(1.5) },
      objectName: 'Cornice',
    })
  }

  for (const el of scena.elementi) {
    const opacita = el.opacita ?? 1
    const ombra = el.ombra ? { shadow: { ...OMBRA } } : {}

    if (el.tipo === 'testo') {
      const h = Math.max(o.altezzaTesto(el), el.fontSize)
      const extra = el.width * ARIA_TESTO
      const dx = el.align === 'center' ? -extra / 2 : el.align === 'right' ? -extra : 0
      const fill = colore(el.fill ?? coloreRuolo(el.ruolo, col, scena.accento), opacita)
      slide.addText(el.testo, {
        ...posizione(el.x, el.y, el.rotation, dx, el.width + extra, h),
        fontFace: nomeFont(el.fontFamily),
        fontSize: PT(el.fontSize),
        bold: el.bold,
        italic: el.italic,
        color: fill.color,
        transparency: fill.transparency || undefined,
        align: el.align,
        valign: 'top',
        charSpacing: el.letterSpacing ? PT(el.letterSpacing) : undefined,
        // interlinea "esatta" come Konva (righe alte fontSize × interlinea)
        lineSpacing: PT(el.fontSize * (el.interlinea ?? 1)),
        margin: 0,
        wrap: true,
        fit: 'none',
        outline: el.contorno
          ? { color: colore(el.contorno).color, size: PT(el.contornoSpessore ?? 2) }
          : undefined,
        objectName: el.testo.split('\n')[0].slice(0, 40) || 'Testo',
        ...ombra,
      })
    } else if (el.tipo === 'immagine') {
      slide.addImage({
        data: await comeDataUrl(el.src),
        ...posizione(el.x, el.y, el.rotation, 0, el.larghezza, el.altezza),
        transparency: opacita < 1 ? Math.round((1 - opacita) * 100) : undefined,
        objectName: 'Immagine',
        ...ombra,
      })
    } else if (el.tipo === 'rett') {
      const bordo = strokeRett(el, col, scena.accento)
      const lb = bordo ? colore(bordo, opacita) : null
      slide.addShape(el.cornerRadius > 0 ? 'roundRect' : 'rect', {
        ...posizione(el.x, el.y, el.rotation, 0, el.larghezza, el.altezza),
        rectRadius: el.cornerRadius > 0 ? IN(Math.min(el.cornerRadius, el.larghezza / 2, el.altezza / 2)) : undefined,
        fill: colore(fillRett(el, col, scena.accento), opacita),
        line: lb
          ? { color: lb.color, transparency: lb.transparency, width: PT(el.strokeWidth ?? 3) }
          : { type: 'none' },
        objectName: 'Rettangolo',
        ...ombra,
      })
    } else {
      // cerchio: in Konva x/y sono il centro
      const bordo = colore(strokeCerchio(el, col, scena.accento), opacita)
      slide.addShape('ellipse', {
        x: IN(el.x - el.raggio),
        y: IN(el.y - el.raggio),
        w: IN(el.raggio * 2),
        h: IN(el.raggio * 2),
        fill: el.fill ? colore(el.fill, opacita) : { type: 'none' },
        line: el.strokeWidth > 0 ? { ...bordo, width: PT(el.strokeWidth) } : { type: 'none' },
        objectName: 'Cerchio',
        ...ombra,
      })
    }
  }

  await pptx.writeFile({ fileName: o.nomeFile, compression: true })
}
