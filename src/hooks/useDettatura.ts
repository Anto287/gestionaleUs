import { useEffect, useRef, useState } from 'react'

/**
 * Dettatura vocale col riconoscimento del browser (Web Speech API), in
 * italiano. Niente servizi da configurare: dove il browser non la supporta,
 * `supportata` è false e il microfono non si mostra. Il testo riconosciuto
 * arriva a `onTesto` anche mentre si parla (risultati provvisori compresi).
 *
 * `avvia(testoBase)` accoda: quello che detti si AGGIUNGE al testo già
 * presente, così si può dettare a più riprese ("4 patatine" · stop ·
 * "che scadono il 28 agosto"). `errore` spiega perché si è fermata
 * (microfono negato, connessione…), da mostrare all'utente.
 */

interface IstanzaRiconoscimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: EventoRisultato) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
}
interface EventoRisultato {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
type CostruttoreRiconoscimento = new () => IstanzaRiconoscimento

function costruttore(): CostruttoreRiconoscimento | undefined {
  const w = window as unknown as Record<string, CostruttoreRiconoscimento | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

function spiegaErrore(codice?: string): string {
  switch (codice) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microfono bloccato: consenti il microfono per questo sito e riprova.'
    case 'audio-capture':
      return 'Nessun microfono trovato: controlla che sia collegato.'
    case 'network':
      return 'La dettatura ha bisogno di internet: controlla la connessione.'
    default:
      return 'La dettatura si è interrotta: riprova.'
  }
}

export function useDettatura(onTesto: (testo: string) => void) {
  const [ascolto, setAscolto] = useState(false)
  const [errore, setErrore] = useState('')
  const attivo = useRef<IstanzaRiconoscimento | null>(null)
  const consegna = useRef(onTesto)
  consegna.current = onTesto

  // se il componente sparisce mentre si sta parlando, si spegne tutto
  useEffect(() => () => attivo.current?.abort(), [])

  const supportata = typeof window !== 'undefined' && !!costruttore()

  /** Avvia l'ascolto; `testoBase` è quello già scritto, a cui si accoda il dettato. */
  function avvia(testoBase = '') {
    const Riconoscimento = costruttore()
    if (!Riconoscimento || attivo.current) return
    const base = testoBase.trim()
    const r = new Riconoscimento()
    r.lang = 'it-IT'
    r.continuous = false // si ferma da solo quando smetti di parlare
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const detto = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
        .join(' ')
        .trim()
      if (detto) consegna.current(base ? `${base} ${detto}` : detto)
    }
    r.onend = () => {
      attivo.current = null
      setAscolto(false)
    }
    r.onerror = (e) => {
      const codice = e?.error
      // fermarsi per silenzio o per uno stop manuale non è un errore
      if (codice && codice !== 'no-speech' && codice !== 'aborted') setErrore(spiegaErrore(codice))
      attivo.current = null
      setAscolto(false)
    }
    attivo.current = r
    setErrore('')
    setAscolto(true)
    r.start()
  }

  function ferma() {
    attivo.current?.stop()
  }

  return { supportata, ascolto, errore, avvia, ferma }
}
