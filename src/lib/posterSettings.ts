/**
 * Preferenze delle grafiche Instagram (pagina "Grafiche IG"), personalizzabili
 * dalle Impostazioni. Restano nel browser di questo dispositivo (localStorage):
 * l'immagine di sfondo sarebbe troppo grande per una cella del foglio Drive.
 */
import { useState } from 'react'

export interface PosterSettings {
  /** immagine di sfondo come dataURL (già compressa) */
  sfondo?: string
  /** intensità del velo scuro sopra la foto, 0..1 (più alto = più scuro) */
  velo: number
  /** a quali grafiche applicare lo sfondo */
  applicaA: 'entrambe' | 'giorno' | 'mese'
  /** testo del piè di pagina (es. @handle o hashtag) */
  piede: string
}

const KEY = 'usriolunato:poster'

export const POSTER_DEFAULT: PosterSettings = {
  velo: 0.55,
  applicaA: 'entrambe',
  piede: '#FORZARIOLUNATO',
}

export function leggiPoster(): PosterSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...POSTER_DEFAULT, ...JSON.parse(raw) } : POSTER_DEFAULT
  } catch {
    return POSTER_DEFAULT
  }
}

function scriviPoster(s: PosterSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* quota piena: teniamo comunque il valore in memoria per questa sessione */
  }
}

/** Se lo sfondo va applicato a una certa grafica ('giorno' | 'mese'). */
export function applicaSfondo(s: PosterSettings, dove: 'giorno' | 'mese'): boolean {
  return !!s.sfondo && (s.applicaA === 'entrambe' || s.applicaA === dove)
}

export function usePosterSettings(): {
  settings: PosterSettings
  aggiorna: (patch: Partial<PosterSettings>) => void
} {
  const [settings, setSettings] = useState<PosterSettings>(leggiPoster)
  const aggiorna = (patch: Partial<PosterSettings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      scriviPoster(next)
      return next
    })
  return { settings, aggiorna }
}

/**
 * Comprime un'immagine (ridimensiona al lato massimo e riesporta in JPEG) così
 * sta comoda in localStorage e html2canvas la disegna in fretta.
 */
export function comprimiImmagine(file: File, maxLato = 1400, qualita = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const scala = Math.min(1, maxLato / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scala))
      const h = Math.max(1, Math.round(img.height * scala))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return rej(new Error('Canvas non disponibile'))
      ctx.drawImage(img, 0, 0, w, h)
      res(canvas.toDataURL('image/jpeg', qualita))
    }
    img.onerror = () => rej(new Error('Immagine non valida'))
    const fr = new FileReader()
    fr.onload = () => {
      img.src = String(fr.result)
    }
    fr.onerror = () => rej(new Error('Lettura file fallita'))
    fr.readAsDataURL(file)
  })
}
