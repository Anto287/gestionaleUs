import { useEffect, useRef, useState } from 'react'

/**
 * Dettatura vocale col riconoscimento del browser (Web Speech API), in
 * italiano. Niente servizi da configurare: dove il browser non la supporta,
 * `supportata` è false e il microfono non si mostra. Il testo riconosciuto
 * arriva a `onTesto` anche mentre si parla (risultati provvisori compresi).
 */

interface IstanzaRiconoscimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: EventoRisultato) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
interface EventoRisultato {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
type CostruttoreRiconoscimento = new () => IstanzaRiconoscimento

function costruttore(): CostruttoreRiconoscimento | undefined {
  const w = window as unknown as Record<string, CostruttoreRiconoscimento | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function useDettatura(onTesto: (testo: string) => void) {
  const [ascolto, setAscolto] = useState(false)
  const attivo = useRef<IstanzaRiconoscimento | null>(null)
  const consegna = useRef(onTesto)
  consegna.current = onTesto

  // se il componente sparisce mentre si sta parlando, si spegne tutto
  useEffect(() => () => attivo.current?.abort(), [])

  const supportata = typeof window !== 'undefined' && !!costruttore()

  function avvia() {
    const Riconoscimento = costruttore()
    if (!Riconoscimento || attivo.current) return
    const r = new Riconoscimento()
    r.lang = 'it-IT'
    r.continuous = false // si ferma da solo quando smetti di parlare
    r.interimResults = true
    r.onresult = (e) => {
      const testo = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
        .join(' ')
        .trim()
      if (testo) consegna.current(testo)
    }
    r.onend = () => {
      attivo.current = null
      setAscolto(false)
    }
    r.onerror = () => {
      attivo.current = null
      setAscolto(false)
    }
    attivo.current = r
    setAscolto(true)
    r.start()
  }

  function ferma() {
    attivo.current?.stop()
  }

  return { supportata, ascolto, avvia, ferma }
}
