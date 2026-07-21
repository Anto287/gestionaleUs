import { useEffect, useRef, useState } from 'react'
import { Typography } from 'antd'
import { PalloneSpinner } from './PalloneSpinner'

/**
 * Renderizza un PDF (byte in base64) con pdf.js: ogni pagina diventa un
 * canvas, impilati come fogli. Serve per l'anteprima "di stampa": il
 * visualizzatore di Google dentro l'iframe decide la vista dallo
 * user-agent, quindi sul telefono mostra la versione riflowata che non
 * corrisponde al foglio stampato; qui invece disegniamo il PDF vero.
 */
export function AnteprimaPdf({ base64, onErrore }: { base64: string; onErrore: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)
  const [resa, setResa] = useState({ fatte: 0, totale: 0 })
  // l'errore non fa ripartire il rendering: il chiamante passa una arrow inline
  const erroreRef = useRef(onErrore)
  erroreRef.current = onErrore

  useEffect(() => {
    const el = box.current
    if (!el) return
    let annullato = false
    let chiudi: (() => void) | undefined

    ;(async () => {
      // pdf.js si carica solo quando serve (è pesante); build "legacy" per
      // reggere anche i telefoni con qualche anno sulle spalle
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const doc = await pdfjs.getDocument({ data: bytes }).promise
      if (annullato) {
        void doc.destroy()
        return
      }
      chiudi = () => void doc.destroy()
      setResa({ fatte: 0, totale: doc.numPages })

      // canvas alla larghezza del riquadro con risoluzione maggiorata, così
      // resta nitido su schermi retina e ruotando il telefono
      const larghezza = el.clientWidth || 600
      const qualita = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2.5)
      for (let n = 1; n <= doc.numPages; n++) {
        const pagina = await doc.getPage(n)
        const base = pagina.getViewport({ scale: 1 })
        const viewport = pagina.getViewport({ scale: (larghezza / base.width) * qualita })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.className = 'anteprima-pdf-pagina'
        await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
        if (annullato) return
        el.appendChild(canvas)
        setPronto(true)
        setResa({ fatte: n, totale: doc.numPages })
      }
    })().catch(() => {
      if (!annullato) erroreRef.current()
    })

    return () => {
      annullato = true
      chiudi?.()
      el.replaceChildren()
    }
  }, [base64])

  return (
    <div className="anteprima-doc">
      <div ref={box} className="anteprima-pdf" />
      {!pronto && (
        <div className="anteprima-caricamento">
          <PalloneSpinner />
          <Typography.Text type="secondary">Preparo l'anteprima di stampa…</Typography.Text>
        </div>
      )}
      {pronto && resa.fatte < resa.totale && (
        <Typography.Text
          type="secondary"
          style={{ display: 'block', textAlign: 'center', marginTop: 8 }}
        >
          Pagina {resa.fatte} di {resa.totale}…
        </Typography.Text>
      )}
    </div>
  )
}
