/** Utilità condivise per i grafici SVG (fatti a mano, senza librerie). */
import { useEffect, useRef, useState } from 'react'

/** Palette dei grafici, coerente con l'identità giallorossa dell'app. */
export const COLORI = {
  rosso: '#c22026',
  rossoTenue: 'rgba(194, 32, 38, 0.12)',
  verde: '#3f7a52',
  oro: '#e5a800',
  griglia: '#ece4d6',
  asse: '#c9bfad',
  testo: '#9a948a',
}

/**
 * Larghezza del contenitore, aggiornata al ridimensionamento: così l'SVG
 * si disegna alla larghezza reale in pixel (nitido, non deformato) e resta
 * responsivo. Restituisce [ref, larghezza].
 */
export function useLarghezza<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [larghezza, setLarghezza] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setLarghezza(e.contentRect.width)
    })
    ro.observe(el)
    setLarghezza(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, larghezza] as const
}

/**
 * Tacche "belle" per un asse da 0 a max: passi 1/2/5 × potenza di 10.
 * Es. max 23 → [0,5,10,15,20]; max 1400 → [0,500,1000].
 */
export function tacche(max: number, n = 4): number[] {
  if (!(max > 0)) return [0]
  const grezzo = max / n
  const mag = Math.pow(10, Math.floor(Math.log10(grezzo)))
  const norm = grezzo / mag
  const passo = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const out: number[] = []
  for (let v = 0; v <= max + 1e-9; v += passo) out.push(Math.round(v * 1000) / 1000)
  return out
}

/** Percorso SVG di una barra con gli angoli superiori arrotondati. */
export function barraArrotondata(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return (
    `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} ` +
    `L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
  )
}
